import vinext from 'vinext';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { sites } from './build/sites-vite-plugin';
import publicDefaults from './config/public-env.json';

export default defineConfig(async ({ mode }) => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= 'false';
  process.env.WRANGLER_SEND_METRICS ??= 'false';
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  const publicEnv = { ...publicDefaults, ...loadEnv(mode, process.cwd(), 'NEXT_PUBLIC_') };
  return {
    define: Object.fromEntries(Object.entries(publicEnv).map(([key, value]) => [
      `process.env.${key}`, JSON.stringify(value),
    ])),
    resolve: {
      alias: {
        // Keep route navigation reliable on the Sites worker until vinext's
        // RSC prefetch interception is compatible with the deployed runtime.
        'next/link': fileURLToPath(new URL('./src/lib/plain-link.tsx', import.meta.url)),
      },
    },
    plugins: [
      vinext(),
      sites({ mockAuth: false }),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
        config: {
          main: 'vinext/server/fetch-handler',
          compatibility_flags: ['nodejs_compat'],
          r2_buckets: [{ binding: 'PHOTOS', bucket_name: 'chantakorn-local-photos' }],
        },
      }),
    ],
  };
});
