/* eslint-disable import/no-default-export */
import { baseConfig } from "@repo/eslint/base";
import { defineConfig } from "eslint/config";

export default defineConfig(baseConfig, {
  ignores: ["worker-configuration.d.ts", ".wrangler/"],
});
