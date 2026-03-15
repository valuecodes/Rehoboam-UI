import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

export const reactConfig = defineConfig(
  {
    files: ["**/*.ts", "**/*.tsx"],
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat["jsx-runtime"],
    languageOptions: {
      ...reactPlugin.configs.flat.recommended?.languageOptions,
      ...reactPlugin.configs.flat["jsx-runtime"]?.languageOptions,
      globals: {
        React: "writable",
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- react-hooks always has this config
  reactHooks.configs.flat["recommended-latest"]!,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='React']",
          message:
            "Avoid `React.` namespace usage. Import the specific symbol instead.",
        },
        {
          selector: "TSQualifiedName[left.name='React']",
          message:
            "Avoid `React.` type namespace usage. Import the type directly instead.",
        },
        {
          selector: "JSXMemberExpression[object.name='React']",
          message:
            "Avoid `React.` namespace usage in JSX. Import the component instead.",
        },
      ],
      // React compiler rules are too strict for the current codebase
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  }
);
