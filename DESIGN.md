---
name: WCIS
description: Waste Collection Intelligence System, kept as a supervisor's carbonless duplicate book.
colors:
  cover: "#0c3b24"
  cover-2: "#134d30"
  cover-ink: "#e7efe2"
  cover-ink-2: "#a9c2ae"
  ply-white: "#fbfcf8"
  ply-canary: "#fbf0b4"
  ply-pink: "#fae0e5"
  leaf: "#fdfdfb"
  leaf-2: "#f1f5ef"
  leaf-3: "#e8eee6"
  rule: "#d3dfd3"
  rule-strong: "#abc3af"
  ink: "#191c19"
  ink-2: "#3b423b"
  ink-3: "#566056"
  ink-4: "#6b746a"
  green: "#00843d"
  green-deep: "#0a5a2e"
  green-wash: "#e1f0e4"
  carbon: "#2b3a8f"
  carbon-wash: "#e4e7f5"
  red: "#b8261a"
  red-wash: "#f8e0dc"
  ochre: "#8f5400"
  ochre-wash: "#f9ead0"
  gold: "#fed100"
  gold-wash: "#fff09e"
  gold-edge: "#c9a400"
  plum: "#74306a"
  plum-wash: "#f1e1ee"
typography:
  display:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "2.7rem"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.045em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "1.95rem"
    fontWeight: 850
    lineHeight: 1.05
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 112"
  tally:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "2.35rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 118"
    fontFeature: "'tnum' 1"
  title:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "0.98rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 700
    letterSpacing: "0.07em"
    fontVariation: "'wdth' 78"
  stamp:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "0.66rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.09em"
    fontVariation: "'wdth' 85"
  typed:
    fontFamily: "Courier Prime, Courier New, monospace"
    fontSize: "0.82rem"
    fontWeight: 400
    lineHeight: 1.35
rounded:
  r: "2px"
  stamp: "3px"
spacing:
  tight: "0.5rem"
  cell: "0.85rem 1rem"
  section: "1.25rem"
  column: "2rem"
  leaf: "1.5rem 2rem 3rem"
  cover-w: "252px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "#ffffff"
    rounded: "{rounded.r}"
    padding: "0.4rem 0.85rem"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.green-deep}"
  button-secondary:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
    padding: "0.4rem 0.85rem"
    height: "36px"
  button-secondary-hover:
    textColor: "{colors.green-deep}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.red}"
    rounded: "{rounded.r}"
    padding: "0.4rem 0.85rem"
  button-danger-hover:
    backgroundColor: "{colors.red-wash}"
  button-highlight:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
    padding: "0.4rem 0.85rem"
  button-small:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.r}"
    padding: "0.15rem 0.55rem"
    height: "28px"
  field:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.ink}"
    rounded: "{rounded.r}"
  stamp:
    textColor: "{colors.green}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "0.32rem 0.5rem 0.28rem"
  nav-tab:
    backgroundColor: "transparent"
    textColor: "{colors.cover-ink}"
    rounded: "{rounded.r}"
    height: "40px"
  nav-tab-active:
    backgroundColor: "{colors.ply-white}"
    textColor: "{colors.ink}"
  zone-plate:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    padding: "0.75rem 0.85rem 0.8rem"
    height: "150px"
  ruler-week-selected:
    backgroundColor: "{colors.gold-wash}"
    textColor: "{colors.carbon}"
    height: "52px"
---

# Design System: WCIS

## Overview

**Creative North Star: "The Supervisor's Duplicate Book"**

WCIS is a carbonless duplicate book held open on an office desk. A Jamaican-green bookcloth cover carries a stepped rail of index tabs; the open leaf is bright paper with pre-printed green form ruling; figures are entered in carbon blue; statuses are rubber-stamped in their own inks; Jamaican gold is the highlighter that marks selection and the active week. The leaf changes ply with the step of the work: white is the original record, canary is the review copy (Mapping Review), pink is the file copy (Weekly Sheet, Reports). The three ply edges always show at the right fore-edge, with the current one matching the leaf.

Density is clerical, not dashboard-airy: counts sit in ruled tally rows, zones sit in a ruled roster of plates, tables are form ruling rather than boxed cards. Depth is almost entirely line and paper; the only real shadows belong to things laid on top of the leaf (modals, map popups, the cell being edited). Motion is the physical book: a leaf turns and settles once per route, stamps press once on arrival, tabs slide proud of the cover on hover.

The system refuses the navy-sidebar, icon-in-a-rounded-square KPI-card admin template. Every count is a stamped tally; every container is ruled, not floated.

