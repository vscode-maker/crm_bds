/**
 * property-debounce.ts — Debounce manager for property request detection.
 *
 * 6-layer cost protection:
 * L1: autoDetectEnabled toggle per conversation
 * L2: aiProcessed flag per message (no reprocessing)
 * L3: Debounce 2min per sender (batch 1-3 msgs → 1 API call)
 * L4: Only text messages from contacts (skip images/stickers/self)
 * L5: Keyword pre-filter (FREE — skip messages without BĐS keywords)
 * L6: Daily budget limit per org (cap API calls/day)
 */
import { prisma } from '../../shared/database/prisma-client.js';
import { logger } from '../../shared/utils/logger.js';
import { detectPropertyRequest } from '../../shared/utils/property-detect-service.js';
import { randomUUID } from 'node:crypto';

const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes
const MAX_MESSAGES = 3; // Analyze up to 3 recent messages

// ═══════════════════════════════════════════════════════════════
// LAYER 5: Keyword Pre-filter (FREE — no AI call)
// ═══════════════════════════════════════════════════════════════
const BDS_KEYWORDS = [
  // Hành động
  'mua', 'bán', 'thuê', 'cho thuê', 'cần mua', 'cần bán', 'cần thuê',
  'tìm', 'sang nhượng', 'chuyển nhượng',
  // Loại BĐS
  'nhà', 'đất', 'căn hộ', 'chung cư', 'phòng trọ', 'biệt thự',
  'mặt bằng', 'kho', 'xưởng', 'nền', 'lô đất', 'shophouse',
  'penthouse', 'villa', 'townhouse', 'đất nền',
  // Đơn vị
  'm2', 'mét vuông', 'héc ta', 'hecta',
  // Giá trị
  'tỷ', 'triệu/tháng', 'triệu/m2', 'tr/tháng',
  // Địa điểm (generic)
  'quận', 'huyện', 'phường', 'xã', 'đường', 'khu vực',
  'mặt tiền', 'hẻm', 'ngõ', 'khu dân cư', 'khu đô thị',
];

/**
 * Check if combined message text contains any BĐS-related keywords.
 * This is a FREE filter — prevents unnecessary AI API calls.
 */
function containsBDSKeywords(texts: string[]): boolean {
  const combined = texts.join(' ').toLowerCase();
  return BDS_KEYWORDS.some((kw) => combined.includes(kw));
}

// ═══════════════════════════════════════════════════════════════
// LAYER 6: Daily Budget Limit per Org
// ═══════════════════════════════════════════════════════════════
const DAILY_LIMIT = 100; // Max AI calls per org per day
const dailyCounters = new Map<string, { count: number; resetAt: number }>();

/**
 * Check and increment the daily API call counter for an org.
 * Returns true if within budget, false if limit exceeded.
 */
function checkDailyBudget(orgId: string): boolean {
  const now = Date.now();
  const entry = dailyCounters.get(orgId);

  // Reset counter if past midnight
  if (!entry || now >= entry.resetAt) {
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0); // Next midnight
    dailyCounters.set(orgId, { count: 1, resetAt: tomorrow.getTime() });
    return true;
  }

  if (entry.count >= DAILY_LIMIT) {
    logger.warn(`[property-debounce] Daily budget exceeded for org ${orgId} (${entry.count}/${DAILY_LIMIT})`);
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Get current daily usage stats for an org.
 */
export function getDailyUsage(orgId: string): { used: number; limit: number; remaining: number } {
  const entry = dailyCounters.get(orgId);
  const used = entry && Date.now() < entry.resetAt ? entry.count : 0;
  return { used, limit: DAILY_LIMIT, remaining: DAILY_LIMIT - used };
}

// ═══════════════════════════════════════════════════════════════
// Core Debounce Logic
// ═══════════════════════════════════════════════════════════════

// In-memory timers: key = "conversationId:senderUid"
const debounceTimers = new Map<string, NodeJS.Timeout>();

// Socket.IO reference for emitting events
let ioRef: any = null;

export function setPropertyDebounceIO(io: any) {
  ioRef = io;
}

/**
 * Schedule a debounced property detection for a sender in a conversation.
 * Resets the timer if called again within the debounce window.
 */
export function schedulePropertyDetection(
  conversationId: string,
  senderUid: string,
  senderName: string,
  orgId: string,
): void {
  const key = `${conversationId}:${senderUid}`;

  // Clear existing timer for this sender
  const existing = debounceTimers.get(key);
  if (existing) {
    clearTimeout(existing);
  }

  // Set new timer
  const timer = setTimeout(async () => {
    debounceTimers.delete(key);
    await runPropertyAnalysis(conversationId, senderUid, senderName, orgId);
  }, DEBOUNCE_MS);

  debounceTimers.set(key, timer);
  logger.debug(`[property-debounce] Scheduled analysis for ${senderName} in ${conversationId} (${DEBOUNCE_MS / 1000}s)`);
}

/**
 * Trigger property detection for a message in a conversation.
 * Checks if auto-detect is enabled before scheduling.
 */
export async function triggerPropertyDetection(
  conversationId: string,
  senderUid: string,
  senderName: string,
): Promise<void> {
  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { autoDetectEnabled: true, orgId: true },
    });

    if (!conv?.autoDetectEnabled) return;

    schedulePropertyDetection(conversationId, senderUid, senderName, conv.orgId);
  } catch (err) {
    logger.error('[property-debounce] triggerPropertyDetection error:', err);
  }
}

