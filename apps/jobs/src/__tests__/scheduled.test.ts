import { handleScheduled } from "../scheduled";

const { getJobsForCronMock, warnMock } = vi.hoisted(() => ({
  getJobsForCronMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock("@repo/logger", () => ({
  Logger: class {
    info = vi.fn();
    warn = warnMock;
    error = vi.fn();
    debug = vi.fn();
  },
}));

vi.mock("../jobs", () => ({
  JobRegistry: class {
    getJobsForCron = getJobsForCronMock;
  },
}));

type TestJob = {
  name: string;
  cron: string;
  run: () => Promise<void>;
};

const createController = (cron: string): ScheduledController =>
  ({ cron }) as unknown as ScheduledController;

describe("handleScheduled", () => {
  const cron = "0 */6 * * *";

  beforeEach(() => {
    getJobsForCronMock.mockReset();
    warnMock.mockReset();
  });

  it("completes when all jobs succeed", async () => {
    const runNews = vi.fn().mockResolvedValue(undefined);
    const runDigest = vi.fn().mockResolvedValue(undefined);
    const jobs: TestJob[] = [
      { name: "news", cron, run: runNews },
      { name: "digest", cron, run: runDigest },
    ];

    getJobsForCronMock.mockReturnValue(jobs);

    await expect(
      handleScheduled(createController(cron), {} as Env, {} as ExecutionContext)
    ).resolves.toBeUndefined();
    expect(runNews).toHaveBeenCalledOnce();
    expect(runDigest).toHaveBeenCalledOnce();
  });

  it("throws when one or more jobs fail", async () => {
    const runSuccess = vi.fn().mockResolvedValue(undefined);
    const runFailure = vi.fn().mockRejectedValue(new Error("job failed"));
    const jobs: TestJob[] = [
      { name: "news", cron, run: runSuccess },
      { name: "failing-job", cron, run: runFailure },
    ];

    getJobsForCronMock.mockReturnValue(jobs);

    await expect(
      handleScheduled(createController(cron), {} as Env, {} as ExecutionContext)
    ).rejects.toThrow("Scheduled jobs failed: failing-job");
    expect(runSuccess).toHaveBeenCalledOnce();
    expect(runFailure).toHaveBeenCalledOnce();
  });

  it("returns early when no jobs are registered", async () => {
    getJobsForCronMock.mockReturnValue([]);

    await expect(
      handleScheduled(createController(cron), {} as Env, {} as ExecutionContext)
    ).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalledWith(
      "no jobs registered for cron pattern",
      {
        cron,
      }
    );
  });
});
