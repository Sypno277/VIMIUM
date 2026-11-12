// Flat ESLint config (ESLint 9). The rules mirror the ones the plan calls out
// as non-negotiable: no `any`, no import cycles, ordered imports.
import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "src/chrome.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    plugins: { import: importPlugin },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "import/order": [
        "warn",
        { "newlines-between": "always", alphabetize: { order: "asc" } },
      ],
      "import/no-cycle": "error",
      "no-console": ["warn", { allow: ["warn", "error", "info", "debug"] }],
    },
  },
);
