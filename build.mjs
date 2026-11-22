// Construction : node build.mjs [--watch]
import * as esbuild from 'esbuild';
const watch = process.argv.includes('--watch');
const opts = {
  entryPoints: { texte: 'src/word/main.js', presentation: 'src/pres/main.js', tableur: 'src/calc/main.js', bureau: 'src/bureau/main.js' },
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  minify: !watch,
  sourcemap: true,
  target: ['chrome100', 'firefox100', 'safari15'],
  legalComments: 'none',
  // polices intégrées : copiées à côté des bundles (dist/), sans sous-dossier
  loader: { '.woff2': 'file' },
  assetNames: '[name]-[hash]',
  logLevel: 'info',
};
if (watch) { const ctx = await esbuild.context(opts); await ctx.watch(); }
else await esbuild.build(opts);
