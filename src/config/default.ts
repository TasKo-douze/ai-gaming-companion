/**
 * Default configuration values.
 */
export const defaultConfig = {
  game: {
    minecraft: {
      host: 'localhost',
      port: 25565,
      username: 'AICompanion'
    }
  },
  memory: {
    path: 'database/memory.db'
  },
  ai: {
    provider: 'openai'
  }
};
