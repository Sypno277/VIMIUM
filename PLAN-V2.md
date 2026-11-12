# Kestrel — Functional Correctness Plan (v2)

> **✅ EXECUTION STATUS (this pass):** D1–D21 are **implemented and verified**.
> `npm run typecheck` clean · `npm run lint` clean (0 errors, 0 warnings) ·
> `npm test` **66/66 across 12 files** · `npm run build` green with **0 sourcemap
> files** and **no artefacts written outside `dist/`**.
> Outstanding: D22 remainder (`hints-controller`, `modal`, `omnibar-controller`,
> `options/*` suites), Phase 5 perf budgets, Phase 6 release readiness.
> Per-defect status is tabulated in §2b.
>
> **Supersedes:** `PLAN.md` (kept as the historical v1 audit; most of its Phase 0–2 work has landed).
> **Ground truth at time of writing** — measured, not assumed:
>
> | Check | Result |
> | --- | --- |
> | `npm run typecheck` | clean (strict + noUnusedLocals + noImplicitOverride) |
> | `npm test` | 51/51 across 9 files |
> | `npm run build` | content 75.67 kB (gzip 23.12), background 7.27 kB, options 22.84 kB |
>
> The code compiles, the tests pass, and **six shipped features are still broken at runtime**. Every defect below was found by reading the execution path, not by guessing, and each one is reproducible from the code as written.

---

## 1. What is genuinely done

Confirmed by reading the implementation, not the README:

- **Keymap resolver** (`keymap/keymap.ts`, `keymap/tokens.ts`) — correct, exhaustive, well tested.
- **Command palette** (`ui/command-palette.ts`) — the v1 `settle()`/`close()` promise bug **is fixed**; `choose()` settles exactly once and `ui.test.ts` covers it.
- **Cheat sheet** (`ui/cheat-sheet.ts`) — now a `Modal`: Escape, focus trap, no `innerHTML`, no orphan nodes.
- **Modal base** (`ui/modal.ts`) — one focus trap, `role="dialog"`, `aria-modal`, focus restore. Genuinely reused.
- **Site policy** (`settings/site-policy.ts` + `site-match.ts`) — one owner for "what applies on this host"; user `keymapOverrides` now fold in.
- **Hint labels** (`hints/hint-labels.ts`) — base-K + home-row + `numbers` style, all implemented.
- **Hint overlay geometry** (`hints/hint-overlay.ts`) — labels are positioned from live `getBoundingClientRect()` with rAF-throttled scroll/resize tracking. The v1 "labels detach on scroll" bug **is fixed**.
- **Storage layer** (`storage/*`) — migrations, quota measurement, `storage.onChanged` live sync, local fallback.
- **Vimium import** (`migration/vimium.ts`) — a real parser with `unmap`/`unmapAll`/comment handling.
- **Omnibar + tab search** — frecency ranking, keyword engines, URL entry, tab activation.
- **Typed message protocol** (`core/messages.ts`) — `narrowMessage()` + exhaustive background switch.
- **Background navigation** — single `onUpdated` listener with pending map, timeout, `onRemoved` eviction.

The foundation is sound. What follows is what still does not work.

---

## 2. Defect register

### P0 — shipped, reachable, and broken

#### D1 · Visual mode is a keyboard deadlock — the user cannot get out

`visual/visual-controller.ts` › `buildToolbar()`:

```ts
bar.id = DOM_IDS.visual;          // "kestrel-visual"
```

`DOM_IDS.visual` **is listed in `MODAL_IDS`** (`ui/dom-ids.ts`). `content/content-controller.ts` › `onKeyDown` runs this before anything else:

```ts
if (anyModalOpen()) return;       // returns for EVERY key
if (this.modes.is("visual")) { … this.visual.feed(...) }   // unreachable
```

**Net effect:** pressing `v` mounts the visual overlay and sets the toolbar id. From that keystroke onward every key — including `Escape` — is swallowed by the "a modal owns the keyboard" guard. `feed()` is never called again. The only exit is a page reload.

**Fix:** the visual toolbar is not a modal. Remove `DOM_IDS.visual` from `MODAL_IDS`, or give the toolbar a non-modal id such as `kestrel-visual-bar`. Add a jsdom test that enters visual mode and asserts `Escape` exits.

