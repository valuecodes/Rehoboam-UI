import { StatsResponseSchema } from "@repo/types";
import type { StatsResponse } from "@repo/types";
import { useEffect, useState } from "react";

type StatsStatus = "loading" | "success" | "error";

type StatsState = Readonly<{
  data: StatsResponse | null;
  status: StatsStatus;
}>;

export const useStats = (): StatsState => {
  const [state, setState] = useState<StatsState>({
    data: null,
    status: "loading",
  });

  useEffect(() => {
    const abortController = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/stats", {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        const json: unknown = await response.json();
        const data = StatsResponseSchema.parse(json);

        if (!abortController.signal.aborted) {
          setState({ data, status: "success" });
        }
      } catch {
        if (!abortController.signal.aborted) {
          setState({ data: null, status: "error" });
        }
      }
    };

    void load();

    return () => {
      abortController.abort();
    };
  }, []);

  return state;
};
