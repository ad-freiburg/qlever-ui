import { defineConfig } from 'vite'
import wasm from "vite-plugin-wasm";

export default defineConfig({
	base: "/static/editor/",
	build: {
		lib: {
			entry: 'monaco_editor/main.ts',
			name: 'Editor',
			fileName: 'editor',
			formats: ['es']
		},
		outDir: './backend/static/editor/',
		emptyOutDir: false
	},
	worker: {
		format: "es",
		plugins: () => [
			wasm(),
		]
	},
})