#### D2 · Find leaks listeners and re-paints a dead overlay forever

`find/find-controller.ts` registers `window.addEventListener("scroll" | "resize", this.onScroll, true)` in its constructor. `dispose()` is the only thing that removes them — and **`dispose()` is called from nowhere**. `content/content-controller.ts` › `enterFind()` only nulls its field in the `onDismiss` callback:

```ts
this.find = new FindController(this.settings, () => {
  if (this.find) this.lastFindQuery = this.find.query || this.lastFindQuery;
  this.find = null;                  // controller abandoned, listeners alive
  this.modes.reset();
});
```

**Net effect:** every `/` session permanently adds two window listeners. Each later scroll invokes `paint()` on a closed controller, which rebuilds hundreds of absolutely-positioned `<div>`s into a **detached** layer. On a long-lived tab this compounds: N sessions x every scroll event.

**Fix:** make the controller own its teardown — `onDismiss` must call `dispose()`, and `dispose()` must be idempotent.

#### D3 · `n` / `N` after find jump to the wrong match

`content/content-controller.ts` › `findStep()`:

```ts
this.enterFind();
const controller = this.find as FindController | null;
controller?.prefill(this.lastFindQuery);  // run(false) -> current = 0
controller?.step(delta);                  // current = 1
```

`prefill()` runs the search and resets `current` to `0`, then `step(1)` advances to `1`. The user asked for *the next* match and lands on the **second**. The previous index is also discarded, so `n` never resumes from where the last search ended.

**Fix:** `FindController` keeps `current` across sessions keyed by query; `findStep` opens the bar pre-filled **without** selecting, then steps once.

#### D4 · `:tabopen <url>` and friends silently discard the argument

`commands/arguments.ts` parses a real command line:

```ts
case "tabopen": return { command: "openOmnibarNewTab", raw, args: rest || undefined };
```

`ui/command-palette.ts` › `choose()` correctly returns it (`args: line.args`). Then `content/content-controller.ts` › `enterCommand()`:

```ts
if (result.command) this.run(result.command);   // result.args never read
```

**Net effect:** typing `:tabopen https://example.com` opens an **empty** omnibar. Same for `:open`, `:find <query>`, `:bookmarks`. The whole argument grammar in `arguments.ts` is dead weight — the palette is still, functionally, the read-only menu v1 complained about, just one layer deeper.

**Fix:** thread `args` through `dispatchCommand` (add an optional `CommandArgs` parameter) into `openOmnibar(prefill?)` / `enterFind(prefill?)`.

#### D5 · A quota fallback to `storage.local` silently reverts on reload

`storage/settings-store.ts` › `write()` falls back to `local` when `sync.set` rejects. But `readRaw()` prefers sync unconditionally:

```ts
const sync = ...;
if (sync) { this.setQuota({ usingLocalFallback: false }); return sync; }
const local = ...;
if (local) { ... return local; }
```

**Net effect:** a user whose settings exceed the 8 KB sync limit gets them written to `local`, sees "Sync quota exceeded · using local storage", reloads — and is back to the *old* sync settings with no warning. Their configuration is silently lost on every load.

**Fix:** write a `_store: "local"` marker alongside the local copy and have `readRaw()` honour it, or stamp both copies with a monotonically increasing `_savedAt` and take the newer.

#### D6 · The onboarding tutorial does not block page shortcuts

`onboarding/tutorial.ts` sets `super({ id: DOM_IDS.palette + "-tutorial", … })` — `"kestrel-palette-tutorial"`, which is **not** in `MODAL_IDS`. It renders as a `Modal` with a backdrop and a focus trap, but the content controller's `document`-level capture listener runs first and does not know it exists.

**Net effect:** during the first-run tour, pressing `f` opens hints *on top of* the tutorial, `j` scrolls the page, and `:` opens the palette behind it. The tour asks the user to press real keys to build muscle memory — and every one of those keys also fires the real command.

**Fix:** register the tutorial as a key-owning overlay (add its id to `MODAL_IDS`, or have it set an explicit `anyModalOpen` flag).

---

### P1 — works on the happy path, wrong in real use

