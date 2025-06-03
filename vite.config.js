import { defineConfig } from 'vite'
import wasm from "vite-plugin-wasm";

export default defineConfig({
	base: "/static/editor/",
	build: {
		rollupOptions: {
			input: 'monaco_editor/main.ts',
			output: {
				entryFileNames: 'editor.js'
			},
		},
		outDir: './backend/static/editor/',
		emptyOutDir: false,
		assetsInlineLimit: 0,

	},
	worker: {
		format: "es",
		plugins: () => [
			wasm(),
		],

	},
})

