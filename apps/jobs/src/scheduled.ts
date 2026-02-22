import { Logger } from "@repo/logger";

import { JobRegistry } from "./jobs";

export const handleScheduled: ExportedHandlerScheduledHandler<Env> = async (
  controller,
  _env,
  _ctx
) => {
  const logger = new Logger({ context: "jobs" });
  const cron = controller.cron;

  logger.info("scheduled event received", { cron });

  const registry = new JobRegistry(logger);
  const jobs = registry.getJobsForCron(cron);

  if (jobs.length === 0) {
    logger.warn("no jobs registered for cron pattern", { cron });
    return;
  }

  const startTime = Date.now();

  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      const jobStart = Date.now();
      logger.info("starting job", { jobName: job.name });

      try {
        await job.run();
        logger.info("job completed", {
          jobName: job.name,
          durationMs: Date.now() - jobStart,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("job failed", {
          jobName: job.name,
          durationMs: Date.now() - jobStart,
          error: message,
        });
        throw error;
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failedJobs = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [jobs[index]?.name ?? `unknown-${index}`]
      : []
  );

  logger.info("scheduled run finished", {
    cron,
    total: jobs.length,
    succeeded,
    failed,
    durationMs: Date.now() - startTime,
  });

  if (failedJobs.length > 0) {
    logger.error("scheduled run failed", {
      cron,
      failedJobs,
    });
    throw new Error(`Scheduled jobs failed: ${failedJobs.join(", ")}`);
  }
};
