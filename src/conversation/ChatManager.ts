/**
 * ChatManager
 *
 * Receives messages from players and returns responses (via LLM or local model).
 */
import { ConversationHistory } from './ConversationHistory';
import { IAIProvider } from './IAIProvider';

export class ChatManager {
  private history: ConversationHistory;
  private provider: IAIProvider | null = null;

  constructor() {
    this.history = new ConversationHistory();
  }

  setProvider(provider: IAIProvider) {
    this.provider = provider;
  }

  async receiveMessage(from: string, message: string) {
    this.history.push({ from, message, timestamp: Date.now() });
    if (!this.provider) throw new Error('No AI provider configured');
    const prompt = this.history.buildPrompt();
    return this.provider.generateResponse(prompt);
  }
}
