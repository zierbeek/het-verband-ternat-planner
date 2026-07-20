import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getEffectiveTheme, setTheme, ThemeMode } from "../utils/theme.ts";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getEffectiveTheme());

  const toggle = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button
      onClick={toggle}
      className={`p-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition ${className}`}
      title={theme === "dark" ? "Lichte modus" : "Donkere modus"}
      aria-label="Wissel tussen lichte en donkere modus"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
