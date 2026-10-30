import { escapeHtml } from "./normalizer.js";

export function icon(name, weight = "") {
  return `<i class="ph${weight ? `-${weight}` : ""} ph-${name}" aria-hidden="true"></i>`;
}

export function stamp(label, tone = "ink", extraClass = "") {
  return `<span class="stamp stamp-${tone} ${extraClass}">${escapeHtml(label)}</span>`;
}

// A count on the form: stamped label, figure in the same status ink, short note.
export function tally({ label, value, note = "", tone = "carbon", className = "result-metric" }) {
  const display = typeof value === "number" ? Number(value || 0).toLocaleString() : value;
  return `<div class="${className} dash-tally tone-${tone}">${stamp(label, tone)}<strong class="tally-value">${display}</strong>${note ? `<small>${note}</small>` : ""}</div>`;
}

// "Zone 11 A&B" -> { kicker: "Zone", mark: "11", suffix: "A&B" }; "St. Catherine B/B1" -> { kicker: "St. Catherine", mark: "B/B1" }
export function zoneMark(name = "") {
  const zone = name.match(/^zone\s*(\d+)\s*(.*)$/i);
  if (zone) return { kicker: "Zone", mark: zone[1].padStart(2, "0"), suffix: zone[2].trim() };
  const parish = name.match(/^(st\.?\s+\w+)\s+(.+)$/i);
  if (parish) return { kicker: parish[1], mark: parish[2].trim(), suffix: "" };
  return { kicker: "", mark: name, suffix: "" };
}
