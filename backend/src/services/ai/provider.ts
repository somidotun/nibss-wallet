export interface AiProvider {
  name: "gemini";
  generate(input: {
    system: string;
    prompt: string;
    maxOutputTokens?: number;
  }): Promise<string>;
}

const DEFAULT_MODEL = "gemini-3.7-flash";

const geminiProvider = (): AiProvider => ({
  name: "gemini",
  async generate({ system, prompt, maxOutputTokens = 400 }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not defined");
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens,
      temperature: 0.4,
    };
    const level = process.env.GEMINI_THINKING_LEVEL ?? "low";
    if (level) generationConfig.thinkingConfig = { thinkingLevel: level };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );

    // The error body can echo the prompt, so only the status is kept
    if (!res.ok)
      throw new Error(`Gemini request failed with status ${res.status}`);

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new Error("Gemini returned no text");
    return text;
  },
});

export const getProvider = (): AiProvider | null => {
  const choice = (process.env.AI_PROVIDER ?? "none").toLowerCase();
  if (choice === "gemini" && process.env.GEMINI_API_KEY)
    return geminiProvider();
  return null;
};
