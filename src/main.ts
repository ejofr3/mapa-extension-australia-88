import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";

import type { Map as MapLibreMap } from "maplibre-gl";

import { createMap, prefersDark } from "./map.ts";
import { DEFAULT_VISA, MONTHS, SEASON_OF_MONTH, type VisaSubclass } from "./config.ts";
import {
  areasForPostcode,
  industriesForPostcode,
  loadEligibility,
  postcodesForIndustry,
  type EligibilityData,
} from "./eligibility.ts";
import {
  addEligibilityLayers,
  FILL_LAYER,
  postcodeAt,
  setAllEligible,
  setEligiblePostcodes,
  setSelectedPostcode,
} from "./layers.ts";

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as T;
}

function escapeHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

interface AppState {
  month: number;
  visa: VisaSubclass;
  industry: string;
  selected: string | null;
  data: EligibilityData | null;
  points: Record<string, [number, number]>;
}

const state: AppState = {
  month: 1,
  visa: DEFAULT_VISA,
  industry: "plant_animal_cultivation",
  selected: null,
  data: null,
  points: {},
};

let map: MapLibreMap;
const BASE = import.meta.env.BASE_URL;

/* ---------------------------------------------------------------- rendering */

function renderIndustryOptions(): void {
  const select = el<HTMLSelectElement>("industry");
  select.innerHTML = "";

  if (!state.data) {
    select.disabled = true;
    return;
  }
  select.disabled = false;

  for (const [key, industry] of Object.entries(state.data.industries)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = industry.label;
    select.append(opt);
  }
  if (!state.data.industries[state.industry]) {
    state.industry = Object.keys(state.data.industries)[0] ?? "";
  }
  select.value = state.industry;
}

function renderEligibility(): void {
  const note = el<HTMLParagraphElement>("industry-note");
  const coverage = el<HTMLParagraphElement>("coverage");

  if (!state.data) {
    setEligiblePostcodes(map, [], prefersDark());
    coverage.textContent = "";
    return;
  }

  const industry = state.data.industries[state.industry];
  const { postcodes, anywhere } = postcodesForIndustry(state.data, state.industry);

  if (anywhere) {
    setAllEligible(map, prefersDark());
    coverage.textContent = "Counts anywhere in Australia — no area restriction.";
  } else {
    setEligiblePostcodes(map, postcodes, prefersDark());
    const areaNames = industry?.areas
      .map((a) => state.data?.areas[a]?.label ?? a)
      .join(" or ");
    coverage.textContent =
      `${postcodes.length.toLocaleString()} postcodes shaded — ${areaNames}.`;
  }
  note.textContent = industry?.note ?? "";
}

function renderResult(): void {
  const box = el<HTMLDivElement>("result");
  const pc = state.selected;

  if (!pc) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;

  if (!state.data) {
    box.innerHTML =
      `<h2>Postcode ${escapeHtml(pc)}</h2>` +
      `<p class="verdict unknown">No data loaded for this visa.</p>`;
    return;
  }

  const areas = areasForPostcode(state.data, pc);
  const industries = industriesForPostcode(state.data, pc);
  const selected = state.data.industries[state.industry];
  const counts = industries.some((i) => i.key === state.industry);

  const verdict = counts
    ? `<p class="verdict yes"><strong>Counts</strong> for ${escapeHtml(selected?.label ?? "")}</p>`
    : `<p class="verdict no"><strong>Does not count</strong> for ${escapeHtml(selected?.label ?? "")}</p>`;

  const areaList = areas.length
    ? `<h3>Designated areas</h3><ul>${areas
        .map((a) => `<li>${escapeHtml(state.data?.areas[a]?.label ?? a)}</li>`)
        .join("")}</ul>`
    : `<p class="muted">Not in any designated area.</p>`;

  const otherWork = industries.length
    ? `<h3>What counts here</h3><ul>${industries
        .map((i) => `<li>${escapeHtml(i.label)}</li>`)
        .join("")}</ul>`
    : "";

  box.innerHTML = `<h2>Postcode ${escapeHtml(pc)}</h2>${verdict}${areaList}${otherWork}`;
}

/* ------------------------------------------------------------- interactions */

