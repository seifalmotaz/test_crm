import { createContext, useContext, useState, useLayoutEffect, type ReactNode } from "react";

interface ThemeContextValue {
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  accent: string;
  setAccent: (a: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const ACCENT_NAMES = ["blue", "violet", "emerald", "rose", "amber", "cyan"];
const ACCENT_KEY = "estate_crm_accent";
const THEME_KEY = "estate_crm_theme";

function applyAccent(a: string) {
  const root = document.documentElement;
  ACCENT_NAMES.forEach((c) => root.classList.remove(`accent-${c}`));
  if (a !== "red") root.classList.add(`accent-${a}`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem(THEME_KEY) || "dark";
    if (saved === "light") document.documentElement.classList.add("light");
    return saved as "dark" | "light";
  });

  const [accent, setAccentState] = useState(() => {
    const saved = localStorage.getItem(ACCENT_KEY) || "red";
    applyAccent(saved);
    return saved;
  });

  const setTheme = (t: "dark" | "light") => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  };

  const setAccent = (a: string) => {
    setAccentState(a);
    localStorage.setItem(ACCENT_KEY, a);
  };

  useLayoutEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  useLayoutEffect(() => {
    applyAccent(accent);
  }, [accent]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}