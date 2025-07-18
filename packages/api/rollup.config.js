// rollup.config.js
import { readFileSync } from 'fs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
// import typescript from '@rollup/plugin-typescript';
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
  // typescript({
  //   tsconfig: './tsconfig.json',
  //   outDir: './dist',
  //   sourceMap: true,
  //   inlineSourceMap: true,
  // }),
  json(),
  swc({
    // Explicitly point to the tsconfig.json file
    tsconfig: './tsconfig.json',

    // // You can still override any options from tsconfig.json here
    // // For example, to ensure a specific module format for Rollup's tree-shaking
    // jsc: {
    //   parser: {
    //     syntax: 'typescript',
    //   },
    //   // Override the 'target' from tsconfig.json if needed
    //   // target: 'es2020',
    // },
    // module: {
    //   // SWC's module options are separate and important for Rollup
    //   type: 'es6',
    // }
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
  // external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})],
  external: [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {}), ...Object.keys(pkg.peerDependencies || {})],
  preserveSymlinks: true,
  plugins,
};

export default cjsBuild;
