import { Bot } from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import mcDataLib from 'minecraft-data';
import { Vec3 } from 'vec3';

export class MinecraftResourceCollector {
  private bot: Bot;
  private navigator?: any;
  private cancelled: boolean = false;

  constructor(bot: Bot, navigator?: any) {
    this.bot = bot;
    this.navigator = navigator;
  }

  private async waitUntilNear(position: { x: number; y: number; z: number }, range = 1.5, timeoutMs = 30000): Promise<void> {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      const iv = setInterval(() => {
        try {
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
        } catch (e) {
          clearInterval(iv);
          reject(e as Error);
        }
      }, 300);
    });
  }

  private floorVec(pos: any): Vec3 {
    return new Vec3(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  }

  private findWoodCandidates(maxDistance = 16): any[] {
    const mcData = mcDataLib(this.bot.version as string);

    const allowedIds: number[] = [];
    for (const b of Object.values(mcData.blocks) as any[]) {
      if (!b || typeof b !== 'object') continue;
      const name: string = String(b.name || '').toLowerCase();
      if (/leaf|leaves?/i.test(name)) continue;
      if (/(log|wood|stem|trunk)/i.test(name)) {
        if (typeof b.id === 'number') allowedIds.push(b.id);
      }
    }

    if (!allowedIds.length) return [];

    const positions = (this.bot as any).findBlocks({
      matching: allowedIds,
      maxDistance,
      count: 100,
    }) as { x: number; y: number; z: number }[];

    if (!positions || !positions.length) return [];

    const blocks = positions
      .map(pos => (this.bot as any).blockAt(this.floorVec(pos)))
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

  private async withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    try {
      const res = await Promise.race([promise, timeoutPromise]);
      if (timer) clearTimeout(timer);
      return res as T;
    } catch (e) {
      if (timer) clearTimeout(timer);
      throw e;
    }
  }

  private cleanupNavigation(): void {
    try {
      if ((this.bot as any).pathfinder) {
        try {
          if (typeof (this.bot as any).pathfinder.stop === 'function') {
            (this.bot as any).pathfinder.stop();
          }
        } catch (e) {
          // ignore
        }
        try {
          (this.bot as any).pathfinder.setGoal(null);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      if (typeof (this.bot as any).stopDigging === 'function') {
        try { (this.bot as any).stopDigging(); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      // ignore
    }
  }

  cancel(): void {
    this.cancelled = true;
    try {
      if (typeof (this.bot as any).stopDigging === 'function') {
        try { (this.bot as any).stopDigging(); } catch (e) { /* ignore */ }
      }
    } catch (e) {}
    this.cleanupNavigation();
  }

  async collectWood(username?: string): Promise<void> {
    if (!this.bot) throw new Error('Bot not initialized');
    this.cancelled = false;

    const candidates = this.findWoodCandidates(16);
    console.log(`[collector] found ${candidates.length} wood candidates`);
    if (!candidates.length) {
      throw new Error('No wood found nearby');
    }

    const sorted = candidates
      .slice()
      .sort((a: any, b: any) => {
        const da = this.distanceSqToBot(a.position);
        const db = this.distanceSqToBot(b.position);
        if (da !== db) return da - db;
        return a.position.y - b.position.y;
      });

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
      if (this.cancelled) break;
      try {
        const mcData = mcDataLib(this.bot.version as string);
        const name = (mcData.blocks as any)[blk.type]?.name || 'unknown';
        console.log(`[collector] trying wood block ${name} at ${blk.position.x},${blk.position.y},${blk.position.z}`);

        const distSq = this.distanceSqToBot(blk.position);
        const dist = Math.sqrt(distSq);
        console.log(`[collector] distance to wood block: ${dist.toFixed(2)}`);
        // if too far even after moving, skip
        if (dist > 6) {
          console.log('[collector] candidate too far, skipping');
          continue;
        }

        const botY = this.bot.entity?.position?.y ?? 0;
        if (blk.position.y - botY > 4) {
          console.log('[collector] candidate too high, skipping');
          continue;
        }

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
          const py = blk.position.y;
          const blockBelow = (this.bot as any).blockAt(this.floorVec({ x: px, y: py - 1, z: pz }));
          const blockAtFeet = (this.bot as any).blockAt(this.floorVec({ x: px, y: py, z: pz }));
          const blockHead = (this.bot as any).blockAt(this.floorVec({ x: px, y: py + 1, z: pz }));
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

        try {
          console.log('[collector] moving near wood block');
          const goal = new goals.GoalNear(standPos.x, standPos.y, standPos.z, 1);
          (this.bot as any).pathfinder.setGoal(goal, true);
          await this.waitUntilNear(standPos, 1.5, 30000);
        } catch (e) {
          console.log('[collector] failed to move to candidate, skipping');
          this.cleanupNavigation();
          continue;
        }

        if (this.cancelled) break;

        const fresh = (this.bot as any).blockAt(this.floorVec(blk.position));
        if (!fresh || fresh.type === 0) {
          console.log('[collector] candidate disappeared, trying next');
          this.cleanupNavigation();
          continue;
        }

        const freshName = (mcDataLib(this.bot.version as string).blocks as any)[fresh.type]?.name || 'unknown';
        if (/leaf|leaves?/i.test(String(freshName))) {
          console.log('[collector] candidate is leaves, skipping');
          this.cleanupNavigation();
          continue;
        }

        if (typeof (this.bot as any).canDigBlock === 'function') {
          const canDig = (this.bot as any).canDigBlock(fresh);
          console.log(`[collector] canDigBlock: ${canDig}`);
          if (!canDig) {
            console.log('[collector] cannot dig this block, skipping');
            this.cleanupNavigation();
            continue;
          }
        } else {
          console.log('[collector] canDigBlock: unknown');
        }

        // final distance check
        const afterDist = Math.sqrt(this.distanceSqToBot(fresh.position));
        console.log(`[collector] distance to wood block: ${afterDist.toFixed(2)}`);
        if (afterDist > 4) {
          console.log('[collector] still too far to dig, skipping');
          this.cleanupNavigation();
          continue;
        }

        // lookAt
        try {
          console.log('[collector] lookAt wood block');
          await (this.bot as any).lookAt(fresh.position.offset(0.5, 0.5, 0.5), true);
          // brief pause to allow look to settle
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          console.log('[collector] lookAt failed, skipping candidate');
          this.cleanupNavigation();
          continue;
        }

        if (this.cancelled) break;

        // dig with timeout
        try {
          console.log('[collector] dig started');
          const digPromise = new Promise<void>((resolve, reject) => {
            this.bot.dig(fresh, true, (err: Error | null) => {
              if (err) return reject(err);
              resolve();
            });
          });

          await this.withTimeout(digPromise, 10000, 'dig wood block');
          console.log('[collector] dig finished');

          const after = (this.bot as any).blockAt(this.floorVec(fresh.position));
          if (!after || after.type === 0) {
            this.cleanupNavigation();
            console.log('[collector] wood block collected');
            return;
          } else {
            console.log('[collector] wood block still present after dig');
            lastErr = new Error('Block still present after dig');
            this.cleanupNavigation();
            continue;
          }
        } catch (e: unknown) {
          const err = e instanceof Error ? e : new Error(String(e));
          const msg = err.message || String(err);
          if (msg.includes('timed out')) {
            console.log('[collector] dig timed out');
          } else {
            console.log(`[collector] dig error: ${msg}`);
          }
          // attempt to stop digging and cleanup
          try {
            if (typeof (this.bot as any).stopDigging === 'function') {
              try { (this.bot as any).stopDigging(); } catch (err) { /* ignore */ }
            }
          } catch (err) {}
          this.cleanupNavigation();
          lastErr = err instanceof Error ? err : new Error(String(err));
          continue;
        } finally {
          // defensive cleanup for candidate
          try { this.cleanupNavigation(); } catch (e) { /* ignore */ }
        }
      } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : String(e);
        console.log(`[collector] candidate failed: ${reason}`);
        lastErr = e instanceof Error ? e : new Error(String(e));
        try { this.cleanupNavigation(); } catch (err) { /* ignore */ }
        continue;
      }
    }

    if (lastErr) {
      throw new Error('Failed to collect wood from available candidates');
    }

    throw new Error('Failed to collect wood from available candidates');
  }
}
