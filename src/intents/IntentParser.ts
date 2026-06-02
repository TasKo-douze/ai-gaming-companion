import { Intent } from './Intent';

export interface IntentResult {
  intent: Intent;
  // future: add payload, confidence, metadata
}

export class IntentParser {
  constructor() {}

  parse(text: string): IntentResult {
    const s = (text || '').trim().toLowerCase();

    if (!s) return { intent: Intent.UNKNOWN };

    // Exact matches (simple rule-based parser)
    if (s === 'ping') return { intent: Intent.PING };
    if (s === 'hello' || s === 'hi' || s === 'salut' || s === 'bonjour') return { intent: Intent.GREETING };
    if (s === 'help' || s === '/help' || s === '?') return { intent: Intent.HELP };

    // Follow commands
    if (s === 'suis-moi' || s === 'follow me' || s === "suis moi") return { intent: Intent.FOLLOW_PLAYER };

    // Stop commands
    if (s === 'stop' || s === 'arrête' || s === 'arrête de me suivre' || s === 'arrete') return { intent: Intent.STOP_FOLLOWING };

    // Unknown
    return { intent: Intent.UNKNOWN };
  }
}
