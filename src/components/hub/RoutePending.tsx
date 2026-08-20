import { Loader2 } from "lucide-react";

/** Mostrado enquanto o código/dados da rota de destino ainda estão carregando (ex: 1º
 * clique numa página com o chunk JS ainda não baixado) — sem isso, a troca de rota
 * ficava em branco por um instante antes do conteúdo aparecer. */
export function RoutePending() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
