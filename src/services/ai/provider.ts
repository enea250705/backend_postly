import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

// AI provider abstraction. Swap implementations without touching prompts or callers.
export interface AIProvider {
  generate(opts: GenerateOptions): Promise<GenerateResult>;
  generateJSON<T>(opts: GenerateOptions): Promise<T>;
}

export interface GenerateOptions {
  system: string;
  user: string;
  // Higher = more creative; for hooks 0.9, for analytics 0.2
  temperature?: number;
  maxTokens?: number;
  // When true, response should be valid JSON
  json?: boolean;
}

export interface GenerateResult {
  text: string;
  tokensUsed: number;
  model: string;
}

class AnthropicProvider implements AIProvider {
  private client: Anthropic | null = null;
  private model = env.AI_MODEL;

  private getClient() {
    if (!this.client) {
      if (!env.ANTHROPIC_API_KEY)
        throw new Error("ANTHROPIC_API_KEY is not configured. Set it in .env to use AI features.");
      this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    const client = this.getClient();
    const res = await client.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return {
      text,
      tokensUsed: res.usage.input_tokens + res.usage.output_tokens,
      model: this.model,
    };
  }

  async generateJSON<T>(opts: GenerateOptions): Promise<T> {
    const sys = `${opts.system}\n\nRespond with ONLY valid JSON. No prose, no code fences.`;
    const { text } = await this.generate({ ...opts, system: sys, json: true });
    return parseJSON<T>(text);
  }
}

// Mock provider for local dev without an API key — keeps the app usable end-to-end.
class MockProvider implements AIProvider {
  async generate(opts: GenerateOptions): Promise<GenerateResult> {
    logger.warn("Using MockProvider — set ANTHROPIC_API_KEY for real AI output");
    return {
      text: `[mock] ${opts.user.slice(0, 80)}`,
      tokensUsed: 0,
      model: "mock",
    };
  }
  async generateJSON<T>(_opts: GenerateOptions): Promise<T> {
    return { mock: true } as unknown as T;
  }
}

const parseJSON = <T>(raw: string): T => {
  // Tolerate models that wrap JSON in fences anyway.
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  // If the model accidentally emitted a preamble, find the first { or [.
  const firstBrace = cleaned.search(/[\{\[]/);
  const slice = firstBrace >= 0 ? cleaned.slice(firstBrace) : cleaned;
  return JSON.parse(slice) as T;
};

export const ai: AIProvider = env.ANTHROPIC_API_KEY ? new AnthropicProvider() : new MockProvider();
