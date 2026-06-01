/**
 * ConversationHistory
 *
 * Stores recent conversation and helps build prompts.
 */
export class ConversationHistory {
  private messages: { from: string; message: string; timestamp: number }[] = [];

  push(entry: { from: string; message: string; timestamp: number }) {
    this.messages.push(entry);
    // Keep length reasonable
    if (this.messages.length > 200) this.messages.shift();
  }

  buildPrompt() {
    return this.messages.map(m => `${m.from}: ${m.message}`).join('\n');
  }
}
