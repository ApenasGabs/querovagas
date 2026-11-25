import { Palette } from "lucide-react";
import type { ChangeEvent, KeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_THEME = "light";

const THEME_LIST = [
  "light",
  "dark",
  "cupcake",
  "bumblebee",
  "emerald",
  "corporate",
  "synthwave",
  "retro",
  "cyberpunk",
  "valentine",
  "halloween",
  "garden",
  "forest",
  "aqua",
  "lofi",
  "pastel",
  "fantasy",
  "wireframe",
  "black",
  "luxury",
  "dracula",
  "cmyk",
  "autumn",
  "business",
  "acid",
  "lemonade",
  "night",
  "coffee",
  "winter",
  "dim",
  "nord",
  "sunset",
  "purplewind",
];

const ThemeSelector = (): ReactElement => {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    return localStorage.getItem("theme") || DEFAULT_THEME;
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const drawerToggleRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLLabelElement>(null);

  const applyTheme = (theme: string): void => {
    // daisyUI aceita tanto data-theme quanto class na raiz
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.className = theme;
    document.body.setAttribute("data-theme", theme);
    document.body.className = theme;
    localStorage.setItem("theme", theme);
  };

  const setDrawerChecked = useCallback((checked: boolean): void => {
    const drawerToggle = drawerToggleRef.current;
    if (!drawerToggle) return;

    drawerToggle.checked = checked;
    setIsDrawerOpen(checked);
    drawerToggle.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  const toggleDrawer = useCallback((): void => {
    const drawerToggle = drawerToggleRef.current;
    if (!drawerToggle) return;

    setDrawerChecked(!drawerToggle.checked);
  }, [setDrawerChecked]);

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const handleEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        setDrawerChecked(false);
        triggerButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isDrawerOpen, setDrawerChecked]);

  const handleToggleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setIsDrawerOpen(event.target.checked);
  };

  const ThemeOptions = THEME_LIST.map((theme) => (
    <li key={theme}>
      <input
        type="radio"
        name="theme-dropdown"
        className="theme-controller btn btn-sm btn-block btn-ghost justify-start"
        aria-label={theme.charAt(0).toUpperCase() + theme.slice(1)}
        value={theme}
        checked={currentTheme === theme}
        onChange={() => setCurrentTheme(theme)}
        data-testid={`theme-option-${theme}`}
      />
    </li>
  ));

  return (
    <div className="text-xl" data-testid="theme-selector">
      <div className="drawer drawer-end">
        <input
          ref={drawerToggleRef}
          id="theme-drawer"
          type="checkbox"
          className="drawer-toggle"
          data-testid="theme-drawer-toggle"
          tabIndex={-1}
          onChange={handleToggleChange}
        />
        <div className="drawer-content">
          <label
            ref={triggerButtonRef}
            htmlFor="theme-drawer"
            className="btn btn-sm btn-ghost gap-1.5 px-2 sm:px-3 text-xs sm:text-sm font-semibold cursor-pointer"
            role="button"
            aria-label="Temas"
            aria-expanded={isDrawerOpen}
            aria-controls="theme-menu"
            data-testid="theme-button"
            tabIndex={0}
            onKeyDown={(event: KeyboardEvent<HTMLLabelElement>) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleDrawer();
              }
            }}
          >
            <Palette className="w-4 h-4 shrink-0 text-base-content/80" />
            <span className="hidden sm:inline">Temas</span>
            <span className="sr-only sm:hidden">Temas</span>
          </label>
        </div>
        <div className="drawer-side z-1">
          <label
            htmlFor="theme-drawer"
            className="drawer-overlay"
            aria-label="Fechar seletor de temas"
            data-testid="theme-drawer-overlay"
          ></label>
          <ul
            id="theme-menu"
            className="menu bg-base-200 text-base-content min-h-full w-80 max-w-[calc(100%-3rem)] p-4 pt-10"
            data-testid="theme-menu"
          >
            {ThemeOptions}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ThemeSelector;
