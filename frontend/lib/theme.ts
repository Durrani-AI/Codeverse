export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "codeverse-theme";

export function resolveThemeMode(value: string | null | undefined): ThemeMode | null {
  return value === "light" || value === "dark" ? value : null;
}

export const themeInitScript = [
  "(() => {",
  "  try {",
  `    const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};`,
  '    const stored = localStorage.getItem(storageKey);',
  '    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;',
  '    const theme = stored === "light" || stored === "dark" ? stored : (systemDark ? "dark" : "light");',
  '    const root = document.documentElement;',
  '    root.classList.toggle("dark", theme === "dark");',
  '    root.dataset.theme = theme;',
  '    root.style.colorScheme = theme;',
  '  } catch (error) {',
  '    const root = document.documentElement;',
  '    root.classList.add("dark");',
  '    root.dataset.theme = "dark";',
  '    root.style.colorScheme = "dark";',
  '  }',
  '})();',
].join("\n");