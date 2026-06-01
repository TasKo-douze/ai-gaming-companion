/**
 * PromptBuilder
 *
 * Helper to compose prompts for the LLM based on context and personality.
 */
import { PersonalityProfile } from '../personality/PersonalityProfile';

export class PromptBuilder {
  build(base: string, profile: PersonalityProfile) {
    // TODO: more advanced templating and instruction engineering
    return `${profile.toString()}\n\n${base}`;
  }
}
