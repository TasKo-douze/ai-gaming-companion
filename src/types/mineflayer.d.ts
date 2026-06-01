declare module 'mineflayer' {
  import { EventEmitter } from 'events';
  const createBot: any;
  export type Bot = any;
  export default {
    createBot: typeof createBot,
  };
}