**Key Characteristics:**
- Green bookcloth cover with a stepped index-tab rail; the active tab is the same paper as the leaf and runs into it.
- Three plies (white, canary, pink) assigned per route; ply edges stay visible at the fore-edge.
- Archivo across its width axis: condensed for form captions and stamps, expanded black for zone numerals and tallies.
- Rubber-stamp statuses with double inset rule, uppercase, one ink per status.
- Gold highlighter for selection, hover rows and the active week; never blue selection.
- Sharp 2px corners everywhere; dashed perforation and dashed note borders.

## Colors

A bookcloth green and three paper plies, written on in green form ink, carbon blue and a small set of stamp inks.

### Primary
- **Form Green** (green): pre-printed ruling under headers and the period ruler, primary buttons, the COLLECTED stamp, progress fills, checkbox accent.
- **Deep Form Green** (green-deep): form captions and table headers, tab step numerals, primary button hover and border, zone-row text on the weekly sheet.

### Secondary
- **Carbon Blue** (carbon): entered figures (tally values default to it), the PENDING / forecast stamp, selected week numerals, the edge bar under a ruler range, focus outline and caret, typed text in the paste box and activity log.

### Tertiary
- **Jamaican Gold** (gold): the highlighter. Text selection, row hover (mixed 18% into the ply), selected rows (34%), selected ruler weeks (gold-wash), the highlight button, the cover flag stripe. Gold Edge (gold-edge) is the border on gold-filled controls.

### Stamp inks
- **Stamp Red** (red) with red-wash: MISSED / incomplete / unmapped, danger buttons, unmatched original text.
- **Ledger Ochre** (ochre) with ochre-wash: LATE, needs-review, NEEDS MAPPING, partial weekly cells.
- **Backlog Plum** (plum) with plum-wash: BACKLOG only.
- **Stamp Grey** (ink-3): neutral stamps (ignored, counts with no status meaning).

### Neutral
- **Bookcloth** (cover, cover-2): the app background and sidebar; cover-2 is the scrollbar on the cover.
- **Cover Ink** (cover-ink, cover-ink-2): text and group labels printed on the cover.
- **Plies** (ply-white, ply-canary, ply-pink): the leaf background for the current route, exposed as `--ply`.
- **Leaf** (leaf, leaf-2, leaf-3): input and button paper, quiet hover fills. leaf-2/leaf-3 and both rules are `color-mix` of the current ply with green-deep at 4/8/17/34%, so they re-tint on canary and pink; the hex values recorded are their resolution on the white ply.
- **Rule / Rule Strong** (rule, rule-strong): cell and row ruling; input borders, dashed note borders and perforation dots.
- **Ink ladder** (ink, ink-2, ink-3, ink-4): primary text, secondary text, captions and notes, placeholders and empty values.

### Named Rules
**The Stamp Ink Rule.** Each status owns one ink and keeps it everywhere: COLLECTED green, MISSED red, PENDING carbon, LATE ochre, BACKLOG plum. Status is always a worded stamp or a worded count, never color alone.

**The Highlighter Rule.** Selection, hover and the active period are gold mixed into the ply. Blue is ink, not selection.

**The Ply Rule.** The leaf color is set by the route (white: dashboard, upload, results, map, zones; canary: mapping; pink: weekly, reports). Surfaces inside the leaf are transparent so the ply shows through; washes and rules mix against `--ply`, not against white.

## Typography

**Display Font:** Archivo variable, weight 100-900, width 62-125% (with Segoe UI, system-ui)
**Body Font:** Archivo (same family)
**Typed Font:** Courier Prime 400/700 (with Courier New), only for raw report text

**Character:** One grotesque stretched across its width axis does the work of a form: condensed uppercase captions as the pre-printed labels, expanded black numerals as the entries that matter. The typewriter face appears only where the source is literally typed text from the field. All numerals are tabular.

### Hierarchy
- **Display** (900, 2.7rem, wdth 125, lh 0.9): the zone numeral on each plate (1.9rem when the mark exceeds three characters); the cover title WCIS uses the same voice at 2rem.
- **Headline** (850, 1.95rem, wdth 112, lh 1.05): the leaf title in each screen's stub header; modal titles at 1.3rem.
- **Tally** (800, 2.35rem dashboard / 1.8rem elsewhere, wdth 118, lh 1.05): counts, colored by their tone (carbon by default).
- **Title** (800, 0.98-1.05rem): panel and section headings.
- **Body** (400, 14px base; 0.9rem at 1.45 for leaf intros, max 62ch): descriptive text, table cells.
- **Label** (700, 0.7rem, wdth 78, 0.07em, uppercase, green-deep): form captions, table headers, filter labels. Cover group labels use the same form at 0.68rem, wdth 75, 0.1em in cover-ink-2.
- **Stamp** (800, 0.66rem, wdth 85, 0.09em, uppercase): status stamps.
- **Typed** (Courier Prime 400, 0.8-0.88rem): pasted reports (carbon on ruled lines, 26px line height), source lines, unmatched originals, activity log.

