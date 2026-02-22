import { handleScheduled } from "../scheduled";

const { getJobsForCronMock } = vi.hoisted(() => ({
  getJobsForCronMock: vi.fn(),
}));

vi.mock("@repo/logger", () => ({
  Logger: class {
    info = vi.fn();
    warn = vi.fn();
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
  beforeEach(() => {
    getJobsForCronMock.mockReset();
  });

  it("completes when all jobs succeed", async () => {
    const runNews = vi.fn().mockResolvedValue(undefined);
    const runDigest = vi.fn().mockResolvedValue(undefined);
    const jobs: TestJob[] = [
      { name: "news", cron: "0 */6 * * *", run: runNews },
      { name: "digest", cron: "0 */6 * * *", run: runDigest },
    ];

    getJobsForCronMock.mockReturnValue(jobs);

    await expect(
      handleScheduled(
        createController("0 */6 * * *"),
        {} as Env,
        {} as ExecutionContext
      )
    ).resolves.toBeUndefined();
    expect(runNews).toHaveBeenCalledOnce();
    expect(runDigest).toHaveBeenCalledOnce();
  });

  it("throws when one or more jobs fail", async () => {
    const runSuccess = vi.fn().mockResolvedValue(undefined);
    const runFailure = vi.fn().mockRejectedValue(new Error("job failed"));
    const jobs: TestJob[] = [
      { name: "news", cron: "0 */6 * * *", run: runSuccess },
      { name: "failing-job", cron: "0 */6 * * *", run: runFailure },
    ];

    getJobsForCronMock.mockReturnValue(jobs);

    await expect(
      handleScheduled(
        createController("0 */6 * * *"),
        {} as Env,
        {} as ExecutionContext
      )
    ).rejects.toThrow("Scheduled jobs failed: failing-job");
    expect(runSuccess).toHaveBeenCalledOnce();
    expect(runFailure).toHaveBeenCalledOnce();
  });
});
