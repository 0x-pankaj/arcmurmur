import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "./env";

let _provider: ReturnType<typeof createOpenAICompatible> | null = null;

export function provider() {
  if (_provider) return _provider;
  _provider = createOpenAICompatible({
    name: "openrouter",
    apiKey: env.OPENROUTER_API_KEY || "missing",
    baseURL: env.OPENROUTER_BASE_URL,
    headers: {
      "HTTP-Referer": "https://arcmurmur.app",
      "X-Title": "ArcMurmur",
    },
  });
  return _provider;
}

export function model() {
  return provider().chatModel(env.OPENROUTER_MODEL);
}

export function llmAvailable(): boolean {
  return (
    !!env.OPENROUTER_API_KEY &&
    env.OPENROUTER_API_KEY !== "sk-or-v1-replace-me" &&
    !env.OPENROUTER_API_KEY.startsWith("sk-or-v1-replace")
  );
}
