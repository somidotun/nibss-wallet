const secretKey = (): string => {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not defined");
  if (key.startsWith("sk_live_")) {
    throw new Error("Live Paystack keys are not allowed in this project");
  }
  return key;
};

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const res = await fetch(`${process.env.PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });
  const body = (await res.json()) as PaystackResponse<T>;
  if (!res.ok || !body.status) {
    throw new Error(`Paystack error: ${body.message ?? res.status}`);
  }
  return body.data;
};

export const initializeTransaction = (input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
}) =>
  call<{ authorization_url: string; access_code: string; reference: string }>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
      }),
    },
  );

export const verifyTransaction = (reference: string) =>
  call<{ status: string; reference: string; amount: number; currency: string }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
