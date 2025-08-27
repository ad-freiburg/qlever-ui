import resolve from '@rollup/plugin-node-resolve';
import { wasm } from '@rollup/plugin-wasm';

export default [
	{
		input: './formatter/index.js', // Entry point for your app
		output: {
			dir: './backend/static/wasm/formatter/',
			format: 'esm',
		},
		plugins: [
			resolve(),
			wasm({
				maxFileSize: 0, // Set to 0 to always load as separate files
				publicPath: "/static/wasm/formatter/"
			}
			),
		]
	},
	{
		input: './panzoom/index.js', // Entry point for panzoom
		output: {
			file: './backend/static/js/panzoom.js',
			format: 'esm',
		},
		plugins: [
			resolve(),
		]
	}
];
