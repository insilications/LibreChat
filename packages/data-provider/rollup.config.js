import resolve from '@rollup/plugin-node-resolve';
import pkg from './package.json';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import generatePackageJson from 'rollup-plugin-generate-package-json';
import swc from '@rollup/plugin-swc';

const plugins = [
  peerDepsExternal(),
  resolve({
    preferBuiltins: true,
    extensions: ['.mjs', '.js', '.json', '.node', '.ts']
  }),
  replace({
    __IS_DEV__: process.env.NODE_ENV === 'development',
    preventAssignment: true,
  }),
  commonjs(),
  swc({
    tsconfig: './tsconfig.json',
  }),
  terser(),
];

const subfolderPlugins = (folderName) => [
  ...plugins,
  generatePackageJson({
    baseContents: {
      name: `${pkg.name}/${folderName}`,
      private: true,
      main: '../index.js',
      module: './index.es.js', // Adjust to match the output file
      types: `../types/${folderName}/index.d.ts`, // Point to correct types file
    },
  }),
];

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      {
        file: pkg.module,
        format: 'esm',
        sourcemap: true,
        exports: 'named',
      },
    ],
    ...{
      external: [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
        'react',
        'react-dom',
      ],
      preserveSymlinks: true,
      plugins,
    },
  },
  // Separate bundle for react-query related part
  {
    input: 'src/react-query/index.ts',
    output: [
      {
        file: 'dist/react-query/index.es.js',
        format: 'esm',
        exports: 'named',
        sourcemap: true,
      },
    ],
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
      'react',
      'react-dom',
    ],
    preserveSymlinks: true,
    plugins: subfolderPlugins('react-query'),
  },
];
