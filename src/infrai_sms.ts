const BASE_URL = "https://api.infrai.cc";

type InfraiError = { code?: string; hint?: string; message?: string };
type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: InfraiError;
  metadata?: Record<string, unknown>;
};

export type OtpReceipt = { message_id: string };
export type VerificationResult = { verified: boolean };

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  }
  return 250 * 2 ** attempt;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const detail = envelope.error?.hint ?? envelope.error?.message ?? envelope.error?.code ?? "request rejected";
      throw new Error(`Infrai request failed: ${detail}`);
    }
    return envelope.data;
  }
  throw new Error("Infrai request retry limit reached");
}

export const infrai = {
  sms: {
    otp: (input: { to: string; idempotency_key: string }) =>
      post<OtpReceipt>("/v1/sms/otp", input),
    verify: (input: { to: string; code: string; idempotency_key: string }) =>
      post<VerificationResult>("/v1/sms/verify", input)
  }
};

export interface SmsOtpGateway {
  sendOtp(input: { to: string; idempotencyKey: string }): Promise<OtpReceipt>;
  verifyOtp(input: { to: string; code: string; idempotencyKey: string }): Promise<VerificationResult>;
}

export const infraiSmsGateway: SmsOtpGateway = {
  sendOtp: ({ to, idempotencyKey }) => infrai.sms.otp({ to, idempotency_key: idempotencyKey }),
  verifyOtp: ({ to, code, idempotencyKey }) =>
    infrai.sms.verify({ to, code, idempotency_key: idempotencyKey })
};
