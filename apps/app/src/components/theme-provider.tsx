import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | null>(null);

function getSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredTheme(storageKey: string): Theme | null {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === "dark" || stored === "light" || stored === "system"
      ? stored
      : null;
  } catch {
    return null;
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "rune-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => readStoredTheme(storageKey) ?? defaultTheme,
  );
  const [systemTheme, setSystemTheme] = useState<"dark" | "light">(() =>
    getSystemTheme(),
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(getSystemTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  const value = useMemo<ThemeProviderState>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next: Theme) => {
        try {
          localStorage.setItem(storageKey, next);
        } catch {
          // storage unavailable (private mode) — theme still applies in-memory
        }
        setThemeState(next);
      },
    }),
    [theme, resolvedTheme, storageKey],
  );

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
