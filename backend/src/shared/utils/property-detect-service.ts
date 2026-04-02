/**
 * property-detect-service.ts — AI service to detect real-estate requests in chat messages.
 * Uses OpenAI to analyze batches of messages and extract structured property data.
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

const SYSTEM_PROMPT = `Bạn là AI phân tích tin nhắn bất động sản trong nhóm Zalo.
Phân tích các tin nhắn và xác định có phải yêu cầu mua/bán/cho thuê/tìm thuê BĐS không.

Trả về **CHỈ JSON** (không markdown, không comment):
{
  "isRealEstate": true/false,
  "requestType": "mua" | "bán" | "cho_thuê" | "thuê" | null,
  "propertyType": "nhà" | "đất" | "căn_hộ" | "phòng_trọ" | "mặt_bằng" | "kho_xưởng" | "khác" | null,
  "location": "khu vực/địa chỉ nếu có" hoặc null,
  "area": "diện tích nếu có" hoặc null,
  "priceRange": "khoảng giá nếu có" hoặc null,
  "contactInfo": "SĐT/tên liên hệ nếu ghi trong tin" hoặc null,
  "details": "tóm tắt ngắn gọn yêu cầu (1-2 câu)",
  "isNewIntent": true/false
}

Quy tắc:
- isRealEstate = true CHỈ khi TIN NHẮN MỚI có Ý ĐỊNH RÕ RÀNG mua/bán/thuê BĐS
- Phần [NGỮ CẢNH CŨ] chỉ để tham khảo, KHÔNG phân tích lại
- Kết hợp thông tin từ ngữ cảnh cũ + tin mới để trích xuất đầy đủ hơn (ví dụ: ngữ cảnh cũ nói "nhà Q7", tin mới nói "3 tỷ" → kết hợp thành "nhà Q7, 3 tỷ")
- isNewIntent = true nếu đây là yêu cầu BĐS MỚI (không trùng với ngữ cảnh cũ)
- isNewIntent = false nếu tin mới chỉ bổ sung thông tin cho yêu cầu đã có trong ngữ cảnh
- Tin chào hỏi, hỏi chung chung, spam, quảng cáo → isRealEstate = false
- Nếu không chắc chắn → isRealEstate = false`;

export interface PropertyDetectResult {
  isRealEstate: boolean;
  requestType: string | null;
  propertyType: string | null;
  location: string | null;
  area: string | null;
  priceRange: string | null;
  contactInfo: string | null;
  details: string;
  isNewIntent: boolean; // true = yêu cầu mới, false = bổ sung cho yêu cầu cũ
}

/**
 * Analyze a batch of messages (1-3) from one sender to detect real-estate intent.
 * Optional contextMessages provide previous conversation for richer understanding.
 */
export async function detectPropertyRequest(
  messages: { senderName: string; content: string }[],
  contextMessages?: { senderName: string; content: string }[],
): Promise<PropertyDetectResult> {
  // Format new messages
  const formatted = messages
    .map((m) => `[${m.senderName}]: ${m.content}`)
    .join('\n');

  // Format context (if any)
  let userContent = '';
  if (contextMessages && contextMessages.length > 0) {
    const contextFormatted = contextMessages
      .map((m) => `[${m.senderName}]: ${m.content}`)
      .join('\n');
    userContent = `[NGỮ CẢNH CŨ - chỉ tham khảo]:\n${contextFormatted}\n\n[TIN NHẮN MỚI - cần phân tích]:\n${formatted}`;
  } else {
    userContent = `Tin nhắn:\n${formatted}`;
  }

  logger.info(`[property-detect] Analyzing ${messages.length} messages (+${contextMessages?.length || 0} context) for BĐS`);

  try {
    const response = await getClient().chat.completions.create({
      model: config.openaiModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as PropertyDetectResult;

    logger.info(
      `[property-detect] Result: isRealEstate=${parsed.isRealEstate}, type=${parsed.requestType}, isNewIntent=${parsed.isNewIntent}`,
    );

    return {
      isRealEstate: parsed.isRealEstate ?? false,
      requestType: parsed.requestType ?? null,
      propertyType: parsed.propertyType ?? null,
      location: parsed.location ?? null,
      area: parsed.area ?? null,
      priceRange: parsed.priceRange ?? null,
      contactInfo: parsed.contactInfo ?? null,
      details: parsed.details ?? '',
      isNewIntent: parsed.isNewIntent ?? true,
    };
  } catch (err) {
    logger.error('[property-detect] AI analysis failed:', err);
    return {
      isRealEstate: false,
      requestType: null,
      propertyType: null,
      location: null,
      area: null,
      priceRange: null,
      contactInfo: null,
      details: '',
      isNewIntent: true,
    };
  }
}
