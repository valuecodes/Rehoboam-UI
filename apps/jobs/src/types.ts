export type JobsEnv = Omit<Env, "AI" | "CLOUDFLARE_API_TOKEN"> & {
  AI?: Ai;
  AI_ITEM_LIMIT?: string;
  CLOUDFLARE_API_TOKEN?: string;
  MOCK_AI?: string;
};
