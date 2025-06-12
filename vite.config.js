import { defineConfig } from 'vite'
import wasm from "vite-plugin-wasm";

export default defineConfig({
  base: "/static/editor/",
  build: {
    rollupOptions: {
      input: 'qlever_ui/main.ts',
      output: {
        entryFileNames: 'editor.js',
      },
    },
    outDir: './backend/static/editor/',
    assetsInlineLimit: 0,

  },
  assetsInclude: ["**/*yaml"],
  worker: {
    format: "es",
    plugins: () => [
      wasm(),
    ],

  }
})

