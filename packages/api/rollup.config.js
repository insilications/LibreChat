// rollup.config.js
import { readFileSync } from 'fs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import swc from '@rollup/plugin-swc';
import alias from '@rollup/plugin-alias';
import path from 'path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const plugins = [
  peerDepsExternal(),
  alias({
    entries: [
      { find: '~', replacement: path.resolve(__dirname, 'src') }
    ]
  }),
  resolve({
    preferBuiltins: true,
    extensions: ['.mjs', '.js', '.json', '.node', '.ts']
  }),
  replace({
    __IS_DEV__: process.env.NODE_ENV === 'development',
    preventAssignment: true,
  }),
  commonjs({
    transformMixedEsModules: true,
    requireReturnsDefault: 'auto',
  }),
  json(),
  swc({
    // Explicitly point to the tsconfig.json file
    tsconfig: './tsconfig.json',
  }),
  terser(),
];

const cjsBuild = {
  input: 'src/index.ts',
  output: {
    dir: 'dist',
    format: 'cjs',
    sourcemap: true,
    exports: 'named',
    entryFileNames: '[name].js',
  },
  external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})],
  preserveSymlinks: true,
  plugins,
};

export default cjsBuild;
