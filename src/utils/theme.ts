/**
 * Dark mode: volgt standaard de systeemvoorkeur (prefers-color-scheme),
 * maar de gebruiker kan dit overschrijven met de toggle. Die keuze wordt
 * onthouden in localStorage; zolang er geen expliciete keuze is gemaakt,
 * blijft de app live meebewegen met wijzigingen in de systeeminstelling.
 *
 * Zie ook de blocking inline script in index.html, die dezelfde logica
 * vóór de eerste render toepast om een "flash" van de verkeerde stand
 * te voorkomen.
 */

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "theme";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getStoredTheme(): ThemeMode | null {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  return stored === "light" || stored === "dark" ? stored : null;
}

/** The theme currently in effect: the user's explicit choice, or the system preference. */
export function getEffectiveTheme(): ThemeMode {
  return getStoredTheme() ?? (systemPrefersDark() ? "dark" : "light");
}

/** Whether the user has manually overridden the system preference. */
export function hasThemeOverride(): boolean {
  return getStoredTheme() !== null;
}

function paint(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#14231A" : "#2563eb");
}

/** Explicitly set and persist a theme choice (used by the toggle button). */
export function setTheme(theme: ThemeMode) {
  window.localStorage.setItem(STORAGE_KEY, theme);
  paint(theme);
}

/** Forget the manual override and go back to following the system preference. */
export function useSystemTheme() {
  window.localStorage.removeItem(STORAGE_KEY);
  paint(systemPrefersDark() ? "dark" : "light");
}

/**
 * Applies the effective theme and keeps it in sync with system changes.
 * Call this once, as early as possible (see src/main.tsx).
 */
export function initTheme(): ThemeMode {
  const theme = getEffectiveTheme();
  paint(theme);

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (e: MediaQueryListEvent) => {
    // Only auto-follow the system when the user hasn't picked a theme themselves.
    if (!hasThemeOverride()) paint(e.matches ? "dark" : "light");
  };
  mq.addEventListener?.("change", handleChange);

  return theme;
}
