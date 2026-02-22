import type { Logger } from "@repo/logger";

import { NewsJob } from "./news-job";

export type Job = {
  readonly name: string;
  readonly cron: string;
  run(): Promise<void>;
};

export class JobRegistry {
  private readonly jobs: Job[];

  constructor(logger: Logger) {
    this.jobs = [new NewsJob(logger)];
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
}
