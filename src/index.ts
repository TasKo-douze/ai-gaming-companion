#!/usr/bin/env node

import { AIEngine } from './core/AIEngine';
import { MinecraftAdapter } from './games/minecraft/MinecraftAdapter';

async function main() {
  // Entry point for the AI Gaming Companion.
  // Minimal startup for a first Minecraft connection test.

  const engine = new AIEngine();
  await engine.initialize();
  console.log('AI Gaming Companion initialized');

  // Create and connect the Minecraft bot for a quick smoke test.
  const mc = new MinecraftAdapter();
  try {
    await mc.connect({ host: 'localhost', port: 25565, username: 'AICompanion' });
    console.log('[minecraft] bot connected');

    // Graceful shutdown on SIGINT / SIGTERM
    const shutdown = async () => {
      console.log('Shutting down...');
      try {
        await mc.disconnect();
      } catch (e) {
        console.error('Error while disconnecting minecraft adapter', e);
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep the process alive; the adapter manages runtime events.
  } catch (err) {
    console.error('Failed to connect Minecraft bot', err);
    // Do not exit immediately to allow inspection; exit with non-zero code after short delay
    setTimeout(() => process.exit(1), 1000);
  }
}

main().catch(err => {
  console.error('Fatal error', err);
  process.exit(1);
});
