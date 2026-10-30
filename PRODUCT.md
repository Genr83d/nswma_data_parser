# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Packaged as an Electron desktop app for Windows; the UI is a plain HTML/CSS/ES-module web app. Minimum window 1100×720, default 1440×920.)

## Users

Two audiences use the same tool equally:

- **Operations / data staff** at NSWMA who receive zone supervisors' WhatsApp reports, parse them, resolve unmatched district names, and produce the weekly collection sheet.
- **Managers** who read the dashboard, map, and analytics to see which zones, communities, and districts were collected, missed, pending, or in backlog for a collection period.

## Product Purpose

WCIS (Waste Collection Intelligence System) turns free-text WhatsApp field reports into structured collection records matched against a master list of zones → communities → districts, then rolls them up into weekly sheets, maps, and performance analytics. Success means a clerk can go from a raw chat export to a correct weekly sheet quickly, and a manager can see at a glance where collection is falling behind.

## Positioning

Built around the real shape of NSWMA's field reporting: WhatsApp chat exports, supervisor slang and misspellings of district names, the 25th-to-24th "collection month", and a master zone list of 26 zones, 175 communities, and 1,434 districts across Jamaican parishes.

## Operating Context

- Input: WhatsApp `.txt` exports or pasted report text; sections such as completed, incomplete (missed), forecast, late, backlog.
- Collection periods: calendar month or collection month (25th–24th), split into weeks 1–5, with presets.
- Workflow order: Upload/Parse → Parsed Results → Mapping Review (aliases, custom mapping) → Weekly Collection Sheet (editable, exportable to PDF/XLSX) → Map View / Reports & Analytics. Zone Manager maintains the master list.
- All processing is local; state persists in localStorage; nothing is sent to a server.

## Capabilities and Constraints

- Vanilla JS ES modules, hash router, screens render via `innerHTML` template strings; Tailwind via CDN plus a large custom stylesheet (`css/styles.css`); Leaflet for maps; SheetJS for XLSX.
- Record status vocabulary: matched, needs_review, unmapped, ignored. Section vocabulary: completed, incomplete, forecast, late, backlog.
- Redesign must not change parsing, matching, data, or export behavior.

## Brand Commitments

- Name: WCIS — Waste Collection Intelligence System. Internal tool, no official logo or palette is binding.
- The user asked that it feel rooted in Jamaica and its geography.

## Evidence on Hand

- Master zone data: `data/zones.js`, `exports/master-zone-dataset.json`; parish boundary GeoJSON in `data/boundaries/`.
- No real user names, testimonials, or performance claims; "Admin User / Operations" is placeholder copy.

## Product Principles

1. The workflow order is the navigation: a clerk should always know which step they are on and what comes next.
2. Status is the product: completed / missed / pending must be legible instantly and never rely on color alone.
3. Field data is messy; the UI should make fixing it fast rather than hide it.
4. Local and trustworthy: no network claims, no fabricated numbers; empty states say what to do next.

## Accessibility & Inclusion

Office desktop use, long sessions. WCAG AA contrast, visible keyboard focus, reduced-motion support.
