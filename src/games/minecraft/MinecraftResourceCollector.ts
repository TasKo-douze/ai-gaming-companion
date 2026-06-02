import { Bot } from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import mcDataLib from 'minecraft-data';

export class MinecraftResourceCollector {
  private bot: Bot;
  private navigator?: any;

  constructor(bot: Bot, navigator?: any) {
    this.bot = bot;
    this.navigator = navigator;
  }

  private async waitUntilNear(position: { x: number; y: number; z: number }, range = 1.5, timeoutMs = 30000): Promise<void> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const iv = setInterval(() => {
        if (!this.bot.entity || !this.bot.entity.position) return;
        const p = this.bot.entity.position;
        const dx = p.x - position.x;
        const dy = p.y - position.y;
        const dz = p.z - position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist <= range) {
          clearInterval(iv);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          reject(new Error('Timeout while moving to target'));
        }
      }, 500);
    });
  }

  private findNearbyWood(maxDistance = 16): any | null {
    try {
      const mcData = mcDataLib(this.bot.version as string);
      const isWoodName = (name: string) => /log|wood/i.test(name);
      // iterate through loaded blocks
      for (const id in this.bot.blocks) {
        // bot.blocks is a Record of block positions? If not accessible, fall back to bot.findBlock
      }
      // Use built-in findBlock
      const blk = (this.bot as any).findBlock({
        matching: (b: any) => {
          if (!b) return false;
          const bd = mcData.blocks[b.type];
          if (!bd) return false;
          return isWoodName(bd.name);
        },
        maxDistance,
      });
      return blk || null;
    } catch (e) {
      return null;
    }
  }

  async collectWood(username?: string): Promise<void> {
    if (!this.bot) throw new Error('Bot not initialized');
    // Find a nearby wood/log block
    const block = this.findNearbyWood(16);
    if (!block) {
      throw new Error('No wood found nearby');
    }

    // Move near the block using pathfinder
    try {
      if (!(this.bot as any).pathfinder) {
        (this.bot as any).loadPlugin(pathfinder);
        const mcData = mcDataLib(this.bot.version as string);
        const movements = new Movements(this.bot, mcData);
        (this.bot as any).pathfinder.setMovements(movements);
      }
      // set goal near block
      const goal = new goals.GoalNear(block.position.x, block.position.y, block.position.z, 1);
      (this.bot as any).pathfinder.setGoal(goal, true);
      await this.waitUntilNear(block.position, 1.5, 30000);
    } catch (e) {
      throw new Error(`Failed to move to wood: ${(e as Error).message}`);
    }

    // dig the block
    try {
      await new Promise<void>((resolve, reject) => {
        this.bot.dig(block, true, (err: Error | null) => {
          if (err) return reject(err);
          resolve();
        });
      });
    } catch (e) {
      throw new Error(`Failed to dig wood: ${(e as Error).message}`);
    } finally {
      try { (this.bot as any).pathfinder.setGoal(null); } catch (e) { /* ignore */ }
    }
  }
}