### Named Rules
**The Width Axis Rule.** Hierarchy is carried by width as much as weight: captions go condensed (75-85%), numerals and titles go expanded (112-125%). Do not substitute a second display family.

**The Typed Text Rule.** Courier Prime marks text that came from the field as typed. Never use it for UI labels or headings.

## Layout

A three-column book: the cover (252px, 216px at ≤1280px), the leaf (fluid, padded 1.5rem 2rem 3rem, scrolls independently at 100dvh), and a 12px fore-edge showing the three plies. Every screen opens with a stub header: headline and intro left, actions right (0.5rem gap), aligned to the bottom edge. Where the period applies, the period ruler sits under it across the full leaf width, followed by a perforation line.

Counts sit in ruled tally rows (equal columns, separated by 1px rules, no gaps). The dashboard body is a fluid roster plus a 320px side column (280px at ≤1280px) at a 2rem gap; the zone roster is an auto-fill grid of 176px-minimum plates sharing rules. Section spacing runs at 1.25rem; tally cells pad 0.85rem 1rem.

The minimum window is 1100x720. At ≤1360px the ruler's weeks drop to their own row beneath month and tools, analytics tallies wrap to three columns, and multi-panel workspaces stack their editor panel full width; at ≤1200px Mapping Review stacks to one column.

## Elevation & Depth

The leaf is flat. Depth comes from ruling, paper plies and the cover framing the leaf; panels carry a 1px rule and no shadow. Shadows exist only for paper laid on top of the leaf, and for the one weekly cell under the pen.

### Shadow Vocabulary
- **Slip** (`box-shadow: 0 2px 4px rgba(20, 28, 20, 0.08), 0 24px 60px rgba(20, 28, 20, 0.22)`): modals and map popups. Modals sit over a green scrim (`rgba(12, 59, 36, 0.42)`), no blur.
- **Cell lift** (`box-shadow: 0 0 0 1px var(--rule-strong), 0 6px 18px rgba(20, 28, 20, 0.12)`): the weekly sheet cell being hovered or edited.
- **Field focus** (`box-shadow: 0 0 0 3px` carbon at 18%): fields and textareas on focus, with a carbon border.
- **Stamp rim** (inset 1.5px ply + inset 2.5px currentColor at 55%): the double rule inside every stamp; part of the stamp, not elevation.

### Named Rules
**The Paper On Paper Rule.** If it is not a slip laid on the leaf, it has no shadow. Cards, panels and tallies are ruled, never floated.

## Shapes

Sharp, cut-paper corners: 2px on fields, buttons, panels, tabs and modals; 3px on stamps. Bars and gauges are square-ended ink fills on a ruled line (4-6px). Dashed borders mean paper conventions: the stitched spine on the cover, perforation dots under the period ruler, dashed rule-strong borders on notes and tips, dashed green on the drop zone and empty-state call to action, a dashed underline on editable district values. The only round shapes are map markers and legend dots.

## Components

### Buttons
Firm, printed controls with a 1px press on active.
- **Shape:** sharp (2px), 36px tall, 0.4rem 0.85rem, 750 weight, Phosphor icon at 1rem with 0.45rem gap.
- **Primary:** form green with a green-deep border and white text; hover goes green-deep. One per stub header (Parse reports, Save sheet, Review mapping).
- **Secondary:** leaf paper with a rule-strong border; hover borders green and text turns green-deep.
- **Danger:** transparent with a red border at 45%; hover fills red-wash.
- **Highlight:** gold fill with a gold-edge border, for the active organizer state.
- **Small / icon:** 28px, transparent with rule-strong border, 0.78rem; a selected icon button fills gold.
- **Text action:** green-deep underlined text, 0.78rem, for in-panel links.
- **Disabled:** 45% opacity, not-allowed cursor.

### Stamps
The status vocabulary. Inline-flex, 1.5px border in currentColor, an 8% tint of the same ink, the double inset rim, uppercase condensed 0.66rem. The `stamp(label, tone)` helper emits them; tone is green, red, carbon, ochre, plum or ink. Stamps press once on arrival (380ms, from scale 1.35 and -4deg). In the alerts list a stamp sits at -2deg, as if pressed by hand.

