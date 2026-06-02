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
      }, 300);
    });
  }

  private findWoodCandidates(maxDistance = 16): any[] {
    const mcData = mcDataLib(this.bot.version as string);

    // Build whitelist of block ids that represent usable logs/stems/wood (exclude leaves)
    const allowedIds: number[] = [];
    for (const b of Object.values(mcData.blocks) as any[]) {
      if (!b || typeof b !== 'object') continue;
      const name: string = String(b.name || '').toLowerCase();
      // Exclude leaves explicitly
      if (/leaf|leaves?/i.test(name)) continue;
      // Accept logs, wood, stem, trunk
      if (/(log|wood|stem|trunk)/i.test(name)) {
        if (typeof b.id === 'number') allowedIds.push(b.id);
      }
    }

    if (!allowedIds.length) return [];

    // Use bot.findBlocks to get many candidate positions
    const positions = (this.bot as any).findBlocks({
      matching: allowedIds,
      maxDistance,
      count: 100,
    }) as { x: number; y: number; z: number }[];

    if (!positions || !positions.length) return [];

    // Map to block objects and filter out nulls
    const blocks = positions
      .map(pos => (this.bot as any).blockAt(pos))
      .filter((b: any) => b && b.type && b.position);

    return blocks;
  }

  private distanceSqToBot(pos: { x: number; y: number; z: number }): number {
    if (!this.bot || !this.bot.entity || !this.bot.entity.position) return Number.MAX_SAFE_INTEGER;
    const p = this.bot.entity.position;
    const dx = p.x - pos.x;
    const dy = p.y - pos.y;
    const dz = p.z - pos.z;
    return dx * dx + dy * dy + dz * dz;
  }

  async collectWood(username?: string): Promise<void> {
    if (!this.bot) throw new Error('Bot not initialized');

    const candidates = this.findWoodCandidates(16);
    console.log(`[collector] found ${candidates.length} wood candidates`);
    if (!candidates.length) {
      throw new Error('No wood found nearby');
    }

    // Sort candidates by horizontal distance then by height (prefer low)
    const sorted = candidates
      .slice()
      .sort((a: any, b: any) => {
        const da = this.distanceSqToBot(a.position);
        const db = this.distanceSqToBot(b.position);
        if (da !== db) return da - db;
        return a.position.y - b.position.y;
      });

    // Ensure pathfinder plugin and movements
    try {
      if (!(this.bot as any).pathfinder) {
        (this.bot as any).loadPlugin(pathfinder);
      }
      const mcData = mcDataLib(this.bot.version as string);
      const movements = new Movements(this.bot, mcData);
      (this.bot as any).pathfinder.setMovements(movements);
    } catch (e) {
      console.error('[collector] failed to setup pathfinder', e);
    }

    let lastErr: Error | null = null;

    for (const blk of sorted) {
      try {
        // Basic checks
        const name = (mcDataLib(this.bot.version as string).blocks as any)[blk.type]?.name || 'unknown';
        console.log(`[collector] trying wood block ${name} at ${blk.position.x},${blk.position.y},${blk.position.z}`);

        // prefer low blocks (within reachable height)
        const botY = this.bot.entity?.position?.y ?? 0;
        if (blk.position.y - botY > 4) {
          console.log('[collector] candidate too high, skipping');
          continue;
        }

        // Try to find a placeable position near the block where bot can stand (prefer cardinal adjacent)
        const standOffsets = [
          { x: 1, z: 0 },
          { x: -1, z: 0 },
          { x: 0, z: 1 },
          { x: 0, z: -1 },
          { x: 1, z: 1 },
          { x: -1, z: -1 },
        ];

        let standPos: { x: number; y: number; z: number } | null = null;
        for (const off of standOffsets) {
          const px = blk.position.x + off.x;
          const pz = blk.position.z + off.z;
          const py = blk.position.y; // standing at same height
          const blockBelow = (this.bot as any).blockAt({ x: px, y: py - 1, z: pz });
          const blockAtFeet = (this.bot as any).blockAt({ x: px, y: py, z: pz });
          const blockHead = (this.bot as any).blockAt({ x: px, y: py + 1, z: pz });
          const belowSolid = blockBelow && blockBelow.type !== 0;
          const feetEmpty = !blockAtFeet || blockAtFeet.type === 0;
          const headEmpty = !blockHead || blockHead.type === 0;
          if (belowSolid && feetEmpty && headEmpty) {
            standPos = { x: px, y: py, z: pz };
            break;
          }
        }

        if (!standPos) {
          console.log('[collector] no accessible stand position found near candidate, skipping');
          continue;
        }

        // Move near the block (to the standing position)
        try {
          console.log('[collector] moving near wood block');
          const goal = new goals.GoalNear(standPos.x, standPos.y, standPos.z, 1);
          (this.bot as any).pathfinder.setGoal(goal, true);
          await this.waitUntilNear(standPos, 1.5, 30000);
        } catch (e) {
          console.log('[collector] failed to move to candidate, skipping');
          try { (this.bot as any).pathfinder.setGoal(null); } catch (err) {}
          continue;
        }

        // Once near, confirm block still present and is desirable
        const fresh = (this.bot as any).blockAt(blk.position);
        if (!fresh || fresh.type === 0) {
          console.log('[collector] candidate disappeared, trying next');
          try { (this.bot as any).pathfinder.setGoal(null); } catch (err) {}
          continue;
        }

        const freshName = (mcDataLib(this.bot.version as string).blocks as any)[fresh.type]?.name || 'unknown';
        if (/leaf|leaves?/i.test(String(freshName))) {
          console.log('[collector] candidate is leaves, skipping');
          try { (this.bot as any).pathfinder.setGoal(null); } catch (err) {}
          continue;
        }

        // Check canDigBlock if available
        if (typeof (this.bot as any).canDigBlock === 'function') {
          const canDig = (this.bot as any).canDigBlock(fresh);
          if (!canDig) {
            console.log('[collector] cannot dig this block, skipping');
            try { (this.bot as any).pathfinder.setGoal(null); } catch (err) {}
            continue;
          }
        }

        // Look at block center and dig
        try {
          console.log('[collector] digging wood block');
          await (this.bot as any).lookAt(fresh.position.offset(0.5, 0.5, 0.5), true);

          await new Promise<void>((resolve, reject) => {
            this.bot.dig(fresh, true, (err: Error | null) => {
              if (err) return reject(err);
              resolve();
            });
          });

          // verify block removed
          const after = (this.bot as any).blockAt(fresh.position);
          if (!after || after.type === 0) {
            console.log('[collector] wood block collected');
            try { (this.bot as any).pathfinder.setGoal(null); } catch (err) {}
            return;
          } else {
            console.log('[collector] candidate failed: block still present after dig');
            lastErr = new Error('Block still present after dig');
            try { (this.bot as any).pathfinder.setGoal(null); } catch (err) {}
            continue;
          }
        } catch (e: unknown) {
          const reason = e instanceof Error ? e.message : String(e);
          console.log(`[collector] candidate failed: ${reason}`);
          lastErr = e instanceof Error ? e : new Error(String(e));
          try { (this.bot as any).pathfinder.setGoal(null); } catch (err) {}
          continue;
        }
      } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : String(e);
        console.log(`[collector] candidate failed: ${reason}`);
        lastErr = e instanceof Error ? e : new Error(String(e));
        try { (this.bot as any).pathfinder.setGoal(null); } catch (err) {}
        continue;
      }
    }

    if (lastErr) {
      throw new Error('Failed to collect wood from available candidates');
    }

    throw new Error('Failed to collect wood from available candidates');
  }
}
