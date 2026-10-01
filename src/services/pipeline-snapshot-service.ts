import { createServerFn } from "@tanstack/react-start";

import { loadHubSnapshot, type HubSnapshot } from "@/lib/pipeline-snapshot";
import { requireSessionUser } from "@/lib/session";

import { createSwrCache } from "@/lib/swr-cache";

const cache = createSwrCache<HubSnapshot | null>(60_000, 20 * 60_000);

/** Retrato de todos os funis do PipeRun, fase a fase (só negócios abertos). */
export const getHubSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<HubSnapshot | null> => {
    await requireSessionUser();
    return cache.get("snapshot", loadHubSnapshot);
  },
);
