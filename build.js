import * as esbuild from 'esbuild';

import packageJson from './package.json' with { type: 'json' };

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/migrate-project.cjs',
  platform: 'node',
  define: {
    'process.env.NPM_PACKAGE_VERSION': `'${packageJson.version}'`,
  },
});
