/* eslint-disable import/no-default-export */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "node_modules/@repo/db/src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
