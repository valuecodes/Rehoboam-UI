/** @type {import("prettier").Config} */
const config = {
  trailingComma: "es5",
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
  importOrder: ["<THIRD_PARTY_MODULES>", "", "^~/.(.*)$", "", "^[./]"],
};

export default config;
