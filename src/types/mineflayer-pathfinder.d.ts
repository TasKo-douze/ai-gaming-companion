declare module 'mineflayer-pathfinder' {
  import { Bot } from 'mineflayer';
  export const pathfinder: any;
  export class Movements {
    constructor(bot: Bot, mcData: any);
  }
  export const goals: any;
  export default { pathfinder, Movements, goals };
}
