// 用 esbuild 打包 scripts/sim.ts 再用 node 跑
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync('.tmp', { recursive: true });
await build({
  entryPoints: ['scripts/sim.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: '.tmp/sim.mjs',
  logLevel: 'warning',
});
const which = process.argv[2] ?? 'all';
const runs = process.argv[3] ?? '3';
const r = spawnSync(process.execPath, ['.tmp/sim.mjs', which, runs], { stdio: 'inherit' });
process.exit(r.status ?? 0);
