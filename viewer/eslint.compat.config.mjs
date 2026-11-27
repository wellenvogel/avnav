import globals from "globals";
import tseslint from "typescript-eslint";
import pluginCompat from "eslint-plugin-compat";
import reactPlugin from "eslint-plugin-react";

export default [
  {
    files: [
      "App.jsx",
      "avnav_viewer.js",
      "api/**/*.{js,jsx,ts,tsx}",
      "components/**/*.{js,jsx,ts,tsx}",
      "gui/**/*.{js,jsx,ts,tsx}",
      "hoc/**/*.{js,jsx,ts,tsx}",
      "map/**/*.{js,jsx,ts,tsx}",
      "nav/**/*.{js,jsx,ts,tsx}",
      "util/**/*.{js,jsx,ts,tsx}"
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {jsx: true}
      },
      globals: globals.browser
    },
    plugins: {
      compat: pluginCompat,
      react: reactPlugin,
      "@typescript-eslint": tseslint.plugin
    },
    rules: {
      "compat/compat": "error"
    }
  }
];
