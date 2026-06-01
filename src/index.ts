#!/usr/bin/env node

import { AIEngine } from './core/AIEngine';

async function main() {
  // Entry point for the AI Gaming Companion.
  // TODO: wire adapters, memory, and conversation providers.
  const engine = new AIEngine();
  await engine.initialize();
  console.log('AI Gaming Companion initialized');
}

main().catch(err => {
  console.error('Fatal error', err);
  process.exit(1);
});
