import { createFileRoute } from "@tanstack/react-router";

import { TvDashboard } from "@/components/hub/tv/TvDashboard";
import { displayName } from "@/lib/display-name";
import type { SessionUser } from "@/lib/user-role";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "hubLOw — Hub da Expansão" },
      {
        name: "description",
        content:
          "Painel ao vivo da expansão bLOw: leads, funil, campanhas e ligações — PipeRun, 3C+, Meta e Google Ads.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { user } = Route.useRouteContext();
  return <TvDashboard userName={displayName(user as SessionUser)} />;
}
