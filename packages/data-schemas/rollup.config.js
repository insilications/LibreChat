import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import swc from '@rollup/plugin-swc';
import path from 'path';
import alias from '@rollup/plugin-alias';

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.es.js',
      format: 'es',
      sourcemap: true,
    },
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
  ],
  plugins: [
    // Automatically externalize peer dependencies
    peerDepsExternal(),
    alias({
      entries: [
        { find: '~', replacement: path.resolve(__dirname, 'src') }
      ]
    }),
    // Resolve modules from node_modules
    resolve({
      preferBuiltins: true,
      extensions: ['.mjs', '.js', '.json', '.node', '.ts']
    }),
    // Convert CommonJS modules to ES6
    commonjs({
      esmExternals: true,
      requireReturnsDefault: 'auto',
    }),
    // Allow importing JSON files
    json(),
    swc({
      // Explicitly point to the tsconfig.json file
      tsconfig: './tsconfig.json',
    }),
  ],
  // Do not bundle these external dependencies
  external: ['mongoose'],
};
