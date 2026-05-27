import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist", "src-tauri"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
    },
  },
  prettierConfig,
  {
    files: ["scripts/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: { console: "readonly", process: "readonly", fetch: "readonly", URLSearchParams: "readonly" } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  }
);