#### D7 · Two scrolling settings are inert, and `acceleration` is applied twice

- `content/dispatch.ts` hardcodes page fractions: `scrollHalfDown -> fx.scrollPage(0.5)`, `scrollPageDown -> fx.scrollPage(1)`. **`settings.scroll.halfPageFraction` and `fullPageFraction` are never read** anywhere in the codebase, yet `options/tabs/scroll-tab.ts` exposes both as controls.
- `content/scroll-engine.ts` › `scrollPage()` multiplies by the acceleration setting:

```ts
const dy = height * fraction * settings.scroll.acceleration;
```

  With `acceleration: 2` a single `d` scrolls two half-pages. Meanwhile `ramp()` uses the same number as a *cap on key-repeat ramping* (`step * acceleration * 4`, so even `1` yields up to 4x). One setting, two incompatible meanings.

**Fix:** dispatch passes the configured fraction; `scrollPage` stops multiplying by `acceleration`; rename/redefine the setting to what it does (a key-repeat ramp cap) or split it into two documented settings.

#### D8 · Hints only ever appear for what is already on screen

`hints/element-finder.ts` › `isVisible()` culls anything outside the viewport at **scan time**:

```ts
if (r.bottom < -100 || r.top > winHeight + 100 || r.right < -100 || r.left > winWidth + 100) return false;
```

Combined with `HintTargetCache` (which only invalidates on DOM mutation, never on scroll), pressing `f` on a long page gives labels for the current viewport only, and **scrolling mid-session never adds labels for newly visible content**. Every Vimium-family user expects `f` to hint the whole document.

**Fix:** decide explicitly. Either (a) scan the whole document and let `hint-overlay.reposition()` cull at *paint* time (the machinery already exists), or (b) keep viewport scanning but re-scan on scroll (debounced) so the session follows the viewport. Option (a) is closer to user expectation; option (b) is cheaper. Do not leave it as an undocumented halfway house.

#### D9 · The hints HUD under-reports culled targets

`hint-overlay.render()` counts `visible` set membership, then `reposition()` hides offscreen pills afterwards. The HUD says "3 matches" while 1 label is on screen. Minor, but it is the only feedback the user gets during a session.

#### D10 · The per-site editor cannot set what the engine supports

`settings/site-policy.ts` correctly folds `keymapOverrides`. `types.ts` models `disabledCommands`, `keymapOverrides`, `forceInsertSelectors`. `options/tabs/sites-tab.ts` can only create:

```ts
s.siteProfiles.push({ name: v, match: v, disabledCommands: [] });
```

and renders `disabledCommands` as **read-only text**. There is no control for overrides, for the disabled-command list, or for force-insert selectors. Three shipped profile capabilities are unreachable from the UI.

**Fix:** a per-profile editor — disabled-command multi-select, chord capture per overridden command, selector list.

#### D11 · The binding editor cannot capture a multi-key chord

`options/tabs/bindings-tab.ts` › `capture()` uses `tokenFromEvent(e)` for a single keydown and writes `s.keymap[command] = [chord]`. `g g`, `z Shift+H`, `y y` — a third of the default keymap — cannot be authored or re-authored in the UI, and the existing chord is overwritten rather than added to.

**Fix:** accumulate tokens with a short commit window; support "add chord" vs "replace".

#### D12 · `disabledSites` removal uses a stale index

`options/tabs/sites-tab.ts`:

```ts
settings.disabledSites.forEach((site, index) => {
  const rmBtn = button("Remove", "ghost", () => {
    s.disabledSites.splice(index, 1);   // index from render time
```

A re-render makes the closure stale. This is the privacy off-switch; removing the wrong entry is a trust failure.

**Fix:** `s.disabledSites = s.disabledSites.filter((d) => d !== site)`.

#### D13 · The tutorial marks itself complete before it is shown

`content/content-controller.ts` › `maybeShowTutorial()` sets `completedTutorial = true` in the same tick it constructs the controller. Closing the tab on step 1 means the user never sees the tour again — the "zero learning cliff" promise is one accidental close away from gone.

**Fix:** set the flag on *finish*, not on *start*.

#### D14 · `detectInsertMode` runs on every keystroke over every profile selector

