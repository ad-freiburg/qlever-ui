// ┌─────────────────────────────────┐ \\
// │ Copyright © 2025 Ioannis Nezis  │ \\
// ├─────────────────────────────────┤ \\
// │ Licensed under the MIT license. │ \\
// └─────────────────────────────────┘ \\

import { init } from "./monaco_editor/editor.ts"
import { setup_buttons } from "./buttons.ts";

init("editor").then((wrapper) => {
	setup_buttons(wrapper);
}).catch((err) => {
	console.error("Monaco-editor initialization failed:\n", err);
})

