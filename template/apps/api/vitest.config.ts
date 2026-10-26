import { defineConfig } from 'vitest/config';

// Run the agent kit from its TypeScript source, so tests need no build step.
const conditions = ['ai-saas-source'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
