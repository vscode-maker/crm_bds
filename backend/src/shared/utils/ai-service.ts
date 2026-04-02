/**
 * ai-service.ts — OpenAI gateway service.
 * Wraps the OpenAI SDK to generate conversation summaries.
 * API key is stored securely in backend .env — never exposed to frontend.
 */
import OpenAI from 'openai';
import { config } from '../../config/index.js';
import { logger } from './logger.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    if (!config.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

const SYSTEM_PROMPT = `Bạn là trợ lý AI của hệ thống CRM quản lý hội thoại Zalo.
Nhiệm vụ: Tóm tắt cuộc hội thoại giữa nhân viên (self) và khách hàng (contact).

Trả về đúng 3 phần, mỗi phần 2-3 câu ngắn gọn:
1. 🎯 **Khách hàng muốn gì?** — Nhu cầu/vấn đề chính
2. 📋 **Đã tư vấn đến đâu?** — Tiến độ trao đổi hiện tại
3. ⚡ **Cần làm gì tiếp?** — Hành động cụ thể tiếp theo

Quy tắc:
- Viết tiếng Việt, ngắn gọn, súc tích
- Nếu chỉ có tin nhắn chào hỏi thì nói rõ "Cuộc hội thoại mới bắt đầu, chưa có nội dung trao đổi cụ thể"
- Bỏ qua sticker, hình ảnh, file — chỉ phân tích nội dung text`;

export interface ChatMessageForAI {
  role: 'self' | 'contact';
  content: string;
}

/**
 * Generate a summary of chat messages using OpenAI.
 * @param messages Array of chat messages (role + content)
 * @returns Summary text from AI
 */
export async function generateChatSummary(
  messages: ChatMessageForAI[],
): Promise<string> {
  const formatted = messages
    .map(
      (m) =>
        `[${m.role === 'self' ? 'Nhân viên' : 'Khách hàng'}]: ${m.content}`,
    )
    .join('\n');

  logger.info(`[ai-service] Generating summary for ${messages.length} messages`);

  const response = await getClient().chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Hội thoại:\n${formatted}` },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  const result = response.choices[0]?.message?.content || 'Không thể tóm tắt.';
  logger.info(`[ai-service] Summary generated successfully (${result.length} chars)`);
  return result;
}
