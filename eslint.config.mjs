import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "dist/", "reference/", ".cache/", "tests/foundry/screenshots/"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        foundry: "readonly",
        game: "readonly",
        CONFIG: "readonly",
        Hooks: "readonly",
        ui: "readonly",
        canvas: "readonly",
        CONST: "readonly",
        Roll: "readonly",
        ChatMessage: "readonly",
        Actor: "readonly",
        Item: "readonly",
        Handlebars: "readonly",
        loadTemplates: "readonly",
        fromUuid: "readonly",
        fromUuidSync: "readonly",
        Dialog: "readonly"
      }
    },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] }
  }
];
