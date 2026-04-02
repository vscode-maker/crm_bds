/**
 * canco-integration.ts — Forward detected property requests to can-co social platform.
 *
 * When ZaloCRM's AI detects a real-estate request in Zalo chats,
 * this service forwards it to can-co to auto-create an intent (CẦN/CÓ post).
 * Includes retry logic (3 attempts, exponential backoff).
 */
import { config } from '../../config/index.js';
import { logger } from './logger.js';
import type { PropertyDetectResult } from './property-detect-service.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff

interface PropertyRequestData {
  id: string;
  senderUid: string;
  senderName: string | null;
  conversationId: string;
  orgId: string;
}

export interface CanCoResult {
  intentId: string;
  userId: string;
  intentType: 'CAN' | 'CO';
  title: string;
}

/**
 * Forward a detected property request to can-co platform.
 * Returns the result (intentId, title) so the caller can send a Zalo reply.
 * Returns null if not configured or all retries fail.
 */
export async function forwardToCanCo(
  request: PropertyRequestData,
  detectResult: PropertyDetectResult,
): Promise<CanCoResult | null> {
  const apiUrl = config.cancoApiUrl;
  const apiKey = config.cancoApiKey;

  // Silent skip nếu chưa cấu hình
  if (!apiUrl || !apiKey) {
    logger.debug('[canco-integration] Skip — CANCO_API_URL or CANCO_API_KEY not configured');
    return null;
  }

  const payload = {
    senderName: request.senderName || 'Zalo User',
    senderUid: request.senderUid,
    contactInfo: detectResult.contactInfo,
    requestType: detectResult.requestType,
    propertyType: detectResult.propertyType,
    location: detectResult.location,
    area: detectResult.area,
    priceRange: detectResult.priceRange,
    details: detectResult.details,
    source: 'zalocrm',
    requestId: request.id,
    conversationId: request.conversationId,
  };

  try {
    return await retryPost(apiUrl, apiKey, payload);
  } catch (err) {
    logger.error('[canco-integration] All retries exhausted:', err);
    return null;
  }
}

/**
 * POST with exponential backoff retry.
 */
async function retryPost(
  apiUrl: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<CanCoResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${apiUrl}/api/external/property-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (response.ok) {
        const data = await response.json();
        logger.info(
          `[canco-integration] ✅ Forwarded to can-co: intentId=${data.intentId}, userId=${data.userId}`,
        );
        return data as CanCoResult;
      }

      // Non-retryable errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        const errorBody = await response.text();
        logger.error(
          `[canco-integration] Client error ${response.status}: ${errorBody}`,
        );
        throw new Error(`Client error ${response.status}: ${errorBody}`);
      }

      // Server errors → retry
      lastError = new Error(`HTTP ${response.status}`);
      logger.warn(
        `[canco-integration] Attempt ${attempt}/${MAX_RETRIES} failed: HTTP ${response.status}`,
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        `[canco-integration] Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`,
      );
    }

    // Exponential backoff (skip wait on last attempt)
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Unknown retry failure');
}