`content/content-controller.ts` calls `detectInsertMode(e.target, policy.profiles)` for every keydown not already in a mode; `insert-mode.ts` then walks the full ancestor chain testing every `forceInsertSelectors` entry with `el.matches()`. With several profiles this is a per-keystroke DOM walk plus selector-engine work on the hot typing path.

**Fix:** memoise the last `(target -> result)` pair, and skip the ancestor walk when no active profile declares selectors.

#### D15 · `resolveScrollTarget` runs 2–3x per keypress

`scroll-engine.ts`: `scrollStep()` -> `isVerticalEdgeBlocked()` -> `resolveScrollTarget()` (walks ancestors with `getComputedStyle` per level) and then `scrollBy()` -> `resolveScrollTarget()` again. `getComputedStyle` forces style resolution — the most expensive call in the keystroke path.

**Fix:** resolve once per gesture and pass it down.

#### D16 · Tab search fetches history and bookmarks it will discard

`omnibar/sources.ts` › `loadSources()` always requests 200 history + 500 bookmarks + all tabs. `OmnibarController.hydrate()` fetches everything and throws most of it away for `scope: "tabs"`.

**Fix:** request only what the scope needs.

#### D17 · `find-controller.paint()` rebuilds every match box on every scroll

`paint()` does `this.layer.replaceChildren()` and re-creates a `<div>` per client rect (up to `MAX_MATCHES = 2000`). Called from an rAF on every scroll. On a large page this is a classic jank profile.

**Fix:** keep boxes for the current match only, or reuse a fixed pool and reposition.

---

### P2 — repo hygiene that blocks a release

| ID | Problem | Evidence |
| --- | --- | --- |
| D18 | **Build output is inside the repo and not gitignored.** `scripts/make-icons.mjs` copies `dist/assets` -> `../assets` and `dist/options` -> `../options`. `.gitignore` lists only `dist/`. The tree already contains `assets/content.js`, `assets/background.js`, **two** hashed `settings-store-*.js` copies (stale artifacts), and `.map` files. | `.gitignore`, `make-icons.mjs` |
| D19 | **Sourcemaps ship.** `vite.config.ts` sets `sourcemap: true` for production builds; the `.map` files are copied into the packaged tree. | `vite.config.ts` |
| D20 | **`CHANGELOG.md` and `README.md` assert a fully-working 1.0.0** that contradicts D1–D13. A changelog that lies is worse than none for a pre-release. | both files |
| D21 | **`PLAN.md` describes a repo state that no longer exists** (files listed as "NEW" all exist; bugs listed as open are fixed). It reads as current and is not. | `PLAN.md` |
| D22 | **No DOM coverage for the modules that break.** 9 test files; zero for `HintsController`, `VisualController`, `FindController`, `ScrollEngine`, `Modal`, `OmnibarController`, `options/*`. Every P0 above lives in exactly those modules. | `src/__tests__/` |

---

## 2b. Per-defect completion status

Legend: ✔ done & verified · ◑ partly done · ✗ not done.

