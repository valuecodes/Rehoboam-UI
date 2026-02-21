import type { Logger } from "@repo/logger";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    logger: Logger;
    requestId: string;
  };
};
