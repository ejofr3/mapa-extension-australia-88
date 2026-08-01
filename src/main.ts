import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

import { createMap } from "./map.ts";
import { DEFAULT_VISA, MONTHS, SEASON_OF_MONTH, type VisaSubclass } from "./config.ts";

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as T;
}

/** Application state. Phase 2 will drive layer rendering off this. */
interface AppState {
  month: number; // 1-12
  visa: VisaSubclass;
}

const state: AppState = {
  month: 1,
  visa: DEFAULT_VISA,
};

function wireMonthSlider(): void {
  const slider = el<HTMLInputElement>("month");
  const label = el<HTMLOutputElement>("month-label");
  const season = el<HTMLSpanElement>("season-label");

  const render = () => {
    const index = state.month - 1;
    // noUncheckedIndexedAccess: these are fixed 12-element tuples, but the
    // compiler can't know the slider is clamped, so fall back explicitly.
    label.textContent = MONTHS[index] ?? "";
    season.textContent = SEASON_OF_MONTH[index] ?? "";
  };

  slider.addEventListener("input", () => {
    const parsed = Number.parseInt(slider.value, 10);
    state.month = Number.isFinite(parsed) ? Math.min(12, Math.max(1, parsed)) : 1;
    render();
  });

  render();
}

function wireVisaToggle(): void {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-visa]"),
  );

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const value = button.dataset["visa"];
      if (value !== "462" && value !== "417") return;
      state.visa = value;
      for (const other of buttons) {
        other.setAttribute("aria-checked", String(other === button));
      }
    });
  }
}

/**
 * On narrow screens the shell is a bottom sheet, collapsed by default so the
 * map gets the screen. On wide screens the panel is always open and the toggle
 * is hidden by CSS, so this listener simply never fires.
 */
function wirePanelToggle(): void {
  const shell = el<HTMLDivElement>("shell");
  const toggle = el<HTMLButtonElement>("panel-toggle");

  toggle.addEventListener("click", () => {
    const open = shell.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

function main(): void {
  const map = createMap(el<HTMLDivElement>("map"));
  // Debug handle. The map is public data on a public page, so there is nothing
  // to protect here, and being able to poke at the instance from the console is
  // worth a great deal when a layer silently fails to paint.
  (globalThis as unknown as Record<string, unknown>)["__map"] = map;
  wireMonthSlider();
  wireVisaToggle();
  wirePanelToggle();
}

main();
