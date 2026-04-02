/**
 * chat-routes.ts — REST API for conversations and messages.
 * All routes require JWT auth and are scoped to the user's org.
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/database/prisma-client.js';
import { authMiddleware } from '../auth/auth-middleware.js';
import { requireZaloAccess } from '../zalo/zalo-access-middleware.js';
import { zaloPool } from '../zalo/zalo-pool.js';
import { zaloRateLimiter } from '../zalo/zalo-rate-limiter.js';
import { logger } from '../../shared/utils/logger.js';
import { config } from '../../config/index.js';
import { generateChatSummary } from '../../shared/utils/ai-service.js';
import { randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';

type QueryParams = Record<string, string>;

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // ── List conversations (paginated) ──────────────────────────────────────
  app.get('/api/v1/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { page = '1', limit = '50', search = '', accountId = '' } = request.query as QueryParams;

    const where: any = { orgId: user.orgId };
    if (accountId) where.zaloAccountId = accountId;
    if (search) {
      where.contact = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      };
    }

    // Members can only see conversations from Zalo accounts they have access to
    if (user.role === 'member') {
      const accessibleAccounts = await prisma.zaloAccountAccess.findMany({
        where: { userId: user.id },
        select: { zaloAccountId: true },
      });
      where.zaloAccountId = { in: accessibleAccounts.map((a) => a.zaloAccountId) };
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: { select: { id: true, fullName: true, phone: true, avatarUrl: true, zaloUid: true } },
          zaloAccount: { select: { id: true, displayName: true, zaloUid: true } },
          messages: {
            take: 1,
            orderBy: { sentAt: 'desc' },
            select: { content: true, contentType: true, senderType: true, sentAt: true, isDeleted: true },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.conversation.count({ where }),
    ]);

    return { conversations, total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ── Get single conversation ──────────────────────────────────────────────
  app.get('/api/v1/conversations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const conversation = await prisma.conversation.findFirst({
      where: { id, orgId: user.orgId },
      include: {
        contact: true,
        zaloAccount: { select: { id: true, displayName: true, zaloUid: true, status: true } },
      },
    });
    if (!conversation) return reply.status(404).send({ error: 'Not found' });

    return conversation;
  });

  // ── List messages for a conversation (paginated, newest first) ──────────
  app.get('/api/v1/conversations/:id/messages', { preHandler: requireZaloAccess('read') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { page = '1', limit = '50' } = request.query as QueryParams;

    const conversation = await prisma.conversation.findFirst({
      where: { id, orgId: user.orgId },
      select: { id: true },
    });
    if (!conversation) return reply.status(404).send({ error: 'Conversation not found' });

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { sentAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.message.count({ where: { conversationId: id } }),
    ]);

    return { messages: messages.reverse(), total, page: parseInt(page), limit: parseInt(limit) };
  });

  // ── Send message ─────────────────────────────────────────────────────────
  app.post('/api/v1/conversations/:id/messages', { preHandler: requireZaloAccess('chat') }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };

    if (!content?.trim()) return reply.status(400).send({ error: 'Content required' });

    const conversation = await prisma.conversation.findFirst({
      where: { id, orgId: user.orgId },
      include: { zaloAccount: true },
    });
    if (!conversation) return reply.status(404).send({ error: 'Conversation not found' });

    const instance = zaloPool.getInstance(conversation.zaloAccountId);
    if (!instance?.api) return reply.status(400).send({ error: 'Zalo account not connected' });

    // Rate limit check — prevent account blocking
    const limits = zaloRateLimiter.checkLimits(conversation.zaloAccountId);
    if (!limits.allowed) {
      return reply.status(429).send({ error: limits.reason });
    }

    try {
      const threadId = conversation.externalThreadId || '';
      // zca-js sendMessage(message, threadId, type) — type: 0=User, 1=Group
      const threadType = conversation.threadType === 'group' ? 1 : 0;

      zaloRateLimiter.recordSend(conversation.zaloAccountId);
      await instance.api.sendMessage({ msg: content }, threadId, threadType);

      const message = await prisma.message.create({
        data: {
          id: randomUUID(),
          conversationId: id,
          senderType: 'self',
          senderUid: conversation.zaloAccount.zaloUid || '',
          senderName: 'Staff',
          content,
          contentType: 'text',
          sentAt: new Date(),
          repliedByUserId: user.id,
        },
      });

      await prisma.conversation.update({
        where: { id },
        data: { lastMessageAt: new Date(), isReplied: true, unreadCount: 0 },
      });

      const io = (app as any).io as Server;
      io?.emit('chat:message', { accountId: conversation.zaloAccountId, message, conversationId: id });

      return message;
    } catch (err) {
      logger.error('[chat] Send message error:', err);
      return reply.status(500).send({ error: 'Failed to send message' });
    }
  });

  // ── Mark conversation as read ────────────────────────────────────────────
  app.post('/api/v1/conversations/:id/mark-read', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    await prisma.conversation.updateMany({
      where: { id, orgId: user.orgId },
      data: { unreadCount: 0 },
    });

    return { success: true };
  });

  // ── AI Summary ────────────────────────────────────────────────────────────
  app.get('/api/v1/conversations/:id/summary', {
    preHandler: requireZaloAccess('read'),
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { force = 'false' } = request.query as { force?: string };

    // 1. Verify conversation belongs to org
    const conversation = await prisma.conversation.findFirst({
      where: { id, orgId: user.orgId },
      select: { id: true, aiSummary: true, aiSummaryUpdatedAt: true, lastMessageAt: true },
    });
    if (!conversation) return reply.status(404).send({ error: 'Not found' });

    // 2. Cache check — return cached if no new messages since last summary
    if (
      force !== 'true' &&
      conversation.aiSummary &&
      conversation.aiSummaryUpdatedAt &&
      conversation.lastMessageAt &&
      conversation.aiSummaryUpdatedAt >= conversation.lastMessageAt
    ) {
      return { summary: conversation.aiSummary, cached: true };
    }

    // 3. Check OpenAI API key configured
    if (!config.openaiApiKey) {
      return reply.status(503).send({ error: 'AI chưa được cấu hình. Vui lòng thêm OPENAI_API_KEY.' });
    }

    // 4. Fetch last 50 messages (newest first, then reverse for chronological order)
    const msgs = await prisma.message.findMany({
      where: { conversationId: id, isDeleted: false },
      orderBy: { sentAt: 'desc' },
      take: 50,
      select: { senderType: true, content: true, contentType: true },
    });

    // Filter: text messages keep content, non-text get descriptive labels
    const contentLabels: Record<string, string> = {
      image: '[Đã gửi 1 Hình Ảnh]',
      sticker: '[Sticker]',
      video: '[Video]',
      voice: '[Tin nhắn thoại]',
      file: '[Đã gửi File]',
      gif: '[GIF]',
      link: '[Đã gửi Link]',
    };

    const formatted = msgs.reverse().map((m) => {
      if (m.contentType !== 'text' || !m.content) {
        return {
          role: m.senderType as 'self' | 'contact',
          content: contentLabels[m.contentType] || '[Đa phương tiện]',
        };
      }
      // Parse JSON content (links, reminders, etc.) to extract readable text
      let text = m.content;
      if (text.startsWith('{')) {
        try {
          const p = JSON.parse(text);
          text = p.title || p.description || text;
        } catch {
          // keep original text if JSON parse fails
        }
      }
      return { role: m.senderType as 'self' | 'contact', content: text };
    });

    if (formatted.length === 0) {
      return { summary: 'Chưa có tin nhắn để tóm tắt.', cached: false };
    }

    // 5. Call OpenAI via ai-service
    try {
      const summary = await generateChatSummary(formatted);

      // 6. Cache result in database
      await prisma.conversation.update({
        where: { id },
        data: { aiSummary: summary, aiSummaryUpdatedAt: new Date() },
      });

      return { summary, cached: false };
    } catch (err: any) {
      logger.error('[chat] AI summary error:', err);
      const errorMsg = err.message?.includes('API key')
        ? 'API Key không hợp lệ'
        : err.message?.includes('configured')
          ? 'AI chưa được cấu hình. Vui lòng thêm OPENAI_API_KEY.'
          : 'AI tạm thời không khả dụng, vui lòng thử lại sau.';
      return reply.status(500).send({ error: errorMsg });
    }
  });

  // ── Toggle auto-detect BĐS for a conversation ────────────────────────────
  app.patch('/api/v1/conversations/:id/auto-detect', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    try {
      const conv = await prisma.conversation.findFirst({
        where: { id, orgId: user.orgId },
        select: { id: true, autoDetectEnabled: true, threadType: true },
      });

      if (!conv) return reply.status(404).send({ error: 'Conversation not found' });
      if (conv.threadType !== 'group') {
        return reply.status(400).send({ error: 'Auto-detect chỉ áp dụng cho nhóm chat' });
      }

      const updated = await prisma.conversation.update({
        where: { id },
        data: { autoDetectEnabled: !conv.autoDetectEnabled },
        select: { id: true, autoDetectEnabled: true },
      });

      logger.info(`[chat] Auto-detect ${updated.autoDetectEnabled ? 'enabled' : 'disabled'} for ${id}`);
      return reply.send(updated);
    } catch (err) {
      logger.error('[chat] Toggle auto-detect error:', err);
      return reply.status(500).send({ error: 'Lỗi hệ thống' });
    }
  });

  // ── List property requests for a conversation ─────────────────────────────
  app.get('/api/v1/conversations/:id/property-requests', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { status = '' } = request.query as QueryParams;

    try {
      const conv = await prisma.conversation.findFirst({
        where: { id, orgId: user.orgId },
        select: { id: true },
      });
      if (!conv) return reply.status(404).send({ error: 'Conversation not found' });

      const where: any = { conversationId: id, orgId: user.orgId };
      if (status) where.status = status;

      const requests = await prisma.propertyRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return reply.send({ data: requests });
    } catch (err) {
      logger.error('[chat] List property requests error:', err);
      return reply.status(500).send({ error: 'Lỗi hệ thống' });
    }
  });

  // ── Review (approve/reject) a property request ────────────────────────────
  app.patch('/api/v1/property-requests/:id/review', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { status, notes } = request.body as { status: string; notes?: string };

    if (!['approved', 'rejected'].includes(status)) {
      return reply.status(400).send({ error: 'Status phải là approved hoặc rejected' });
    }

    try {
      const existing = await prisma.propertyRequest.findFirst({
        where: { id, orgId: user.orgId },
      });
      if (!existing) return reply.status(404).send({ error: 'Request not found' });

      const updated = await prisma.propertyRequest.update({
        where: { id },
        data: {
          status,
          reviewedBy: user.id,
          reviewedAt: new Date(),
          notes: notes || null,
        },
      });

      logger.info(`[chat] PropertyRequest ${id} ${status} by ${user.email}`);
      return reply.send(updated);
    } catch (err) {
      logger.error('[chat] Review property request error:', err);
      return reply.status(500).send({ error: 'Lỗi hệ thống' });
    }
  });

  // ── Get daily AI usage stats ──────────────────────────────────────────────
  app.get('/api/v1/property-detect/usage', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const { getDailyUsage } = await import('./property-debounce.js');
    return reply.send(getDailyUsage(user.orgId));
  });
}