| ID | Status | Where the fix lives |
| --- | --- | --- |
| D1 | ✔ | `ui/dom-ids.ts` (`visualBar`, `visual` removed from `MODAL_IDS`), `visual/visual-controller.ts`, `__tests__/visual-controller.test.ts` |
| D2 | ✔ | `find/find-controller.ts` (`dispose()` idempotent, routes through `dismiss()`), `content/content-controller.ts`, `__tests__/find-controller.test.ts` |
| D3 | ✔ | `find/find-controller.ts` (`lastIndexByQuery`), `content/content-controller.ts` (`findStep`), `__tests__/find-controller.test.ts` |
| D4 | ✔ | `content/dispatch.ts` (`args` param), `content/content-controller.ts` (`run(cmd, args)`), `omnibar/omnibar-controller.ts` (`prefill`), `__tests__/scroll-engine.test.ts` |
| D5 | ✔ | `storage/settings-store.ts` (`LOCATION_KEY` marker written + honoured in `readRaw`) |
| D6 | ✔ | `ui/dom-ids.ts` (`tutorial` in `MODAL_IDS`), `onboarding/tutorial.ts` |
| D7 | ✔ | `content/dispatch.ts` (`ScrollFractions`), `content/scroll-engine.ts` (no acceleration multiply), `__tests__/scroll-engine.test.ts` |
| D8 | ✔ | `hints/element-finder.ts` (scan-time culling removed), `hints/hint-overlay.ts` (paint-time cull) |
| D9 | ✔ | `hints/hint-overlay.ts` (`paint()` counts painted pills) |
| D10 | ✔ | `options/tabs/sites-tab.ts` (full profile editor) |
| D11 | ✔ | `options/tabs/sites-tab.ts` (`captureChord`), `options/tabs/bindings-tab.ts` ("Add chord") |
| D12 | ✔ | `options/tabs/sites-tab.ts` (value/identity-based removal) |
| D13 | ✔ | `content/content-controller.ts` (`maybeShowTutorial` sets the flag on finish) |
| D14 | ✔ | `content/content-controller.ts` (`insertCheck` memo) |
| D15 | ✔ | `content/scroll-engine.ts` (`target()` cache, `GESTURE_WINDOW_MS`) |
| D16 | ✔ | `omnibar/sources.ts` (`loadSources(only)`), `omnibar/omnibar-controller.ts` |
| D17 | ✔ | `find/find-controller.ts` (pooled boxes via `boxAt`) |
| D18 | ✔ | `scripts/make-icons.mjs`, `.gitignore` (`/assets/`, `/options/`), root artefacts deleted |
| D19 | ✔ | `vite.config.ts` (`wantsSourcemap(mode)`) |
| D20 | ✔ | `README.md` "Known limitations"; `CHANGELOG.md` per-defect entry, 1.0.0 block marked aspirational |
| D21 | ✔ | Both plans now banner their own status |
| D22 | ◑ | Added `visual-controller`, `find-controller`, `scroll-engine` (=dispatch) suites. Still missing: `hints-controller`, `modal`, `omnibar-controller`, `options/*` |

---

## 3. Execution plan

Six phases. Each ends green (`typecheck` + `lint` + `test` + `build`) and each has acceptance criteria that must be **demonstrated**, not asserted.

### Phase 1 — Truth pass *(small, do first)*
The docs currently overstate reality; fix that before anything else so the plan and the product agree.

| # | Task | Files |
| --- | --- | --- |
| 1.1 | Move build output out of the repo: emit to `dist/` only, drop the root sync, delete tracked `assets/` + `options/` artifacts | `scripts/make-icons.mjs`, `.gitignore` |
| 1.2 | `sourcemap` only when `mode === "development"` | `vite.config.ts` |
| 1.3 | Rewrite `CHANGELOG.md` to state exactly what works vs. what is known-broken | `CHANGELOG.md` |
| 1.4 | Add a "Known limitations" section to `README.md` listing D1–D13 | `README.md` |
| 1.5 | Banner `PLAN.md` as historical | `PLAN.md` |

**Acceptance:** `git status` is clean after a build; the packaged tree contains no `.map`; the extension loads unpacked **from `dist/`** with zero manifest warnings.

### Phase 2 — The P0 six *(the "it actually works" phase)*

| # | Task | Defect |
| --- | --- | --- |
| 2.1 | Remove `DOM_IDS.visual` from `MODAL_IDS`; give the toolbar a non-modal id; verify `Escape` exits | D1 |
| 2.2 | `FindController.onDismiss` -> `dispose()`; make `dispose()` idempotent and remove both listeners | D2 |
| 2.3 | Preserve `current` across find sessions; `n`/`N` step from the last match, not from 0 | D3 |
| 2.4 | Thread palette `args` through `dispatchCommand` into `openOmnibar(prefill)` / `enterFind(prefill)` | D4 |
| 2.5 | Add a store-location marker so a `local` fallback survives reload | D5 |
| 2.6 | Register the tutorial as a key-owning overlay | D6 |

**Acceptance (each run in a real browser, unpacked from `dist/`):**
- `v` -> `Escape` returns to normal mode; the toolbar is gone; page keys work again.
- Open `/` five times; scrolling afterwards does no paint work (no detached-layer rebuilds).
- `/foo`, Escape, `n` -> lands on the **next** match after the last visited one.
- `:tabopen example.com` opens the omnibar **pre-filled** with `example.com`.
- Force settings past 8 KB, reload -> the user's settings are still there and the header still says local.
- First run: during the tour, `f` does not open hints.