function selectPostcode(pc: string | null, fly = false): void {
  state.selected = pc;
  setSelectedPostcode(map, pc);
  renderResult();

  if (fly && pc) {
    const point = state.points[pc];
    if (point) map.flyTo({ center: point, zoom: 9, duration: 900 });
  }
}

async function setVisa(visa: VisaSubclass): Promise<void> {
  state.visa = visa;
  state.data = await loadEligibility(visa, BASE);
  renderIndustryOptions();
  renderEligibility();
  renderResult();

  if (!state.data) {
    el<HTMLParagraphElement>("industry-note").textContent =
      `No published data loaded for subclass ${visa} yet, so nothing is shaded. ` +
      `An unshaded map here means "not yet sourced", NOT "not eligible".`;
  }
}

function wireVisaToggle(): void {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-visa]"));
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const value = button.dataset["visa"];
      if (value !== "462" && value !== "417") return;
      for (const other of buttons) {
        other.setAttribute("aria-checked", String(other === button));
      }
      void setVisa(value);
    });
  }
}

function wireIndustry(): void {
  el<HTMLSelectElement>("industry").addEventListener("change", (e) => {
    state.industry = (e.target as HTMLSelectElement).value;
    renderEligibility();
    renderResult();
  });
}

function wirePostcodeSearch(): void {
  const input = el<HTMLInputElement>("postcode-input");
  const go = el<HTMLButtonElement>("postcode-go");

  const submit = () => {
    const pc = input.value.trim().padStart(4, "0");
    if (!/^\d{4}$/.test(pc)) return;

    if (!state.points[pc]) {
      // Distinguish "no such postal area" from "not eligible" — several
      // Australian postcodes are PO boxes only and have no geography at all.
      state.selected = pc;
      setSelectedPostcode(map, null);
      const box = el<HTMLDivElement>("result");
      box.hidden = false;
      box.innerHTML =
        `<h2>Postcode ${escapeHtml(pc)}</h2>` +
        `<p class="verdict unknown">Not a postal area with a mapped boundary. ` +
        `Some Australian postcodes are PO boxes only and have no geography.</p>`;
      return;
    }
    selectPostcode(pc, true);
  };

  go.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
}

function wireMonthSlider(): void {
  const slider = el<HTMLInputElement>("month");
  const label = el<HTMLOutputElement>("month-label");
  const season = el<HTMLSpanElement>("season-label");

  const render = () => {
    const i = state.month - 1;
    label.textContent = MONTHS[i] ?? "";
    season.textContent = SEASON_OF_MONTH[i] ?? "";
  };

  slider.addEventListener("input", () => {
    const parsed = Number.parseInt(slider.value, 10);
    state.month = Number.isFinite(parsed) ? Math.min(12, Math.max(1, parsed)) : 1;
    render();
  });
  render();
}

function wirePanelToggle(): void {
  const shell = el<HTMLDivElement>("shell");
  const toggle = el<HTMLButtonElement>("panel-toggle");
  toggle.addEventListener("click", () => {
    const open = shell.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

/* -------------------------------------------------------------------- boot */

async function main(): Promise<void> {
  map = createMap(el<HTMLDivElement>("map"));
  // Debug handle. Public page, public data — nothing to protect, and being able
  // to poke the instance from the console is worth a lot when a layer fails.
  (globalThis as unknown as Record<string, unknown>)["__map"] = map;

  wireMonthSlider();
  wireVisaToggle();
  wireIndustry();
  wirePostcodeSearch();
  wirePanelToggle();

  try {
    const res = await fetch(`${BASE}data/postcode_points.json`);
    if (res.ok) {
      state.points = ((await res.json()) as { points: Record<string, [number, number]> }).points;
    }
  } catch {
    /* search still works; it just will not recentre the map */
  }

  // style.load fires again after a theme change, which discards every custom
  // layer, so these must be re-added here rather than once at startup.
  map.on("style.load", () => {
    addEligibilityLayers(map, prefersDark());
    renderEligibility();
  });

  map.on("click", (e) => selectPostcode(postcodeAt(map, e.point)));
  map.on("mouseenter", FILL_LAYER, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", FILL_LAYER, () => {
    map.getCanvas().style.cursor = "";
  });

  await setVisa(DEFAULT_VISA);
}

void main();
