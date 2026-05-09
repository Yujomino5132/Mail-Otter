import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const apiSrcPath = fileURLToPath(new URL('./apps/api/src', import.meta.url));
const sharedSrcPath = fileURLToPath(new URL('./packages/shared/src', import.meta.url));
const cloudflareWorkersMockPath = fileURLToPath(new URL('./test/mocks/cloudflare-workers.ts', import.meta.url));
const cloudflareWorkflowsMockPath = fileURLToPath(new URL('./test/mocks/cloudflare-workflows.ts', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: [
      { find: '@/constants', replacement: `${apiSrcPath}/constants` },
      { find: '@/schema', replacement: `${apiSrcPath}/schema` },
      { find: '@/error', replacement: `${apiSrcPath}/error` },
      { find: '@/utils', replacement: `${apiSrcPath}/utils` },
      { find: '@mail-otter/shared', replacement: sharedSrcPath },
      { find: 'cloudflare:workers', replacement: cloudflareWorkersMockPath },
      { find: 'cloudflare:workflows', replacement: cloudflareWorkflowsMockPath },
      { find: /^@\//, replacement: `${apiSrcPath}/` },
    ],
  },
});
