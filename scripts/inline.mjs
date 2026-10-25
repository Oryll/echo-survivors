// 把 vite 产物打成一个可双击打开的 HTML（无服务器、无外部依赖）
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const assets = join(dist, 'assets');
const files = readdirSync(assets);
const jsFile = files.find((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));

if (!jsFile) throw new Error('找不到 JS 产物');

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = readFileSync(join(assets, jsFile), 'utf8');
const css = cssFile ? readFileSync(join(assets, cssFile), 'utf8') : '';

// 用函数作为替换值，避免 JS 里的 $& / $1 被 String.replace 解释成替换模式
html = html.replace(
  /<script[^>]*src="[^"]*"[^>]*><\/script>/g,
  () => '<script type="module">\n' + js + '\n</script>',
);
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, () => '<style>\n' + css + '\n</style>');

const out = join(dist, '回响幸存者.html');
writeFileSync(out, html, 'utf8');
// 同时输出一份纯 ASCII 文件名，方便 bat / 命令行打开
const outAscii = join(dist, 'echo-survivors.html');
writeFileSync(outAscii, html, 'utf8');
console.log('single file ->', out, (html.length / 1024).toFixed(0) + ' KB');
console.log('ascii copy  ->', outAscii);
