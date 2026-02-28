import type { Logger } from "@repo/logger";

import { AiClient } from "../clients/ai-client";
import { DatabaseClient } from "../clients/database-client";
import { MockAiClient } from "../clients/mock-ai-client";
import type { JobsEnv } from "../types";
import { NewsJob } from "./news-job";

export type Job = {
  readonly name: string;
  readonly cron: string;
  run(): Promise<void>;
};

export class JobRegistry {
  private readonly jobs: Job[];

  constructor(logger: Logger, env: JobsEnv) {
    const db = new DatabaseClient(env.DB, logger);
    const ai =
      env.MOCK_AI === "true" || env.AI === undefined
        ? new MockAiClient(logger)
        : new AiClient(env.AI, logger);
    const aiItemLimit = this.parseAiItemLimit(env.AI_ITEM_LIMIT);

    this.jobs = [new NewsJob(logger, db, ai, aiItemLimit)];
  }

  getJobsForCron(cron: string): Job[] {
    return this.jobs.filter((job) => job.cron === cron);
  }

  getJobByName(name: string): Job | undefined {
    return this.jobs.find((job) => job.name === name);
  }

  getAllJobs(): Job[] {
    return [...this.jobs];
  }

  private parseAiItemLimit(value: string | undefined): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return undefined;
    }

    return parsed;
  }
}
