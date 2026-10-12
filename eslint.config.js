import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["extension/coop.js", "node_modules/", "**/.wrangler/", "dist/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { globals: { ...globals.browser, __PUMP_WORKER_SOURCE__: "readonly" } },
  },
  {
    files: ["src/net/pump-worker.js", "src/net/queues.js"],
    languageOptions: { globals: globals.worker },
  },
  {
    files: ["relay/**/*.js"],
    languageOptions: { globals: { ...globals.serviceworker, WebSocketPair: "readonly" } },
  },
  {
    files: ["shared/**/*.js"],
    languageOptions: { globals: { crypto: "readonly", URL: "readonly", TextDecoder: "readonly" } },
  },
  {
    files: ["test/**/*.mjs", "scripts/**/*.mjs", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
