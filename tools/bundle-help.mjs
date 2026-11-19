// 打包文字求助正式版資料介面（含 Firebase SDK）→ src/apps/help-fb.bundle.js
// 用法：在含 firebase、esbuild 套件的環境執行  node tools/bundle-help.mjs <node_modules 所在資料夾>
import path from 'node:path';
import { createRequire } from 'node:module';
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const modDir = path.resolve(process.argv[2] || ROOT);
const require = createRequire(path.join(modDir, 'package.json'));
const esbuild = require('esbuild');
const pkg = require('firebase/package.json');
await esbuild.build({
  entryPoints: [path.join(ROOT, 'src/apps/help-fb.mjs')],
  outfile: path.join(ROOT, 'src/apps/help-fb.bundle.js'),
  bundle: true, minify: true, format: 'iife', target: ['es2019'], legalComments: 'eof',
  nodePaths: [path.join(modDir, 'node_modules')],
  banner: { js: `/* 大日開發 文字求助 正式版資料介面；內含 Firebase JS SDK ${pkg.version}（Apache-2.0） */` }
});
console.log('bundled firebase', pkg.version);
