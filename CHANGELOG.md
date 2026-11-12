# Changelog

All notable changes to Kestrel are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — correctness pass

Everything below was a defect that shipped and was reachable. Each one was
found by reading the execution path, fixed, and pinned with a test where the
module is DOM-bound.

### Fixed
- **Visual mode was a keyboard deadlock.** The toolbar carried a modal id, so
  the content controller's "a modal owns the keyboard" guard swallowed every
  key — including `Escape`. `v` could only be exited by reloading the page.
  The toolbar now has its own non-modal id (`kestrel-visual-bar`) and the
  tutorial owns the keyboard instead (D1, D6).
- **Find leaked two window listeners per session** and kept repainting a
  detached highlight layer on every later scroll. `dispose()` is now
  idempotent, always removes both listeners, and the owner calls it (D2).
- **`n`/`N` jumped to the wrong match.** Prefilling reset the index to 0 before
  stepping, so "next" landed on the second match. The current index now
  survives across sessions, keyed by query (D3).
- **`:tabopen <url>` discarded its argument.** The palette returned `args`, the
  controller dropped it. Arguments are now threaded through dispatch into the
  omnibar and find bar (D4).
- **A `storage.local` quota fallback silently reverted on reload.** A
  `settingsLocation` marker is now written and honoured, so an oversized
  configuration survives a reload (D5).
- **Page-scroll settings were inert and `acceleration` was applied twice.**
  `halfPageFraction`/`fullPageFraction` are now read, and `scrollPage` no
  longer multiplies by the acceleration ramp cap (D7).
- **Hints only covered the first viewport.** Culling moved from scan time to
  paint time, so the whole document is hinted and labels appear as targets
  scroll into view (D8). The HUD now counts labels that actually painted (D9).
- **The per-site editor could not express what the engine supported.**
  Disabled commands, keymap overrides and force-insert selectors are all
  editable (D10), removal is by value/identity rather than a stale index (D12),
  and rebinding accepts multi-key chords like `g g` with an "Add chord" action
  (D11).
- **The onboarding tour marked itself complete before it was shown**, so
  closing the tab on step 1 lost it forever. The flag is set on finish (D13).
- **`detectInsertMode` ran a full ancestor walk on every keystroke.** Now
  memoised per focused element and profile set (D14).
- **The scroll target was resolved 2–3× per keypress**, each walk calling
  `getComputedStyle`. Resolved once per gesture and clamped at the edge (D15).
- **Tab search fetched 200 history rows and 500 bookmarks it discarded.**
  `loadSources()` is now scoped (D16).
- **Find rebuilt every highlight box on every scroll frame.** Boxes are pooled
  and repositioned (D17).

### Changed
- **Build output lives in `dist/` only.** `scripts/make-icons.mjs` no longer
  copies the built tree back into the repo root, and `/assets/` + `/options/`
  are gitignored; the stale tracked artefacts were deleted (D18).
- **Sourcemaps are development-only.** Production builds emit zero `.map`
  files (D19).
- `README.md` gained a **Known limitations** section, and `PLAN.md`/`PLAN-V2.md`
  now carry per-item completion status (D20, D21).

### Tests
- Added `visual-controller.test.ts`, `find-controller.test.ts` and
  `scroll-engine.test.ts` (which also covers `dispatchCommand`). Suite is now
  **66 tests across 12 files** (D22, partial).

---

## [1.0.0] — 2026-10-03

> ⚠️ This entry described an aspiration, not the shipped state: several of the
> features listed below were broken at runtime until the correctness pass
> above. Kept for history.

### Added
- **Kestrel** identity (renamed from the `vimium-next` codename) with a real
  toolbar action, first-class keyboard commands, and a licence/repo foundation.
- **Omnibar** (`o` / `O`) — frecency-ranked history, bookmarks, open tabs and
  direct URL entry, plus keyword search engines (`g`, `gh`, `w`, `yt`).
- **Tab search** (`T`) — fuzzy switcher over open tabs.
- **In-page find** (`/`) — incremental match, `n`/`N` cycling, highlight overlay.
- **Visual mode** (`v`) — hint-select multiple elements, copy text/links with `y`.
- Clipboard & URL commands: `yy`, `p`, `P`, `r`, `R`, `g i`, `g e`.
- **Vimium config import** — real `map`-line parser with an import report.
- **Settings lifecycle** — versioned migrations, `chrome.storage.onChanged`
  live sync, and quota detection with a transparent `storage.local` fallback.
- **Accessibility pass** — focus-trapped dialogs, `aria-live` toast and mode
  badge, labelled options controls, keyboard-only options navigation.
- **Onboarding tutorial** — an interactive first-run walkthrough.
- Debug inspector (opt-in) explaining why a key did or did not resolve.

### Fixed
- Command palette now **executes** the selected command (was a read-only list).
- Cheat sheet toggles, closes on `Escape`, and no longer leaks DOM nodes.
- Hint labels follow the page and the target when scrolling/resizing; offscreen
  targets are culled and detached elements dropped.
- Custom per-site `keymapOverrides` are applied (previously discarded silently).
- Site matching unified in one documented, tested module; disabled-site
  patterns no longer silently strip paths.
- `navigateTo` no longer leaks a `tabs.onUpdated` listener per jump.
- Scroll engine targets the nearest scrollable container, not just `window`.
- `forceInsertSelectors` now matches ancestors, so nested composers work.

### Removed
- The inert `telemetryOptIn` toggle (nothing to opt into).
