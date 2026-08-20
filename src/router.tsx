import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePending } from "@/components/hub/RoutePending";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Preload o chunk/beforeLoad da rota ao passar o mouse no link, não só no clique —
    // sem isso, a 1ª visita a cada página no dia baixava o chunk JS só depois do
    // clique e ficava em branco por um instante (2º clique já vinha do cache e era
    // instantâneo — o "bug" que só aparecia "na primeira vez").
    defaultPreload: "intent",
    defaultPendingComponent: RoutePending,
    defaultPendingMs: 300,
    defaultPendingMinMs: 150,
  });

  return router;
};