/**
 * Run the actual AI analysis after debounce window expires.
 */
async function runPropertyAnalysis(
  conversationId: string,
  senderUid: string,
  senderName: string,
  orgId: string,
): Promise<void> {
  try {
    // Fetch recent unprocessed text messages from this sender
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        senderUid,
        senderType: 'contact',
        contentType: 'text',
        aiProcessed: false,
        isDeleted: false,
      },
      orderBy: { sentAt: 'desc' },
      take: MAX_MESSAGES,
      select: {
        id: true,
        content: true,
        senderName: true,
      },
    });

    if (messages.length === 0) {
      logger.debug(`[property-debounce] No unprocessed messages for ${senderName}`);
      return;
    }

    // Reverse to chronological order
    messages.reverse();

    // ── LAYER 5: Keyword pre-filter ──────────────────────────────
    const textContents = messages.map((m) => m.content || '');
    if (!containsBDSKeywords(textContents)) {
      // No BĐS keywords → mark as processed, skip AI call (FREE)
      const messageIds = messages.map((m) => m.id);
      await prisma.message.updateMany({
        where: { id: { in: messageIds } },
        data: { aiProcessed: true },
      });
      logger.debug(`[property-debounce] L5 SKIP: No BĐS keywords from ${senderName} — saved 1 API call`);
      return;
    }

    // ── LAYER 6: Daily budget check ──────────────────────────────
    if (!checkDailyBudget(orgId)) {
      // Budget exceeded → mark as processed, skip AI call
      const messageIds = messages.map((m) => m.id);
      await prisma.message.updateMany({
        where: { id: { in: messageIds } },
        data: { aiProcessed: true },
      });
      logger.warn(`[property-debounce] L6 SKIP: Daily budget exceeded for org ${orgId}`);
      return;
    }

    // ── AI Detection (passes all 6 layers) ───────────────────────
    const result = await detectPropertyRequest(
      messages.map((m) => ({
        senderName: m.senderName || senderName,
        content: m.content || '',
      })),
    );

    // Mark messages as processed regardless of result
    const messageIds = messages.map((m) => m.id);
    await prisma.message.updateMany({
      where: { id: { in: messageIds } },
      data: { aiProcessed: true },
    });

    // If real-estate request detected, create PropertyRequest
    if (result.isRealEstate) {
      const request = await prisma.propertyRequest.create({
        data: {
          id: randomUUID(),
          orgId,
          conversationId,
          senderUid,
          senderName,
          requestType: result.requestType,
          propertyType: result.propertyType,
          location: result.location,
          area: result.area,
          priceRange: result.priceRange,
          contactInfo: result.contactInfo,
          details: result.details,
          rawMessages: messages.map((m) => ({
            id: m.id,
            content: m.content,
            senderName: m.senderName,
          })),
          sourceMessageIds: messageIds,
        },
      });

      logger.info(
        `[property-debounce] ✅ Created PropertyRequest ${request.id}: ${result.requestType} ${result.propertyType} @ ${result.location}`,
      );

      // Emit socket event for real-time UI update
      if (ioRef) {
        ioRef.emit('property:new-request', {
          conversationId,
          request,
        });
      }
    } else {
      logger.debug(`[property-debounce] Not a real-estate request from ${senderName}`);
    }
  } catch (err) {
    logger.error('[property-debounce] runPropertyAnalysis error:', err);
  }
}

/**
 * Cleanup all pending timers (call on server shutdown)
 */
export function clearAllPropertyTimers(): void {
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}