### Phase 3 — Scrolling and per-site correctness

| # | Task | Defect |
| --- | --- | --- |
| 3.1 | Dispatch passes `scroll.halfPageFraction` / `fullPageFraction`; stop multiplying `scrollPage` by acceleration | D7 |
| 3.2 | Resolve the scroll target once per gesture; reuse for edge check and scroll | D15 |
| 3.3 | Decide the hint-scan policy (whole-document vs viewport+rescan) and implement it consistently | D8 |
| 3.4 | HUD count reflects *painted* labels | D9 |
| 3.5 | Per-site editor: disabled commands, keymap overrides, force-insert selectors | D10 |
| 3.6 | Multi-chord capture in the binding editor ("add chord" / "replace") | D11 |
| 3.7 | Value-based removal for `disabledSites` and `siteProfiles` | D12 |
| 3.8 | Set `completedTutorial` on finish, not on start | D13 |

**Acceptance:** with `halfPageFraction: 0.25`, `d` scrolls a quarter page; changing "Half-page fraction" in the options UI has an observable effect. A user profile with `keymapOverrides: { scrollDown: ["n"] }` set **from the UI** makes `n` scroll and unmasks `j`. `g g` can be authored in the binding editor. Hints on a 3-viewport page either show for the whole page or follow the viewport — documented in the UI either way.

### Phase 4 — Test the modules that break

Add jsdom coverage for every P0/P1 path. This is the phase that stops these from coming back.

| Suite | Must assert |
| --- | --- |
| `visual-controller.test.ts` | enter -> feed -> Escape exits; keys are not swallowed |
| `find-controller.test.ts` | `dispose()` removes listeners; `n` steps from the last index; no layer growth after close |
| `scroll-engine.test.ts` | fraction honoured; inner-container target resolved; clamp at edges; acceleration not double-applied |
| `hints-controller.test.ts` | Backspace pops; Shift+F switches action; sole match auto-activates; Escape cancels |
| `modal.test.ts` | one settlement; focus restored; Tab traps |
| `omnibar-controller.test.ts` | engine routing; tab activation vs navigate; prefill |
| `arguments.test.ts` | every verb + arg round-trips into the dispatch call |
| `site-policy.test.ts` (extend) | user overrides fold over built-ins; disabled-command union |

**Acceptance:** `npm test` >= 100 tests, all green; every P0 has a test that fails if the fix is reverted.

### Phase 5 — Performance budget

Hold measurable numbers, behind `core/perf.ts` and asserted against a generated 300-target page:

- first hint paint **< 50 ms**
- keystroke re-filter **< 8 ms**
- omnibar open with 1000 history rows **< 20 ms**, filter **< 8 ms**

Work: D14 (memoise insert detection), D16 (scope the data fetch), D17 (pool the find boxes), plus node reuse in `hint-overlay` if the budget misses.

**Acceptance:** the numbers are printed by the perf test and would fail the suite if regressed.

### Phase 6 — Release readiness

- Playwright + `--load-extension` E2E: load a fixture page, press `f`, type a label, assert navigation.
- Store assets and a privacy-policy page (required for `<all_urls>`).
- `chrome.i18n` scaffolding with one `messages.json` (translation later, not a refactor later).
- Sensitive-site defaults (banks, mail, password managers) excluded by default.

**Acceptance:** E2E runs in CI on a real Chromium; the packaged `.zip` loads clean in a fresh profile.

---

## 4. Sequencing rationale

Phase 1 is first because **documentation that contradicts the binary is itself a defect** — a user reading the README today is being told visual mode and the argument grammar work.

Phase 2 is second because D1 is a hard deadlock and D5 is silent data loss; both destroy trust faster than any missing feature.

Phase 4 is deliberately *after* the fixes rather than before: writing tests against known-broken controllers means encoding the broken behaviour. The order is fix, then pin.

Nothing in this plan is a rewrite. Every file that exists today keeps its job; the work is making the shipped surface true to its own documentation, then proving it.
