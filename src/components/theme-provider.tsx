import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "hublow-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

// Roda antes da hidratação (ver __root.tsx) pra decidir a classe .dark sem
// esperar o React montar — evita o flash de tema errado no load.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
  } catch (e) {}
})();
`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Sempre inicia como "light" pra bater com o className do <html> renderizado no
  // servidor (ver RootShell) — o valor real (já aplicado pelo THEME_INIT_SCRIPT
  // antes da primeira pintura) só é lido depois de montar, no efeito abaixo, pra
  // não causar mismatch de hidratação entre servidor e cliente.
  const [theme, setThemeState] = useState<Theme>("light");
  const skipNextPersist = useRef(true);

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  useEffect(() => {
    // O primeiro disparo só reflete o valor-placeholder de SSR ou a sincronização
    // com o que o THEME_INIT_SCRIPT já aplicou — nesses dois casos o DOM já está
    // correto, então não precisa reaplicar/persistir. Só grava a partir da
    // primeira mudança real (toggle do usuário).
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return ctx;
}
