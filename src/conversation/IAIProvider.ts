/**
 * IAIProvider
 *
 * Interface for an LLM provider (OpenAI, local models, etc.).
 */
export interface IAIProvider {
  generateResponse(prompt: string): Promise<string>;
}
