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

    // Remember / Who am I
    if (s === 'remember me' || s === 'souviens-toi de moi' || s === 'souviens toi de moi') return { intent: Intent.REMEMBER_ME };
    if (s === 'who am i' || s === 'qui suis-je' || s === 'qui suis je') return { intent: Intent.WHO_AM_I };

    // Movement commands - exact phrases requested
    if (s === 'viens ici' || s === 'come here') return { intent: Intent.COME_HERE };
    if (s === 'reste ici' || s === 'stay here') return { intent: Intent.STAY_HERE };
    if (s === 'où es-tu' || s === 'ou es-tu' || s === 'where are you') return { intent: Intent.WHERE_ARE_YOU };

    // Collect wood
    if (
      s === 'coupe du bois' ||
      s === 'collect wood' ||
      s === 'va chercher du bois' ||
      s === 'get wood'
    )
      return { intent: Intent.COLLECT_WOOD };

    // Follow commands
    if (s === 'suis-moi' || s === 'follow me' || s === "suis moi") return { intent: Intent.FOLLOW_PLAYER };

    // Stop commands
    if (s === 'stop' || s === 'arrête' || s === 'arrête de me suivre' || s === 'arrete') return { intent: Intent.STOP_FOLLOWING };

    // Unknown
    return { intent: Intent.UNKNOWN };
  }
}
