// Cache "stale-while-revalidate" em memória do servidor.
//
// - Dado novo (< ttl): devolve na hora.
// - Dado velho mas aproveitável (< maxStale): devolve na hora e atualiza em segundo plano,
//   então a tela nunca espera a API do PipeRun quando já houve uma carga recente.
// - Sem dado ou muito velho: espera a carga (uma só, mesmo com várias telas pedindo).

interface Entry<T> {
  value: T;
  at: number;
}

export function createSwrCache<T>(ttlMs: number, maxStaleMs: number) {
  const store = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();

  function refresh(key: string, load: () => Promise<T>): Promise<T> {
    const running = inflight.get(key);
    if (running) return running;
    const promise = load()
      .then((value) => {
        store.set(key, { value, at: Date.now() });
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  return {
    async get(key: string, load: () => Promise<T>): Promise<T> {
      const hit = store.get(key);
      const age = hit ? Date.now() - hit.at : Infinity;
      if (hit && age < ttlMs) return hit.value;
      if (hit && age < maxStaleMs) {
        // Falha na atualização em segundo plano não pode derrubar quem já recebeu o dado.
        refresh(key, load).catch((error) => console.error("swr-cache refresh:", error));
        return hit.value;
      }
      return refresh(key, load);
    },
  };
}
