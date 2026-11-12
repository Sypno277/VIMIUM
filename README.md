# Kestrel — Keyboard Browsing

> **Browse at the speed of thought.**
>
> A keyboard-first browser navigation extension inspired by Vimium, built for modern web applications with a visual settings suite, per-site intelligence, accessibility-first design, and zero learning cliff.

---

## The Idea

A kestrel is the raptor that hovers in place, locks onto its target, and strikes in a single movement. That is Kestrel's core interaction: press `f` to hover hint labels over every interactive element on the page, type two letters to lock on, and strike directly to your destination.

## Key Features

- **Modal Navigation**:
  - `normal`: smooth keyboard navigation across pages and nested scrollable containers (`j`/`k`/`h`/`l`, `d`/`u`, `gg`/`G`)
  - `hint`: shadow-DOM piercing link hints (`f`, `Shift+F`, `;f`) with home-row priority and type-to-filter
  - `find`: in-page incremental search (`/`) with live match counting
  - `visual`: selection mode (`v`) for text and link extraction
  - `command`: `:` palette with fuzzy command autocomplete and doc previews
- **Omnibar & Fast Search** (`o`, `O`, `b`):
  - Frecency-ranked history, bookmarks, and open tabs
  - Built-in keyword engines (`g` for Google, `gh` for GitHub, `w` for Wikipedia)
- **Tab & Window Mastery** (`J`/`K`, `x`, `X`, `t`, `T`):
  - Rapid tab switching, closing, restoring, creating, and live tab searching
- **Per-Site Intelligence**:
  - Curated profiles for web apps (Gmail, Google Docs, YouTube, Slack, Notion, GitHub)
  - Custom per-site keymap overrides and disabled command lists
  - Ancestor-aware insert-mode detection for rich text editors and chat composers
- **Visual Options UI**:
  - Interactive key-binding remapper with real-time conflict detection
  - Dedicated tabs for scrolling, hints, accessibility, per-site overrides, and privacy
  - Real Vimium configuration import parser and JSON backup/restore
- **Accessibility & Hygiene**:
  - WAI-ARIA dialogs with complete focus traps and Escape dismissals
  - High-contrast hint overlays and colorblind-safe palettes
  - `prefers-reduced-motion` detection cached across scrolling and modal transitions
  - Strict local-first privacy: no telemetry, no remote analytics

## Architecture

- **Manifest V3** with TypeScript and Vite bundler
- Injected content script with targeted scroll resolution and shadow-DOM piercing
- Single-writer storage layer with quota awareness, local fallback, and cross-window sync
- Background service worker managing tab lifecycles, navigation hooks, and global shortcuts

## Project Layout

```
src/
  commands/       command definitions and default keymaps
  keymap/         event normalization, chord resolver, conflict detection
  hints/          shadow-DOM element finder, label generator, hint overlay
  omnibar/        fuzzy matching, frecency scoring, search engines, omnibar overlay
  find/           in-page incremental find controller
  visual/         visual selection controller
  content/        content controller, scroll engine, insert mode detection, marks
  settings/       default settings, site pattern matching, site policy resolver
  storage/        settings store, migrations, quota guards, broadcast channel
  migration/      Vimium configuration parser
  ui/             accessible modal base, command palette, cheat sheet, toast, badge
  options/        modular options page and configuration tabs
  background/     service worker, tab commands, navigation listeners, commands router
  __tests__/      unit and DOM test suites (Vitest)
```

## Development & Verification

```bash
# Run unit & DOM test suite
npm test

# Run strict TypeScript typechecker
npm run typecheck

# Run linter
npm run lint

# Build production artifacts (dist/ directory)
npm run build
```

To load the unpacked extension in Google Chrome:
1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `dist/` directory

## Known limitations

Written down rather than glossed over. Everything below is *known and
deliberate at this revision*; the tracked defect register lives in
[`PLAN-V2.md`](./PLAN-V2.md).

- **No automated end-to-end coverage.** The suite is unit/jsdom level
  (66 tests across 12 files). Nothing yet drives a real Chromium with
  `--load-extension`, so a browser-level regression would not be caught by CI.
- **Perf budgets are instrumented, not enforced.** `core/perf.ts` records hint
  scan/paint and omnibar load/render timings behind the debug flag, but there is
  no test that fails when a budget is exceeded.
- **`scroll.acceleration` only affects `j`/`k`.** It is a key-repeat ramp cap;
  `d`/`u` and `gg`/`G` use the configured page fractions and ignore it. This is
  the documented behaviour, not an oversight.
- **Hint scanning is whole-document.** Offscreen labels are culled at paint
  time, so a very large page trades a longer first scan for complete coverage.
- **Shadow roots are pierced only when `mode === "open"`.** Closed shadow roots
  are undetectable by design.
- **No i18n yet.** Strings are inline; `chrome.i18n` scaffolding is not in place.
- **No store assets or privacy-policy page.** Both are required before a public
  `<all_urls>` listing.
- **Sensitive-site defaults are not shipped.** Banks, webmail and password
  managers are not excluded out of the box — add them under *Disabled sites*.

## Lineage & Attribution

Kestrel builds on the pioneering ideas of Phil Crosby and Ilya Sukhar's [Vimium](https://github.com/philc/vimium), modernizing the architecture for contemporary web apps, Manifest V3, and assistive technologies.
