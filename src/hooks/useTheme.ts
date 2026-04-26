import { useEffect } from "react";
import { useStore } from "@/store/store";

export function useTheme() {
  const { data, dispatch } = useStore();
  const theme = data.settings.theme;

  useEffect(() => {
    const apply = () => {
      const root = document.documentElement;
      const isDark =
        theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", isDark);
    };
    apply();
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  function setTheme(next: "light" | "dark" | "system") {
    dispatch({ type: "updateSettings", patch: { theme: next } });
  }

  function toggle() {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "light" : "dark");
  }

  return { theme, setTheme, toggle };
}