### Tallies
A count on the form: a stamped label, the figure in the same ink (Tally type), and a short note in ink-3. Tallies sit in a ruled row with 1px separators, no boxes and no icon tiles. The `tally()` helper emits them; the dashboard row closes with a 1.5px green rule.

### Inputs / Fields
- **Style:** leaf paper, 1px rule-strong border, 2px corners, 0.88rem. Selects use a green-deep chevron drawn in CSS.
- **Hover:** border shifts 40% toward green.
- **Focus:** carbon border plus 3px carbon ring at 18%; caret is carbon.
- **Paste box:** Courier Prime in carbon on 26px ruled lines, like a typed carbon.

### Navigation
The index-tab rail on the cover. Group labels (condensed uppercase, cover-ink-2) divide Overview, Report workflow, Look up and Master list. Each tab is 40px, cover-ink text with a cover-ink-2 Phosphor icon; a 30px paper strip in its route's ply stands at the fore edge carrying the step (1-4 for the workflow, letters D, M, R, Z for the rest). Hover slides the strip 6px proud. The active tab becomes full ply paper with ink text and a green-deep icon, running into the leaf.

### Period Ruler
The one control that remaps every number. A strip between 1.5px green rules: month/year selects on the left, week segments in the middle with seven tick marks per week along the top, range tools on the right. Selected weeks fill gold-wash with carbon week numerals; the range edges carry a 3px carbon bar on the bottom rule. A perforation dot line runs 14px below.

### Zone Plates
The roster of 26 zones, one ruled plate each (min 150px): the zone numeral in Display (zero-padded, suffix such as A&B set small), monitor and community count, worded counts in their inks (done green, missed red, pending carbon), a 4px fill gauge, and the percent top right. Zones with no reports in the selected weeks go quiet (numeral at ink-3 mixed 25% into the ply). Hover fills 20% gold and turns the numeral green.

### Panels, notes and slips
- **Panel:** transparent, 1px rule, 2px corners, no shadow; headings sit on a 1px rule.
- **Notes and tips:** transparent with a dashed rule-strong border; list markers in green.
- **Alerts / insights:** rows on a rule, stamp left, bold line and ink-3 note right.
- **Modal (slip):** always white ply, rule-strong border, Slip shadow, green 1.5px rule under the header; slides in 14px with a -0.4deg turn (320ms).

### Weekly cells
Entries on the pink copy: completed in green-deep on green-wash, daily in carbon on carbon-wash, partial in ochre on ochre-wash, missed in red on red-wash (each wash mixed 25% toward the ply), no-data in ink-4. Zone rows tint the ply 10% green, community rows 4%; flagged rows tint 30% gold.

### Motion
One easing, `cubic-bezier(0.16, 1, 0.3, 1)`. Leaf turn: route children rise 8px and fade in over 420ms, staggered 30ms. Stamp press 380ms. Slip-in 320ms. Tab strips 240ms. State transitions 120-160ms; ply background 280ms. Reduced motion collapses all of it to 1ms.

## Do's and Don'ts

### Do:
- **Do** set the route's ply on `body[data-ply]` and let surfaces stay transparent so white, canary or pink shows through.
- **Do** write every status as a worded stamp in its own ink (COLLECTED green, MISSED red, PENDING carbon, LATE ochre, BACKLOG plum).
- **Do** show counts as stamped tallies in ruled rows via the `tally()` helper.
- **Do** mark selection, hover and the active period with gold mixed into the ply (18% hover, 34% selected, gold-wash for ruler weeks).
- **Do** keep corners at 2px (3px for stamps) and separate content with 1px rule lines and the 1.5px green form rule.
- **Do** use Archivo's width axis for hierarchy: condensed uppercase green-deep captions, expanded black numerals.
- **Do** keep Courier Prime for text that came from the field.
- **Do** use Phosphor icons (regular, bold) through the `icon()` helper, beside a word or, for icon-only controls such as pagination, with an aria-label.

### Don't:
- **Don't** build KPI cards with icon tiles, rounded boxes or drop shadows; counts are tallies on ruling.
- **Don't** use blue or carbon fills for selection; carbon is entered ink and focus.
- **Don't** add shadows to anything that is not a slip laid on the leaf.
- **Don't** introduce a dark theme or navy chrome; the cover is green bookcloth and the leaf is light paper.
- **Don't** let a status depend on color alone; the stamp word or count label carries it.
- **Don't** use rounded pills or large radii; the only circles are map markers and legend dots.
