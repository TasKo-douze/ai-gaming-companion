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
        try { (this.bot as any).pathfinder.setGoal(null); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof (this.bot as any).stopDigging === 'function') {
        try { (this.bot as any).stopDigging(); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
  }

  cancel(): void {
    this.cancelled = true;
    try {
      if (typeof (this.bot as any).stopDigging === 'function') {
        try { (this.bot as any).stopDigging(); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
    this.cleanupNavigation();
  }

  private isLogBlock(block: any): boolean {
    try {
      if (!block || !block.type) return false;
      const mcData = mcDataLib(this.bot.version as string);
      const name = (mcData.blocks as any)[block.type]?.name || '';
      if (!name) return false;
      return /log|wood|stem|trunk/i.test(String(name)) && !/leaf|leaves?/i.test(String(name));
    } catch (e) {
      return false;
    }
  }

  private async waitUntilBlockRemoved(position: { x: number; y: number; z: number }, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    const mcData = mcDataLib(this.bot.version as string);
    return new Promise<boolean>((resolve) => {
      const iv = setInterval(() => {
        try {
          const b = (this.bot as any).blockAt(this.floorVec(position));
          if (!b || b.type === 0) {
            clearInterval(iv);
            resolve(true);
            return;
          }
          const name = (mcData.blocks as any)[b.type]?.name || '';
          if (!name || /leaf|leaves?/i.test(name)) {
            // not a log
            clearInterval(iv);
            resolve(true);
            return;
          }
          if (Date.now() - start > timeoutMs) {
            clearInterval(iv);
            resolve(false);
            return;
          }
        } catch (e) {
          clearInterval(iv);
          resolve(false);
          return;
        }
      }, 200);
    });
  }

  private async digBlockWithVerification(block: any, timeoutMs: number): Promise<boolean> {
    if (!block || !block.position) return false;
    const pos = this.floorVec(block.position);
    // reload fresh block
    const fresh = (this.bot as any).blockAt(pos);
    if (!fresh || fresh.type === 0) return false;
    if (!this.isLogBlock(fresh)) return false;

    try {
      console.log('[collector] dig promise started');
      // look at block
      try { await (this.bot as any).lookAt(fresh.position.offset(0.5, 0.5, 0.5), true); } catch (e) { /* ignore */ }

      // create dig promise (callback-based)
      const digPromise = new Promise<string>((resolve, reject) => {
        try {
          this.bot.dig(fresh, true, (err: Error | null) => {
            if (err) return reject(err);
            resolve('dig-resolved');
          });
        } catch (e) {
          reject(e);
        }
      });

      // create disappeared watcher
      const disappearedPromise = (async () => {
        const removed = await this.waitUntilBlockRemoved(pos, timeoutMs);
        if (removed) return 'block-disappeared';
        throw new Error('waitUntilBlockRemoved timed out');
      })();

      // global timeout
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('dig global timeout')), timeoutMs);
      });

      let result: string;
      try {
        result = await Promise.race([digPromise, disappearedPromise, timeoutPromise]);
      } catch (e) {
        // timeout or dig error
        const err = e instanceof Error ? e : new Error(String(e));
        if (err.message && err.message.includes('timed out')) console.log('[collector] dig global timeout');
        else console.log(`[collector] dig error: ${err.message}`);
        try { if (typeof (this.bot as any).stopDigging === 'function') (this.bot as any).stopDigging(); } catch (ee) {}
        this.cleanupNavigation();
        return false;
      }

      if (result === 'block-disappeared') {
        console.log('[collector] block disappeared during dig');
        // ensure stop digging if still digging
        try { if (typeof (this.bot as any).stopDigging === 'function') (this.bot as any).stopDigging(); } catch (ee) {}
        this.cleanupNavigation();
        console.log('[collector] block successfully removed');
        return true;
      }

      if (result === 'dig-resolved') {
        console.log('[collector] dig promise resolved');
        // double check block
        const after = (this.bot as any).blockAt(pos);
        if (!after || after.type === 0 || !this.isLogBlock(after)) {
          this.cleanupNavigation();
          console.log('[collector] block successfully removed');
          return true;
        }
        // still present
        console.log('[collector] dig resolved but block still present');
        this.cleanupNavigation();
        return false;
      }

      // fallback
      this.cleanupNavigation();
      return false;
    } finally {
      // defensive cleanup
    }
  }

  // BFS to find connected logs starting at startBlock (limit by maxBlocks, radius, vertical distance)
  private findConnectedLogs(startBlock: any, maxBlocks = 5, maxSearchRadius = 4, maxVerticalDistance = 6): any[] {
    const startPos = startBlock.position;
    const startKey = `${Math.floor(startPos.x)},${Math.floor(startPos.y)},${Math.floor(startPos.z)}`;

    const mcData = mcDataLib(this.bot.version as string);
    const isLogName = (name: string) => /log|wood|stem|trunk/i.test(name);

    const visited = new Set<string>();
    const results: any[] = [];
    const queue: any[] = [startBlock];

    visited.add(startKey);

    const sqRadius = maxSearchRadius * maxSearchRadius;

    while (queue.length && results.length < maxBlocks) {
      const blk = queue.shift();
      if (!blk || !blk.position) continue;
      const bx = Math.floor(blk.position.x);
      const by = Math.floor(blk.position.y);
      const bz = Math.floor(blk.position.z);

      if (Math.abs(by - Math.floor(startPos.y)) > maxVerticalDistance) continue;

      const dx = bx - Math.floor(startPos.x);
      const dz = bz - Math.floor(startPos.z);
      if (dx * dx + dz * dz > sqRadius) continue;

      const name = (mcData.blocks as any)[blk.type]?.name || '';
      if (!name || !isLogName(String(name))) continue;

      const key = `${bx},${by},${bz}`;
      if (!visited.has(key)) visited.add(key);
      if (!results.find(r => Math.floor(r.position.x) === bx && Math.floor(r.position.y) === by && Math.floor(r.position.z) === bz)) {
        results.push(blk);
      }

      const neighOffsets = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
      ];

      for (const off of neighOffsets) {
        const nx = bx + off.x;
        const ny = by + off.y;
        const nz = bz + off.z;
        const nkey = `${nx},${ny},${nz}`;
        if (visited.has(nkey)) continue;
        visited.add(nkey);
        const neighbor = (this.bot as any).blockAt(new Vec3(nx, ny, nz));
        if (!neighbor || !neighbor.type) continue;
        const nname = (mcData.blocks as any)[neighbor.type]?.name || '';
        if (!nname) continue;
        if (/leaf|leaves?/i.test(nname)) continue; // skip leaves
        if (!isLogName(String(nname))) continue;
        // add to queue
        queue.push(neighbor);
      }
    }

    const unique = results
      .map((r: any) => ({
        pos: { x: Math.floor(r.position.x), y: Math.floor(r.position.y), z: Math.floor(r.position.z) },
        block: r,
      }))
      .slice(0, maxBlocks);

    return unique.map(u => u.block);
  }

  async collectWood(username?: string): Promise<number> {
    if (!this.bot) throw new Error('Bot not initialized');
    this.cancelled = false;

    const candidates = this.findWoodCandidates(16);
    console.log(`[collector] found ${candidates.length} wood candidates`);
    if (!candidates.length) {
      throw new Error('No wood found nearby');
    }

    let root: any | null = null;
    for (const blk of candidates) {
      if (this.cancelled) break;
      const mcData = mcDataLib(this.bot.version as string);
      const name = (mcData.blocks as any)[blk.type]?.name || 'unknown';
      const dist = Math.sqrt(this.distanceSqToBot(blk.position));
      if (dist > 6) continue;
      const botY = this.bot.entity?.position?.y ?? 0;
      if (blk.position.y - botY > 4) continue;
      const fresh = (this.bot as any).blockAt(this.floorVec(blk.position));
      if (!fresh || fresh.type === 0) continue;
      const freshName = (mcData.blocks as any)[fresh.type]?.name || '';
      if (/leaf|leaves?/i.test(freshName)) continue;
      if (typeof (this.bot as any).canDigBlock === 'function') {
        try {
          const canDig = (this.bot as any).canDigBlock(fresh);
          if (!canDig) continue;
        } catch (e) { /* ignore, assume diggable */ }
      }
      root = fresh;
      break;
    }

    if (!root) throw new Error('No accessible log found');

    const rootPos = { x: Math.floor(root.position.x), y: Math.floor(root.position.y), z: Math.floor(root.position.z) };
    console.log(`[collector] selected tree root at ${rootPos.x},${rootPos.y},${rootPos.z}`);

    const connected = this.findConnectedLogs(root, 5, 4, 6);
    console.log(`[collector] connected logs found: ${connected.length}`);
    if (!connected.length) throw new Error('No connected logs found');

    connected.sort((a: any, b: any) => {
      const ay = Math.floor(a.position.y);
      const by = Math.floor(b.position.y);
      if (ay !== by) return ay - by;
      const da = this.distanceSqToBot(a.position);
      const db = this.distanceSqToBot(b.position);
      return da - db;
    });

    try {
      if (!(this.bot as any).pathfinder) { (this.bot as any).loadPlugin(pathfinder); }
      const mcData = mcDataLib(this.bot.version as string);
      const movements = new Movements(this.bot, mcData);
      (this.bot as any).pathfinder.setMovements(movements);
    } catch (e) { /* ignore */ }

    let successCount = 0;
    let lastErr: Error | null = null;

    for (const blk of connected) {
      if (this.cancelled) break;
      try {
        const bx = Math.floor(blk.position.x);
        const by = Math.floor(blk.position.y);
        const bz = Math.floor(blk.position.z);
        const mcData = mcDataLib(this.bot.version as string);
        const name = (mcData.blocks as any)[blk.type]?.name || 'unknown';
        console.log(`[collector] cutting connected log ${name} at ${bx},${by},${bz}`);

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
          const px = bx + off.x;
          const pz = bz + off.z;
          const py = by;
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
          console.log('[collector] no stand position near connected log, skipping');
          this.cleanupNavigation();
          continue;
        }

        try {
          const goal = new goals.GoalNear(standPos.x, standPos.y, standPos.z, 1);
          (this.bot as any).pathfinder.setGoal(goal, true);
          await this.waitUntilNear(standPos, 1.5, 20000);
        } catch (e) {
          console.log('[collector] failed to move to connected log, skipping');
          this.cleanupNavigation();
          continue;
        }

        if (this.cancelled) break;

        const fresh = (this.bot as any).blockAt(this.floorVec(blk.position));
        if (!fresh || fresh.type === 0) {
          console.log('[collector] connected log disappeared, skipping');
          this.cleanupNavigation();
          continue;
        }

        if (typeof (this.bot as any).canDigBlock === 'function') {
          try {
            const canDig = (this.bot as any).canDigBlock(fresh);
            console.log(`[collector] canDigBlock: ${canDig}`);
            if (!canDig) {
              console.log('[collector] cannot dig this connected log, skipping');
              this.cleanupNavigation();
              continue;
            }
          } catch (e) { /* ignore */ }
        }

        // look and dig with timeout

        try {
          // Use robust dig that treats disappearance as success
          const ok = await this.digBlockWithVerification(fresh, 15000);
          if (ok) {
            successCount += 1;
            console.log(`[collector] collected block count: ${successCount}`);
            if (successCount >= 5) break;
            continue;
          } else {
            console.log('[collector] connected log not removed after dig, skipping');
            lastErr = new Error('Connected log not removed after dig');
            continue;
          }
        } catch (e: unknown) {
          const err = e instanceof Error ? e : new Error(String(e));
          console.log(`[collector] dig error for connected log: ${err.message}`);
          try { if (typeof (this.bot as any).stopDigging === 'function') (this.bot as any).stopDigging(); } catch (ee) {}
          this.cleanupNavigation();
          lastErr = err;
          continue;
        }
       }
       catch (e: unknown) {
         const reason = e instanceof Error ? e.message : String(e);
         console.log(`[collector] connected candidate failed: ${reason}`);
         lastErr = e instanceof Error ? e : new Error(String(e));
         try { this.cleanupNavigation(); } catch (ee) {}
         continue;
       }
     }
 
     console.log('[collector] collection finished');
 
     if (this.cancelled) {
       // interrupted by user
       return successCount;
     }
 
     if (successCount > 0) return successCount;
     if (lastErr) throw lastErr;
     throw new Error('Failed to collect wood from connected logs');
   }
 }
