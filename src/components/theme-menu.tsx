"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";
const options = [["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "System", Monitor]] as const;
const event = "rescene-theme";

function read(): Theme {
  try { const value = localStorage.getItem("theme"); return value === "light" || value === "dark" ? value : "system"; } catch { return "system"; }
}
function subscribe(callback: () => void) {
  window.addEventListener(event, callback); window.addEventListener("storage", callback);
  return () => { window.removeEventListener(event, callback); window.removeEventListener("storage", callback); };
}
function apply(theme: Theme) {
  try { if (theme === "system") localStorage.removeItem("theme"); else localStorage.setItem("theme", theme); } catch {}
  if (theme === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", theme);
  window.dispatchEvent(new Event(event));
}

/** Header menu for light, dark or system appearance; the root layout applies the saved choice before paint. */
export function ThemeMenu() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false; };
    window.addEventListener("click", close); return () => window.removeEventListener("click", close);
  }, []);
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  return <details className="theme-menu" ref={menu}>
    <summary className="icon-button" aria-label="Appearance" title="Appearance"><Icon size={16}/></summary>
    <div className="theme-options" role="menu" aria-label="Appearance">{options.map(([value, label, OptionIcon]) =>
      <button key={value} role="menuitemradio" aria-checked={theme === value} onClick={() => { apply(value); if (menu.current) menu.current.open = false; }}><OptionIcon size={15}/><span>{label}</span><span className="theme-check">{theme === value && <Check size={14}/>}</span></button>)}</div>
  </details>;
}
