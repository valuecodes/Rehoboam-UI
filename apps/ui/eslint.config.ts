/* eslint-disable import/no-default-export */
import { baseConfig } from "@repo/eslint/base";
import { reactConfig } from "@repo/eslint/react";
import { defineConfig } from "eslint/config";

export default defineConfig(baseConfig, reactConfig);
