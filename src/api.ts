interface SendMessageRequest {
  serverUrl: string;
  sessionId: string;
  message: string;
  modelId: string;
}

interface ChatResponse {
  reply: string;
}

const REQUEST_TIMEOUT_MS = 20000;

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function makeRequestBody(payload: SendMessageRequest) {
  return {
    sessionId: payload.sessionId,
    message: payload.message,
    model: payload.modelId,
  };
}

async function requestJson(
  url: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed (${response.status}): ${text || 'unknown error'}`);
    }

    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

function pickReply(payload: Record<string, unknown>): string | null {
  const candidates = [payload.reply, payload.message, payload.content, payload.output_text];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

export async function sendChatMessage(payload: SendMessageRequest): Promise<ChatResponse> {
  const base = normalizeBaseUrl(payload.serverUrl);
  if (!base) {
    return {
      reply:
        'No server configured. Set a server URL in Settings to send real requests. This is a local preview response.',
    };
  }

  const body = makeRequestBody(payload);
  const endpoints = ['/api/chat', '/api/v1/chat', '/chat'];

  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const data = await requestJson(`${base}${endpoint}`, body);
      const reply = pickReply(data);
      if (reply) {
        return { reply };
      }
    } catch (error) {
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : 'Unable to reach the configured server.';

  return {
    reply: `Server request failed. ${detail}`,
  };
}
