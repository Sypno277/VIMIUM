# Kestrel — The Plan to Perfection

> ⚠️ **HISTORICAL — SUPERSEDED BY [`PLAN-V2.md`](./PLAN-V2.md). Read that instead.**
>
> This document was written against an earlier state of the repository. Most of its
> Phase 0–2 work has since landed: the command palette executes, the cheat sheet
> toggles and closes on Escape, hint labels track scroll, `keymapOverrides` fold in,
> site matching is unified, the omnibar and find mode exist, and the storage layer
> has migrations and quota handling.
>
> Several defects it lists as open are fixed, and several files it labels "NEW" now
> exist. Its bug numbers (§3.1, §3.4, §3.6 …) remain useful as history, but do
> **not** treat its status claims as current. `PLAN-V2.md` is the verified,
> present-tense audit and the plan to execute.
>
> ---
> ## ✅ IMPLEMENTATION STATUS — annotated
>
> Every §3 item in this document has now been checked against the code and,
> where it was still open, fixed. Verified at the end of the pass:
> `npm run typecheck` clean · `npm run lint` clean · `npm test`
> **66/66 across 12 files** · `npm run build` green with **0 sourcemap files**
> and **nothing written outside `dist/`**.
>
> | § | Item | Status |
> | --- | --- | --- |
> | 3.1 | Command palette never executes | ✔ Fixed (`settle()` split from `close()`) |
> | 3.2 | Find mode was a no-op | ✔ Fixed (`find/find-controller.ts`) |
> | 3.3 | Cheat sheet cannot close, leaks nodes | ✔ Fixed (`CheatSheet extends Modal`) |
> | 3.4 | Per-site `keymapOverrides` discarded | ✔ Fixed (`settings/site-policy.ts`) |
> | 3.5 | Manifest keyboard command invalid | ✔ Fixed (`action` + `commands` in manifest) |
> | 3.6 | Hint labels detach on scroll | ✔ Fixed (`hint-overlay` paints from live rects) |
> | 3.7 | `navigateTo` leaks `onUpdated` listener | ✔ Fixed (`background/navigation.ts`) |
> | 3.8 | Three features wired to placeholders | ✔ Fixed (omnibar, tab search, visual mode all real) |
> | 3.9 | Element finder under/over-reports | ✔ Fixed (ordered deepest-first dedupe) |
> | 3.10 | Hints session fragile | ✔ Fixed (explicit key command set, typed-prefix HUD) |
> | 3.11 | Scroll engine only knows `window` | ✔ Fixed (`ScrollEngine` + `resolveScrollTarget`) |
> | 3.12 | Insert-mode dead code / selector hole | ✔ Fixed (ancestor walk, dead code removed) |
> | 3.13 | Two divergent site matchers | ✔ Fixed (`settings/site-match.ts`) |
> | 3.14 | Accessibility was three checkboxes | ✔ Fixed (`ui/modal.ts`, `aria-live`, `label for`) |
> | 3.15 | No settings lifecycle | ✔ Fixed (`storage/` migrations, quota, `onChanged`) |
> | 3.16 | Options page re-renders everything | ✔ Fixed (targeted renderers, `settingsStore.update`) |
> | 3.17 | `innerHTML` + hand-rolled escaper | ✔ Fixed (`createElement` + `textContent`) |
> | 3.18 | Inert settings | ✔ Fixed (`hints.style`, onboarding now live) |
> | 3.19 | Per-keystroke full-document scan | ✔ Fixed (cached scan, node reuse, paint-time cull) |
> | 3.20 | No command integrity test | ✔ Fixed (`__tests__/commands.test.ts`) |
> | 3.21 | `ContentController` god object | ✔ Fixed (split into controller/mode-machine/dispatch/site-policy) |
> | 3.22 | Feature gaps | ◑ Mostly done; store assets, i18n and E2E remain (see PLAN-V2 Phase 6) |
>
> The sections below are kept verbatim as the historical audit. Read them for
> *why* each defect existed; read `PLAN-V2.md` for the present-tense register.
>
> ---
>
> **Current codename:** `vimium-next` · **Target name:** **Kestrel**
> **Status of this document:** historical audit, retained for reference.
> **Ground truth at time of writing:** `npm run build` green (tsc + vite + icons),
> `npm test` → **24/24 passing across 3 files**. The code compiles; several features
> do not *work*.

---

## 1. The name

### Verdict: **Kestrel**

**Tagline:** *Browse at the speed of thought.*

**Wordmark:** `KESTREL` · **CLI/pkg id:** `kestrel` · **Extension name:** `Kestrel — Keyboard Browsing`

#### Why this name is the right one

A kestrel is the hunter that **hovers in place, locks onto a target, and strikes it in a single movement**. That is literally the product's core interaction: press `f`, the page sprouts labels (hover), type the label (lock), and you are *there* (strike). The metaphor is not decorative — it describes the mechanism the whole extension is built around.

Four more reasons it earns its place:

1. **Sharpest eyes for its size.** Kestrels see into the ultraviolet and spot prey from height. The project's `smartFiltering` + computed-role detection exists to *see the real targets* on a page dense with decorative noise. Same idea.
2. **Precision, not force.** A kestrel catches prey on the first attempt; it is not a swooping-generalist like an eagle. The product's promise is one keystroke, one intended target — never a "did I click the right thing" moment.
3. **Brandable and buildable.** Seven letters, one syllable pair (`KES-trel`), pronounceable in every market, with an instantly recognisable silhouette for the icon. It reads well in all-caps for the wordmark and in lowercase for code.
4. **Independent identity.** Vimium is a fine ancestor, but a Vimium-derived brand name caps the product's ceiling and invites trademark/derivative comparisons. Kestrel lets the project stand on its own while `README` still credits the lineage honestly.

#### Shortlist (and why the others lost)

| Name | The idea | Why not |
| --- | --- | --- |
| **Kestrel** | Hover → lock → strike | ✅ **Chosen** |
| **Talaria** | Hermes' winged sandals; navigation + flight | Beautiful, but obscure — nobody spells it on the first try. |
| **Reticle** | The crosshair in a scope; the hint overlay *is* a reticle | Excellent technical fit; weak as a spoken word, hard to say in conversation ("reh-ti-kul?"). |
| **Rote** | Muscle memory; "by rote" — directly names the zero-learning-cliff promise | Smart, but "rote" carries a dull, mechanical connotation. A *delightful* product shouldn't be named after drudgery. |
| **Sigil** | Hint labels as magical glyphs you speak to teleport | Perfect metaphor, but heavily occupied by an existing ebook editor. |
| **Kite** | Short, hovers, strikes | Too generic; collides with a well-known dev tool. |

**One-line pitch to use everywhere:**
> *Kestrel is a keyboard-first browser extension that hovers labels over every link, input and control on the page — type two letters and you're there. It's Vimium's power with none of the cliff.*

#### Rename checklist (Phase 0, ~20 minutes)

| Location | Change |
| --- | --- |
| `manifest.json` | `name`, `description`, `version` bump to `1.0.0` |
| `package.json` | `name: "kestrel"`, `description`, `version` |
| `vite.config.ts` | no change needed (paths are relative) |
| UI identifiers | `#vimium-next-hints`, `#vimium-next-toast`, `#vimium-next-mode`, `#vimium-next-cmd`, `#vimium-next-help` → `#kestrel-*` (do this **once**, imported from a single `src/ui/dom-ids.ts` constant so it never drifts again) |
| `src/options/options.html` | `<title>`, `<h1>` |
| `README.md` | full rewrite of the header + naming paragraph + attribution to Vimium |
| `scripts/make-icons.mjs` | palette follows the new brand (see §5, Phase 5) |
| New files | `LICENSE` (MIT), `.gitignore`, `CHANGELOG.md`, `CONTRIBUTING.md` |

---

## 2. Where the project actually is today

### What genuinely works and is verified

- **Build pipeline** — `tsc --noEmit` clean under `strict` + `noUnusedLocals` + `noUnusedParameters` + `noImplicitOverride` + `noFallthroughCasesInSwitch`. That is a strict configuration and it passes. Keep it.
- **Bundling** — Vite multi-entry produces exactly the 4 artefacts MV3 needs:

  | Artifact | Size | Gzip |
  | --- | --- | --- |
  | `assets/content.js` | 17.56 kB | 6.53 kB |
  | `assets/options.js` | 10.03 kB | 3.68 kB |
  | `assets/storage-*.js` (shared chunk) | 5.74 kB | 1.93 kB |
  | `assets/keymap-*.js` (shared chunk) | 2.21 kB | 0.98 kB |
  | `assets/background.js` | 1.65 kB | 0.73 kB |

  Content script gzipping to **6.5 kB** for what it does is genuinely good. Code-splitting twice across contexts is a real win and should be preserved.
- **Keymap engine** (`src/keymap/keymap.ts`) — token normalization, multi-key chord resolution with pending/prefix semantics, and conflict detection are correct and well tested. This is the best-engineered file in the repo.
- **Hint label allocation** (`src/hints/hint-labels.ts`) — base-K generation with home-row scoring and primary-CTA priority is a real differentiator over Vimium and is honest about its own tie-breaks.
- **Fuzzy + frecency primitives** (`src/omnibar/`) — small, pure, tested, reusable. `blendedRank` is the right shape.
- **Layered insert-mode detection** (`src/content/insert-mode.ts`) — tag → contenteditable → ARIA role → site-profile → confidence score is a *better idea* than Vimium's tag check. The confidence threshold design is correct.
- **Documentation voice** — the README and the in-code comments explain *why*, not just *what*. Keep that standard; the plan below assumes it.

### What the README claims vs. what the code does

The README is the aspirational document, and that is fine — but the gap is currently invisible to a reader and needs to be closed. Verified discrepancies:

| README claim | Reality in code |
| --- | --- |
| "**Command palette** (`:`): fuzzy autocomplete + doc preview" | The palette renders, but **selecting an item never executes anything** (§3.1). |
| "**History / omnibar**: `H`/`L`, `o`/`O`" | `o`/`O` open the **options page**. There is no omnibar UI, and `history`/`bookmarks` permissions are requested but never used. |
| "**Find mode**" | `run()` calls `startFind()`, which sends a message the service worker has **no case for**. No-op plus a misleading toast. |
| "**Tab management** … `T`" (tab search) | `tabSearch` opens the options page at `#tabs`. |
| "**Visual mode (stub)**" | Honest. ✅ |
| "**Per-site behavior** … custom overrides" | Custom `disabledCommands` work; custom **`keymapOverrides` are silently discarded** (§3.4). |
| "**Onboarding**" | No onboarding exists; `onboarding.*` settings are never read. |
| "**Plain-language privacy explainer**" | Present and good. ✅ |
| "**Accessibility as first-class**" | Three toggles exist, but the overlays have **no ARIA**, the toast has no `aria-live`, and the options rows **don't associate labels with their controls** (§3.14). |

This plan assumes the README is the *intent*, and the work is to make the code true to it — or to move the unmet parts under an explicit "Planned" heading.

---
## 3. Audit — what is broken, ranked

Every item below was found by reading the source, not by guessing. Severity tiers:

- **P0 — Dead or lying.** A feature is advertised, reachable, and does nothing (or the wrong thing).
- **P1 — Incorrect.** Works in the happy path, fails or degrades in real use.
- **P2 — Architecturally wrong.** Will block future work and cause repeated bugs.
- **P3 — Missing.** Promised in the README, absent from the code.
- **P4 — Hygiene.** Slows every future change.

### 3.1 · P0 · The command palette never executes a command

**This is the most serious defect in the repo.** `:` opens a beautiful fuzzy palette, the user picks "Scroll to bottom", and *nothing happens*.

`src/ui/command-palette.ts` › `choose()`:

```ts
private choose(name: CommandName, raw: string): void {
  this.close();                              // ← close() RESOLVES the promise with { raw }
  this.resolver?.({ command: name, raw });   // ← no-op: close() already set resolver = null
  this.resolver = null;
}
private close(): void {
  this.root?.remove();
  this.root = null;
  this.resolver?.({ raw: this.input?.value ?? "" });   // ← resolves with raw ONLY
  this.resolver = null;                               // ← resolver cleared here
}
```

`open()` returns `Promise<CommandPaletteResult>`. Because `close()` runs first *and already invokes the resolver*, the value `{ command, raw }` that `choose()` then tries to send is never delivered — the resolver is `null`. The caller in `src/content/content-script.ts` › `startCommand()`:

```ts
const res = await this.palette.open(this.settings);
...
if (res.command) this.run(res.command);   // res.command is ALWAYS undefined
```

**Net effect:** the palette is a read-only command *browser*. It resolves with `{ raw: ":scrollDown" }` and the command is discarded.

**Root cause:** one function is doing two jobs — "tear down the DOM" and "settle the promise" — and `choose()` calls it in the wrong order.

**Fix (phase 1):** split the two concerns.

```ts
private settle(result: CommandPaletteResult): void {
  this.teardown();
  const resolve = this.resolver;
  this.resolver = null;
  resolve?.(result);          // exactly one settlement, ever
}
private teardown(): void { this.root?.remove(); this.root = null; }
```

`choose()` → `settle({ command: name, raw })`; Escape → `settle({ raw })`; backdrop click → `settle({ raw })`. Add a unit test that asserts `open()` resolves with a `command` after `choose()`, and that it can only settle once (a second `settle()` must be a no-op). This bug class — *"a promise that resolves with the wrong shape"* — is exactly why the palette needs a test.

### 3.2 · P0 · Find mode is a no-op with a dishonest toast

`src/content/content-script.ts` › `run()`:

```ts
case "enterFindMode": return this.startFind();
```

and:

```ts
private startFind(): void {
  this.sendToBackground("enterFindMode");
  showToast("Press / then type a query (incremental match)");
}
```

`src/background/service-worker.ts` › `handleCommand()` has **no `enterFindMode` case** — the message falls through to `default: break`. Nothing is wired to the browser's find UI, and the toast instructs the user to press `/` *while they are already in find mode*, which is not a real flow.

**Fix (phase 3):** implement a real in-page incremental find overlay (§5, Phase 3) — a `FindController` with a match counter, `n`/`N` cycling, `Enter`/`Escape`, and a highlight overlay drawn with the CSS Custom Highlight API where available and a fallback `<mark>` walker where not. Until then the command must be **removed from `DEFAULT_KEYMAP`**, not left as a lie.

### 3.3 · P0 · The cheat sheet cannot be closed with `Escape`, and leaks a DOM node on every open

`CheatSheet.open()` unconditionally builds a fresh overlay and appends it to `documentElement`:

```ts
open(settings: ExtensionSettings): void { this.build(settings); }
```

and `build()` ends with `document.documentElement.appendChild(root); this.root = root;`.

Three consequences:

1. **Press `?` twice → two stacked overlays.** `this.root` is overwritten, so the first node is orphaned in the DOM with no reference and is never removable.
2. **`Escape` does nothing.** `build()` only wires a click on the backdrop (`if (e.target === root) root.remove()`). `CheatSheet.close()` exists — and is **called from nowhere**. It is dead code.
3. **`?` is not a toggle.** Every other modal in the product (palette, hints) is a toggle; this one is append-only.

**Fix (phase 1):** `CheatSheet` becomes `toggle(settings)`; `open()` first calls `close()`; add a capture-phase `keydown` handler for `Escape` on the root; register `close()` on the document's `Escape` path in `content-script.ts`; and guard `build()` against double-append. Also route the overlay through the shared `dom-ids` constant (§3.6) so the content-script's key handler can ignore keys while the cheat sheet owns focus.

### 3.4 · P0 · Custom per-site `keymapOverrides` are silently discarded

`src/types.ts` documents the field precisely:

```ts
export interface SiteProfile {
  name: string;
  match: string;
  disabledCommands?: CommandName[];
  keymapOverrides?: Partial<Record<CommandName, KeyChord[]>>;   // ← user-authored overrides
  forceInsertSelectors?: string[];
  builtin?: boolean;
}
```

`src/content/content-script.ts` › `effectiveKeymap()`:

```ts
private effectiveKeymap() {
  if (!this.settings.useBuiltinProfiles) return this.settings.keymap;
  const host = location.host;
  const profile = matchBuiltinProfile(host);              // ← BUILT-INS ONLY
  if (!profile?.keymapOverrides) return this.settings.keymap;
  return { ...this.settings.keymap, ...profile.keymapOverrides };
}
```

Compare with the sibling method `activeProfiles()`, which *does* include user profiles (`for (const p of this.settings.siteProfiles) if (matchesDomain(p.match, host)) out.push(p)`). So the codebase is internally inconsistent: user profiles affect `disabledCommands` but not `keymapOverrides`. A user can author an override in the options UI field that exists for it and it will never take effect, with **no warning anywhere**.

**Root cause:** two methods compute two different notions of "the active profiles for this host". Nothing forces them to agree.

**Fix (phase 1):** one source of truth.

```ts
private activeProfiles(): SiteProfile[]        // built-in + user, in that order
private effectiveKeymap(): Keymap             // folds activeProfiles() over settings.keymap
```

Then delete every other site-matching call site. Add a test: a user profile with `keymapOverrides: { scrollDown: ["n"] }` on `example.com` must make `n` scroll and must unmask `j`.

### 3.5 · P0 · The manifest declares a keyboard command the extension cannot possibly honour

`manifest.json`:

```json
"commands": {
  "_execute_action": { "description": "Open the command palette / options" }
}
```

`_execute_action` is a **reserved** command that Chrome maps to clicking the extension's toolbar icon. It is only valid when the manifest declares a top-level `"action"` key. This manifest **does not**, so:

- `_execute_action` is invalid and will be ignored (or trigger a manifest warning on load),
- there is no toolbar button, no popup, and **no `chrome.commands.onCommand` listener anywhere in the codebase**,
- so the extension has *no* global keyboard entry point at all. Every feature begins with a page-focused keypress.

Compounding this, the codebase **never registers for the actual key events**: there is no `chrome.commands.onCommand.addListener` in `src/background/service-worker.ts`, even though the `commands` permission is requested and explained in the privacy panel.

**Fix (phase 0/1):** add an `"action"` block (`default_title`, `default_icon`) and a real `commands` map (`_execute_action` for the palette, plus e.g. `toggle-enabled` / `focus-omnibar` with suggested keys), and wire `chrome.commands.onCommand.addListener` in the service worker. The privacy explainer in `src/options/options.ts` must be updated to describe what the `commands` permission now actually does. Add the missing typings to `src/chrome.d.ts` (`chrome.action`, `chrome.commands`).

### 3.6 · P0 · Hint labels detach from the page the moment you scroll

This one undermines the product's flagship feature. `src/hints/element-finder.ts` captures geometry **once**:

```ts
const rect = el.getBoundingClientRect();
targets.push({ id, element: el, text, isPrimary, rect });
```

`src/hints/hints-controller.ts` › `render()` then positions every label from that frozen snapshot:

```ts
left: `${t.rect.left}px`,
top: `${t.rect.top}px`,
```

and `refresh()` (the per-keystroke path) re-renders **from the same stale rects**. There is **no `scroll` listener, no `resize` listener, and no positioning `requestAnimationFrame` loop** anywhere in the hints system.

**Net effect:** press `f`, then scroll (trackpad, wheel, or the page's own autoplay/carousel) and every label floats over the wrong element while still *claiming* to point at the right one. On long pages where the user presses `f` then `G`, the overlay is actively misleading. Because the labels are the entire interaction contract, this is a correctness bug, not a cosmetic one.

**Fix (phase 1):** store the element reference only, and derive position at paint time from `getBoundingClientRect()`, re-running on `scroll` / `resize` / `visualViewport` changes, throttled through a single `requestAnimationFrame`. Additionally:

- **cull offscreen targets** — a label for an element above the fold is noise;
- **drop detached elements** — use `element.isConnected` and re-scan on mutation;
- **invalidate on DOM churn** — debounced `MutationObserver` on `documentElement` with `{ childList: true, subtree: true }`.

### 3.7 · P0 · `navigateTo` leaks a `tabs.onUpdated` listener per navigation

`src/background/service-worker.ts`:

```ts
if (x != null && y != null) {
  chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
    if (tabId === tab.id && info.status === "complete") {
      chrome.scripting.executeScript({ ... });
      chrome.tabs.onUpdated.removeListener(listener);   // ← only removed on SUCCESS
    }
  });
}
```

The listener is removed **only** if the tab reaches `status === "complete"`. If the target URL 404s to a network error page, is a download, is a `chrome://`-blocked navigation, is closed mid-load, or the user navigates elsewhere first, `status` never becomes `"complete"` for that tab and the listener **stays registered for the lifetime of the service worker**. Each subsequent `'<mark>` jump across pages adds another. With enough marks this becomes a slow leak of closures, each holding a `tab.id`, and a burst of duplicate `executeScript` calls on the next successful load.

Also: `msg.x`/`msg.y` are read as `any` off `msg: any` and never validated, and a mark's coordinates are **absolute page coordinates** from a *different* document — replaying them onto a new page after load is only meaningful if the new page is identical.

**Fix (phase 1):** extract `navigateAndScroll(url, x, y)` into its own module, install **one** long-lived `tabs.onUpdated` listener at worker start that consults a `Map<tabId, {x, y, deadline}>`, and evict on `complete`, on tab close (`tabs.onRemoved`), and on a timeout. Validate `typeof x === "number" && Number.isFinite(x)` before use. Add `chrome.tabs.onRemoved` to `src/chrome.d.ts` — it is missing entirely.

### 3.8 · P0 · Three advertised features are wired to placeholder behaviour

| Command | Key | What runs today | Decision required |
| --- | --- | --- | --- |
| `openOmnibar` / `openOmnibarNewTab` | `o` / `O` | `openOptions("#omnibar")` — opens the **settings page** | Build the real omnibar (§5, Phase 2) |
| `tabSearch` | `T` | `openOptions("#tabs")` | Build the real tab switcher (§5, Phase 2) |
| `enterVisualMode` | `v` | `showToast("Visual mode (Phase 3)")` | Build visual mode (§5, Phase 3) |

Two of these also **write to a hash that does not exist**: `src/options/options.html` has `id="keys"`, `"scroll"`, `"hints"`, `"sites"`, `"access"`, `"data"`, `"privacy"` — there is **no `#omnibar` and no `#tabs`** section. Even the "open the options page instead" fallback is broken: it lands on the default tab. And the options page never reads `location.hash` on load in the first place, so *no* deep link works, for any tab, including the `#keys` the code assumes.

**Fix (phase 1, even before the real features):** make `options.ts` honour `location.hash` on load and on `hashchange`, and stop sending the user to a settings page for an action they expected to happen *on the page they are looking at*. Until Phase 2 lands, `o`/`O`/`T` should be **unbound** in `DEFAULT_KEYMAP` rather than pointing somewhere wrong — a key that does nothing is better than a key that goes somewhere unexpected.
---

## 3.9 · P1 · The element finder both under- and over-reports targets

`src/hints/element-finder.ts` › `findHintTargets()` contains this containment guard:

```ts
if (targets.some((t) => t.element.contains(el) || el.contains(t.element))) {
  // Prefer the smaller (closest to the actual control) element.
  const bigger = targets.find((t) => t.element.contains(el));
  if (bigger) continue;
}
```

Read the branch carefully. `bigger` is only set when an **existing** target is an **ancestor** of the new element — in which case we skip the new (smaller, more precise) one. When the new element is an **ancestor** of an existing target, the outer `some()` is true but `bigger` is `undefined`, so we fall through and **add the ancestor as a duplicate**, keeping both. The comment says "prefer the smaller element" while the code prefers the *larger*. On a `<div role="button" tabindex="0"><span>Save</span></div>` — an extremely common shape — you get two labels stacked on the same control.

**Fix (phase 1):** replace the pairwise scan with a single de-duplication pass that resolves nesting by policy:

1. Build the candidate list.
2. Sort by document order (`.compareDocumentPosition`) or by DOM depth.
3. Keep the deepest element per unique interactive control, and drop any candidate that is an ancestor of a kept candidate *unless* it is a semantically distinct control (e.g. an `<a>` wrapping a `<button>` is a nested-control smell, not a dedupe case).

Also `isPrimaryCta()` runs `(el.textContent || "").toLowerCase()` on **every** element — that reads `textContent` on the whole subtree and lowercases it. On a page with 300 hints this is 300 full-subtree string materialisations. Restrict the CTA text check to `BUTTON`/`A`/`[role=button]` and cap the string length.

## 3.10 · P1 · The hints session is fragile in ways users will hit within a minute

| Problem | Evidence | Impact |
| --- | --- | --- |
| No visible filter feedback | `render()` only hides labels not starting with `typed`; the typed string itself is never displayed | Users cannot tell what they've typed or recover from a wrong key |
| `Escape` "works" by accident | `feed()` does `this.typed += token.toLowerCase()`, so Escape becomes the literal string `"escape"`, which matches no label, so `matches.length === 0` → `cancel()` | Correct outcome, wrong reason — and `Backspace` is equally accidental (appends `"backspace"`), so you cannot *correct* a mistyped character, only cancel the whole session |
| Second-keystroke chords kill the session | `feed()` lowercases everything, so `Shift+F` becomes `"shift+f"` | Pressing `F` while hinting cancels instead of switching to new-tab mode |
| "Open in new tab" for non-links is a no-op | `activate()`: `if (t.element instanceof HTMLAnchorElement && t.element.href)` … else `click()`; the new-tab branch has only a comment (`// For non-anchor controls opened in a new tab, fall back to dispatching.`) | Pressing `F` on a `[role=button]`, a `<button>`, or a `div[contenteditable]` silently does the *current-tab* thing — the user asked for a new tab and got a navigation away |
| Navigation loses anchor semantics | `location.href = t.element.href` | Ignores `target="_blank"`, `rel="noreferrer"`, download links, `javascript:` hrefs, and same-page `#fragment` smooth-scroll expectations |

**Fix (phase 1):** rewrite the key handling in `HintsController.feed()` as an explicit command set:

```
Escape | Ctrl+[  → cancel
Backspace       → pop one character, re-render, stay active
Enter           → activate the sole remaining match
[0-9a-z]        → append, re-filter, auto-activate on exact match
F (shift)       → switch the active action to openNewTab for this session
```

Display the typed prefix in a small pill at the top of the overlay with the match count (`"gs · 1 of 4"`). For activation: prefer `element.click()` for everything (it is the only path that respects SPA handlers), and for new-tab resolution read the *resolved* URL (`(anchor as HTMLAnchorElement).href`, after the browser has resolved relative URLs) — else fall back to a `window.open` of the resolved href, and never silently redirect the current tab.

## 3.11 · P1 · The scroll engine only knows about `window`

`src/content/scroll.ts` exports `scrollableAncestor(el)` — with the comment *"kept for completeness; the scroll engine can also target inner containers"* — and **nothing calls it**. Every scroll path (`scrollBy`, `scrollPage`, `scrollToEdge`) calls `window.scrollTo` / `window.scrollBy` unconditionally.

**Net effect:** on any app-shaped page that scrolls an inner container instead of the document — GitHub's file browser, Slack, Notion, YouTube Studio, most virtualised lists — `j`/`k` do **nothing**. This is the single most common complaint about keyboard-scrolling extensions, and the project has the fix written and unused.

Further defects in the same file:

- **Inconsistent edge target.** `scrollToEdge()` uses `document.body.scrollHeight` in the reduced-motion branch but `document.documentElement.scrollHeight` in the animated branch. These disagree on pages where `<body>` is not the scroller (very common with `html { overflow: hidden }`).
- **Acceleration never reaches page scrolls.** `scrollStep()` ramps `state.accelStep`, but `scrollPage()` (the `d`/`u` path) and `scrollToEdge()` ignore `acceleration` entirely, so the setting is honoured for `j`/`k` only while the options UI implies it is global.
- **Module-global mutable state.** `const state: ScrollState = {…}` is file-scope, so two frames share one acceleration ramp only by accident of module isolation, and the state can never be reset (e.g. on mode change or settings reload). Any future second consumer of the engine inherits the first consumer's ramp.
- **`prefers-reduced-motion` re-evaluated per call.** `matchMedia(...).matches` is queried on every scroll; on a fast key repeat this is hundreds of media queries per second. Cache it behind a single `MediaQueryList` with a `change` listener.
- **No scroll-boundary awareness.** `scrollStep` scrolls by a fixed `step` regardless of remaining distance, so the last `j` before a page bottom has nothing to do. Vimium-family extensions feel "sloppy" exactly here.

**Fix (phase 1):** make the engine take an explicit target.

```ts
type ScrollTarget = { el: Element | null; max: number };   // null ⇒ window
function resolveScrollTarget(from: Element | null): ScrollTarget
```

Resolve the nearest scrollable ancestor once per scroll *gesture* (not per keypress) by walking up from the focused element, then `document.scrollingElement`. Clamp the delta to the remaining scroll distance. Move `state` into a class (`ScrollEngine`) instantiated once per content script. Cache the reduced-motion query. Make `acceleration` apply uniformly, or document it as `j`/`k`-only in the options UI — but not silently.

## 3.12 · P1 · Insert-mode detection has dead code and a selector-matching hole

`src/content/insert-mode.ts`:

```ts
export function detectInsertMode(el, _host: string, profiles: SiteProfile[]): InsertCheckResult { ... }
```

- **`_host` is an unused parameter** that the caller still passes (`detectInsertMode(e.target, location.host, this.activeProfiles())`). Dead weight in a hot path called on **every keystroke**.
- **`forceInsertSelectors` only matches the exact event target**, not its ancestors and not a shadow host:

  ```ts
  if (p.forceInsertSelectors?.some((sel) => safeMatches(target, sel))) { confidence = 1; }
  ```

  A profile that says `"forceInsertSelectors": [".chat-composer"]` will **not** fire when the user is typing inside a `<textarea>` nested two levels below `.chat-composer`, which is the normal DOM shape. The feature as written is close to useless.
- **`isSiteDisabled()` and `isFullDisable()` are dead.** `isFullDisable` is typed `(_p: SiteProfile): boolean` and returns `false` on every path, so `isSiteDisabled()` can never return `true`:

  ```ts
  function isFullDisable(_p: SiteProfile): boolean {
    return false;   // ← always
  }
  ```

  And it is exported from a module whose consumer (`content-script.ts`) **does not import it** — it has its own `isSiteDisabled()` and its own matcher. Two implementations of the same predicate, one of which is provably unreachable.

**Fix (phase 1):** `detectInsertMode` takes `(el, profiles)`; the profile-selector check walks the ancestor chain (`while (node && node !== document.body)`) and reports *which* profile matched (useful for a debug mode later); delete `isSiteDisabled`/`isFullDisable` from insert-mode and keep exactly one disabled-site implementation.

## 3.13 · P1 · Two divergent site matchers are one rename away from a security bug

| Location | Matcher | Behaviour |
| --- | --- | --- |
| `src/content/content-script.ts` (bottom) | `matchesDomain(pattern, host)` | strips everything after the first `/`, then `*." prefix or exact host equality |
| `src/settings/builtin-profiles.ts` | `matchesSite(pattern, host)` | does **not** strip a path; `*." prefix or exact host equality |

These are called in different places for the same conceptual question. `matchesDomain` is used for user `siteProfiles` and `disabledSites`; `matchesSite` is used for built-ins and by `insert-mode.ts`. So a user who types `example.com/admin` into the "disabled sites" box gets **the whole domain disabled** (path silently stripped), while a built-in profile author who writes a path gets **no match at all**. Neither behaviour is documented, and `disabledSites` is the extension's *off switch* — the one place where surprising matching undermines user trust in a privacy control.

**Fix (phase 1):** one module, `src/settings/site-match.ts`, exporting `matchesSitePattern(pattern, url)` with documented, tested semantics: host-only patterns match the whole host; patterns containing a path match `host + pathname` by prefix; leading `*.` matches any subdomain; matching is case-insensitive; malformed patterns never match. Unit-test the matrix.

## 3.14 · P1 · "Accessibility as a first-class feature" is currently three checkboxes

The claim is bold and the implementation does not back it yet. Concretely:

- **The options form never associates labels with controls.** `rowWith(labelText, control)` in `src/options/options.ts` builds `<div class="row"><label>Text</label><control></div>`. The `<label>` has no `for` and does not wrap the control, so screen readers announce an unlabelled checkbox and the label is not clickable to focus its input. Fix: `label.htmlFor = input.id = crypto.randomUUID()` (or an explicit id map).
- **The toast is invisible to assistive tech.** `showToast()` creates a plain `<div id="…-toast">` with no `role="status"` and no `aria-live="polite"`, so every piece of feedback the extension gives ("Mark 'a' set", "No hints available") is silent to a screen-reader user.
- **The mode badge is silent too.** `setModeBadge()` has no `role="status"` / `aria-live`, so the extension's whole "which mode am I in?" affordance — the thing that prevents users from getting stuck — is unannounced.
- **Overlays are divs with no role.** The hints overlay, palette, cheat sheet and (future) omnibar are `<div>` soup with no `role="dialog"`, no `aria-modal`, no accessible name, **no focus management, and no focus trap**. Opening the palette moves focus into an `<input>` but does nothing on close, so the user is dumped onto `<body>` and the next Tab starts from the top of the document.
- **`Escape` is not a universal dismiss.** Escape works in the palette (via its own handler) but not in the cheat sheet or in a hover-hint session.
- **The high-contrast palette is not actually high contrast.** `hints.highContrast` chooses `background: "#000"` with `color: "#fff"` — fine on the label itself, but the label sits at `z-index: 2147483645` over arbitrary page content with only `box-shadow: 0 1px 2px rgba(0,0,0,0.5)` for separation, so it still disappears over dark imagery. Needs an outline (`outline: 2px solid #fff` under a black fill, or a 1px ring in the inverse colour).

**Fix (phase 3, as a dedicated accessibility pass):** one `Modal` base class that every overlay inherits — handles the focus trap, restore-focus-on-close, `role="dialog"` + `aria-modal` + `aria-labelledby`, Escape-to-dismiss, and `prefers-reduced-motion` for its entrance. Plus `aria-live` regions for toast and badge, `label`/`for` pairing in the options UI, and a keyboard-navigable options page verified with the tab key alone.

## 3.15 · P2 · No settings lifecycle: no live sync, no migration runner, no quota guard

- **`SETTINGS_VERSION = 1` exists and nothing reads it.** `normalizeSettings()` merges defaults over stored values but there is no `migrate(from, to)` step, so the first time a shape changes (`hints.style` becoming an enum, a keymap chord being renamed, a profile field being removed) every existing user silently carries the old shape forever, and the "newly added keys are populated" comment becomes false for anything nested deeper than the two hand-listed objects (`scroll`, `hints`, `onboarding`). Note the merge is hand-written and shallow-per-key: adding a field under `siteProfiles[].x` or a fourth settings group requires editing `normalizeSettings` or it will be `undefined` at runtime while TypeScript insists it exists.
- **No `chrome.storage.onChanged` listener anywhere.** Settings are broadcast only through `settingsStore.save()` → `chrome.runtime.sendMessage`. That covers an edit made *in this browser*. It does **not** cover `chrome.storage.sync` pushing a change from another device — which is the entire point of using `sync` — and it does not cover a second browser window whose content script was loaded before the change. A user who changes their keymap on their laptop opens their desktop and gets the old keymap until they reload a page.
- **No quota handling.** `save()` writes the entire settings object as a single `chrome.storage.sync` item. The quota is 8 KB per item / 100 KB total. `siteProfiles` is user-growable and `keymap` holds up to 30 chord arrays; a power user with a few dozen site overrides can exceed 8 KB, at which point `chrome.storage.sync.set` rejects and `save()` **throws with no user-visible error and no fallback to `storage.local`** — the settings UI simply stops persisting.
- **`broadcast()` reaches into `chrome.tabs`** (`chrome.tabs?.query(...)`) from a module that is also imported by the options page and by unit tests, and swallows failures with `.catch(() => {})` and an outer `try/catch`. Silent failure is acceptable here, but the coupling is not: the content-script's *own* message listener is the only receiver that matters for most changes.

**Fix (phase 2):** a real `src/storage/` layer:

```
src/storage/
  settings-store.ts      // cache + get/save/update, single writer
  migrations.ts          // MIGRATIONS: Record<number, (s) => s>, run in order from s.version
  quota.ts               // estimate size, warn at 70%, fall back to local on rejection
  broadcast.ts           // one channel for settings:changed
```

with `chrome.storage.onChanged.addListener` for `sync` and `chrome.storage.sync.getBytesInUse()` surfaced in the options header (it is already implemented in the UI but only as a timestamp). A quota warning must be visible in the options UI, not a swallowed rejection.

## 3.16 · P2 · The options page re-renders the world on every keystroke, and can't be reset

`src/options/options.ts` › `load()` subscribes with `settingsStore.onChange(...) → renderAll()`. Since `settingsStore.save()` fires listeners, **every single control change destroys and rebuilds all seven sections**. Consequences that a user notices immediately:

1. **The keymap search box loses its text** — `renderKeymap()` calls `draw("")`, discarding the filter, so editing a binding while filtered to "hint" resets the list.
2. **The "Rebind" button dies mid-capture.** `captureKeys()` sets `btn.textContent = "Press keys…"`, then awaits `settingsStore.update()`, which synchronously triggers `renderAll()`, which removes that very button from the DOM. The subsequent `btn.textContent = "Rebind"` writes to a detached node. It *looks* fine only because the whole row was rebuilt — with a fresh button bearing fresh listeners, so any in-flight capture state (`state.capturing`) points at a node that no longer exists.
3. **Scroll position and tab focus are lost** on every toggle.
4. **Controls mutate `state.settings` directly** (`(v) => (state.settings.scroll.step = v)`) and then `persist()` saves the whole object, bypassing `settingsStore.update()`'s clone-and-mutate discipline. With the options page open in two windows, the second window's stale `state.settings` is written wholesale over the first's changes — **last-write-wins data loss on a whole settings object**.
5. **No "reset to defaults"** anywhere, despite `DEFAULT_SETTINGS` being the obvious source. A user who breaks their keymap has no way back except a JSON export they didn't make.
6. **The Vimium migration tool is a lie.** `migrateBtn` prepends a comment line to the textarea and shows a toast that says *"Migration tool: paste Vimium map lines above (best-effort parse)"* — there is **no parser**. Importing a Vimium config today silently discards it (it isn't even valid JSON, so `Import` reports "Invalid JSON").

**Fix (phase 2):** replace `renderAll()` with targeted, idempotent renderers that update in place (`renderKeymap` rebuilds only the list, never the search box), hold form state in a small `UIState` that survives re-render, and route **all** writes through `settingsStore.update(s => …)` read-modify-write. Add: a "Reset to defaults" button with a confirm, and a real Vimium `map`-line parser (`src/migration/vimium.ts`) with a unit test over a fixture of real Vimium config lines — this is a genuine growth lever, because "I can import my Vimium config" is the single strongest switch trigger for this product.

## 3.17 · P2 · `innerHTML` + a hand-rolled HTML escaper in the cheat sheet

```ts
row.innerHTML = `<span>${c.label}</span><code style="color:#fbbf24">${escapeHtml(keys)}</code>`;
```

`escapeHtml` is defined at the bottom of `src/ui/cheat-sheet.ts` and escapes `&`, `<`, `>`. Two problems: the values are already user-controlled (`settings.keymap[c.name].join(", ")` is typed by the user in the key-binding editor), and hand-rolled escaping is exactly the construct that grows a hole — `"` and `'` are not escaped, so the moment anyone interpolates a value into an *attribute* rather than element text, it breaks. The correct fix is not a better escaper; it is to stop using `innerHTML` for this at all.

**Fix (phase 1):** build the row from `createElement` + `textContent` (as `options.ts`'s `el()` helper already does). Audit the whole `src/ui/` tree for `innerHTML` and eliminate every instance that interpolates a variable.

## 3.18 · P3 · The telemetry setting, the hint-style setting, and the onboarding settings are inert

| Setting | Declared | Read anywhere? |
| --- | --- | --- |
| `telemetryOptIn` | `src/types.ts`, toggled in the Privacy panel | **No.** No telemetry exists. The toggle implies data collection that is not implemented — the *safest* kind of lie, but still a lie, and it undermines the otherwise excellent privacy panel. |
| `hints.style` (`"letters" \| "numbers" \| "filtered"`) | `src/types.ts`, exposed as a `<select>` in the Hints panel | **No.** `HintsController` only ever reads `hints.chars`. Picking "numbers" changes nothing. |
| `onboarding.completedTutorial`, `onboarding.seenTips` | `src/types.ts` | **No.** The onboarding flow does not exist. |
| `scroll.fullPageFraction` default `1.0` | used | ✅ |
| `scroll.acceleration` | used for `j`/`k` only | ⚠️ §3.11 |

**Fix:** either implement or remove. For `hints.style`, implementing is cheap and valuable ("numbers" matters for users on non-QWERTY layouts — a real accessibility win); `filtered` should become the *default* once §3.10's typed-prefix HUD exists. For `telemetryOptIn`: remove it from the UI until there is something to opt into, or ship it as an explicit no-op labelled "not yet available". For `onboarding`: it is the product's stated differentiator ("zero learning cliff"), so it must be built (§5, Phase 4), not removed.

## 3.19 · P2 · Performance: a full-document scan is triggered per keystroke and per hint session

- `findHintTargetsDeep()` does `root.querySelectorAll("*")` on every root — that is a **full descendant enumeration of the document** — purely to discover shadow hosts, *after* having already run `querySelectorAll(CLICKABLE_SELECTOR)`. On a heavy page that is two full traversals, and it runs on **every** `f` press.
- The shadow-root walk pushes every open `ShadowRoot` onto a stack and re-runs `findHintTargets` per root, each of which again calls `querySelectorAll("*")`. Nested component libraries (a page built from web components) multiply this.
- `targets.some(t => t.element.contains(el))` inside the per-element loop is **O(n²) containment checks**. With 500 candidates on a dense page that is 250k `contains()` calls — each a tree walk.
- Every keystroke in a hint session calls `refresh()` → `this.container.innerHTML = ""` and rebuilds **every** label as a fresh `<span>` with a fresh inline style object (13 style assignments per label). Typing 3 characters on a 300-hint page creates and discards ~900 DOM nodes.
- The content script runs on **every frame of every URL** at `document_start`, including `about:blank` ad frames, PDF viewers, and `chrome-extension://` pages, with no early-out for frames too small to matter (`if (window.innerWidth < 100) return`).
- Nothing observes the DOM between hint sessions, so a page that lazily renders content (infinite scroll, SPA route change) is only re-scanned on the next explicit `f`.

**Fix (phase 2):** scan once per navigation and cache; key the cache on a cheap DOM-revision counter bumped by a debounced `MutationObserver`; replace the O(n²) dedupe with the ordered pass in §3.9; reuse label nodes across keystrokes (toggle `display`, never re-create); batch style application through a single injected stylesheet and `classList` instead of inline styles on every node; early-out tiny/hidden frames. Set a **budget** and hold to it: *first hint paint under 50 ms on a 300-target page, keypress re-filter under 8 ms.* Both are measurable with a `performance.mark`/`measure` pair behind a debug flag.

## 3.20 · P1 · `findHintTargetsDeep` is reached only from one place, and `commands.ts` has no integrity test

Small but sharp: `src/commands/commands.ts` exports `commandNameFromChord()` which **nothing imports**, and there is **no test asserting that every `CommandDef` has a default binding**. Today all 30 line up by hand; the first person who adds a command and forgets the keymap entry gets a silently unreachable command that still appears in the cheat sheet and the palette. Equally, nothing asserts that `DEFAULT_KEYMAP` has **no conflicts** at build time — `findConflicts(DEFAULT_KEYMAP)` is asserted only inside a test that must be remembered.

**Fix (phase 1):** a `src/__tests__/commands.test.ts` that asserts, for every `CommandDef`: (a) a default binding exists, (b) `findConflicts(DEFAULT_KEYMAP)` is empty, (c) every `CommandName` in the union has a `CommandDef`, (d) every command's `category` is one of the declared categories, (e) `needsArgument` implies `argType`. Use an exhaustive `Record<CommandName, CommandDef>` type so a missing entry is a *compile* error. Delete `commandNameFromChord` or use it.

## 3.21 · P2 · `ContentController` is a 170-line god object with five responsibilities

`src/content/content-script.ts` simultaneously: boots the extension, owns settings lifecycle, owns the keymap resolver, implements insert-mode policy, implements site-profile policy, implements the command→effect dispatch table, owns the marks char-wait state machine, owns the frame-message protocol, and constructs every UI surface. That is why §3.4's inconsistency was possible: `effectiveKeymap()` and `activeProfiles()` are two answers to one question living three methods apart, and the mode state machine is scattered across `mode`, `charWait`, and three `if` blocks.

**Fix (phase 2):** split along the seams that already exist in the file.

```
src/content/
  content-controller.ts     // wiring only: init, keydown routing, mode transitions
  mode-machine.ts           // normal | insert | hint | visual | find | command, one transition table
  dispatch.ts               // CommandName → effect (pure mapping, no policy)
  site-policy.ts            // ONE place that answers "what applies on this host?"
  insert-mode.ts            // detection only (input to the policy layer)
```

## 3.22 · P3 · Feature gaps that separate "a Vimium clone" from "the better one"

The README's own differentiators are only half-built. Ranked by user-visible value:

1. **Omnibar** (`o`/`O`/`b`) — the highest-value missing feature. The primitives are already written and *unused by anything*: `frecencyScore`, `blendedRank`, and the `history`/`bookmarks` permissions are requested and never called. Search history + bookmarks + tabs + open URLs, keyword engines (`g foo` → Google, `gh repo` → GitHub), frecency ranking, and paste-and-go.
2. **Tab search** (`T`) — same overlay shape, `chrome.tabs.query` + the same fuzzy matcher.
3. **In-page find** (`/`) — see §3.2.
4. **Visual mode** (`v`) — caret-based or selection-based; at minimum, `v` + hint-select multiple elements and `y` to copy their text/links.
5. **Clipboard + URL basics** — `yy` (copy current URL), `p`/`P` (open clipboard), `r`/`R` (reload / hard reload), `g i` (focus first input), `g e` (focus last input), `m`/`'` are already there.
6. **Link-hover parity** — `;f` exists but §3.10 shows it is unreliable for non-links.
7. **Vimium config import** — see §3.16; the single strongest switching trigger.
8. **Onboarding** — a 60-second interactive tutorial, then a dismissible "you can always press `?`" nudge. This is the "zero learning cliff" promise made real.
9. **Configurable search engines / custom commands** — Vimium's `searchEngines` and `:tabopen`-style argument commands. The palette already resolves a `raw` string and throws it away; §3.1's fix plus an argument grammar turns the palette into a command *line*.
10. **Per-site profile editor that can actually set keymap overrides** (the field exists in the type, the parser works nowhere, and the UI has no control for it).
11. **i18n scaffolding** — `chrome.i18n` + a single `messages.json`, so localization is a translation task later rather than a refactor.
12. **Sensitive-site defaults** — banks, mail, password managers excluded by default rather than by user effort.

## 3.23 · P4 · Repo hygiene — the project cannot be released today even if the code were perfect

| Missing | Why it matters now |
| --- | --- |
| `.gitignore` | `dist/`, `node_modules/`, `*.map` will be committed on the first `git add .` |
| `LICENSE` | No license = "all rights reserved" by default; nobody can legally use or contribute |
| `CHANGELOG.md` | `version: 0.1.0` with no changelog means users have no idea what changed |
| CI (GitHub Actions) | `typecheck` + `test` + `build` must run on every push; nothing does today |
| ESLint + Prettier | No shared style enforcement; `any` appears in `src/chrome.d.ts`, `service-worker.ts` (`msg: any`), and `options.ts` (`v as any`) and nothing catches it |
| Coverage reporting | 3 test files with no coverage gate; untested modules are invisible |
| E2E harness | MV3 extensions need a real-browser test (Playwright + `--load-extension`); none exists, so no bug in §3 is caught automatically |
| `engines` in `package.json` | `"types": ["vite/client"]` + ESM + `structuredClone` implicitly require Node 18+/20+ |
| Store assets + privacy policy page | Chrome Web Store requires a privacy policy URL for `<all_urls>`; there is no page to link to |
| `.editorconfig` / line-ending normalisation | Windows (`CRLF`) is the development environment; nothing pins it |
---

## 4. Target architecture

The current layout is good and should be kept. The changes below are **additions and splits**, not a rewrite — every file that exists today survives, most of them with a narrower job.

```
kestrel/
├─ manifest.json                    # + action, + real commands, + web_accessible_resources
├─ package.json                     # + engines, lint/format/coverage scripts
├─ tsconfig.json                    # unchanged (strict config is a strength)
├─ vite.config.ts                   # unchanged, + a test build target if needed
├─ .gitignore .editorconfig LICENSE CHANGELOG.md CONTRIBUTING.md README.md PLAN.md
├─ .github/workflows/ci.yml         # typecheck · test · build on every push
├─ .eslintrc.cjs  .prettierrc       # with eslint-plugin-import + no-explicit-any
│
├─ scripts/
│  ├─ make-icons.mjs                # real brand mark, 16/32/48/128 + store assets
│  └─ make-store-assets.mjs         # NEW: screenshots/promo tiles from a fixture page
│
└─ src/
   ├─ types.ts                      # single source of truth; CommandName union stays exhaustive
   ├─ chrome.d.ts                   # + action, commands, tabs.onRemoved, tabs.onActivated,
   │                                #   storage.onChanged, runtime.onMessage sender typing
   │
   ├─ core/                         # NEW: shared, context-agnostic, pure
   │  ├─ messages.ts                # typed message protocol (replaces `msg: any`)
   │  ├─ logger.ts                  # debug-gated logging (never console.log in prod paths)
   │  └─ perf.ts                    # performance.mark/measure behind a debug flag
   │
   ├─ commands/
   │  ├─ commands.ts                # registry (unchanged shape)
   │  ├─ defaults.ts                # NEW: DEFAULT_KEYMAP split out of commands.ts
   │  └─ arguments.ts               # NEW: `:tabopen <url>` argument grammar
   │
   ├─ keymap/
   │  ├─ keymap.ts                  # unchanged — it is correct
   │  ├─ tokens.ts                  # NEW: tokenFromEvent + chordToTokens (split out)
   │  └─ conflicts.ts               # NEW: findConflicts + a resolver-integrity check
   │
   ├─ hints/
   │  ├─ element-finder.ts          # + ordered dedupe, + MutationObserver cache
   │  ├─ hint-labels.ts             # unchanged — it is correct
   │  ├─ hints-controller.ts        # + scroll tracking, + key command set, + HUD
   │  └─ hint-overlay.ts            # NEW: DOM rendering only, node reuse, no logic
   │
   ├─ omnibar/                      # NEW: the biggest missing feature
   │  ├─ omnibar-controller.ts      # overlay + keyboard model
   │  ├─ sources.ts                 # history / bookmarks / tabs / open-tabs providers
   │  ├─ engines.ts                 # keyword search engines (`g`, `gh`, `w`)
   │  ├─ frecency.ts                # unchanged (finally used)
   │  └─ fuzzy.ts                   # unchanged
   │
   ├─ find/                         # NEW
   │  └─ find-controller.ts         # incremental find, n/N, Custom Highlight API
   │
   ├─ visual/                       # NEW
   │  ├─ visual-controller.ts       # caret/selection mode
   │  └─ selection-actions.ts       # y / o / search-selection
   │
   ├─ tabs/
   │  └─ tab-search.ts              # NEW: T overlay (shares omnibar primitives)
   │
   ├─ settings/
   │  ├─ settings.ts                # DEFAULT_SETTINGS + normalizeSettings
   │  ├─ site-match.ts              # NEW: the ONE pattern matcher (§3.13)
   │  ├─ site-policy.ts             # NEW: the ONE "what applies on this host?" answer (§3.4)
   │  └─ builtin-profiles.ts        # curated data only
   │
   ├─ migration/
   │  └─ vimium.ts                  # NEW: real `map`-line parser (§3.16)
   │
   ├─ storage/
   │  ├─ settings-store.ts          # cache + get/save/update + sync.onChanged
   │  ├─ migrations.ts              # versioned migrations (reads SETTINGS_VERSION)
   │  ├─ quota.ts                   # size estimate + local fallback
   │  └─ broadcast.ts               # one settings:changed channel
   │
   ├─ content/
   │  ├─ content-controller.ts      # wiring only (was content-script.ts)
   │  ├─ mode-machine.ts            # NEW: explicit transition table
   │  ├─ dispatch.ts                # NEW: CommandName → effect, no policy
   │  ├─ insert-mode.ts             # detection only, ancestor-aware selectors
   │  ├─ scroll-engine.ts           # class-based, inner-container aware
   │  └─ marks.ts                   # unchanged + a mark-list UI hook
   │
   ├─ ui/                           # every overlay shares these
   │  ├─ dom-ids.ts                 # NEW: every element id in one place (§3.6)
   │  ├─ modal.ts                   # NEW: focus trap, aria-modal, Escape, restore focus
   │  ├─ styles.ts                  # NEW: one injected stylesheet, CSS custom properties
   │  ├─ toast.ts                   # + role="status" aria-live="polite"
   │  ├─ badge.ts                   # split out of toast.ts, + aria-live
   │  ├─ command-palette.ts         # + settle()/teardown() split (§3.1), + argument grammar
   │  └─ cheat-sheet.ts             # + toggle, + Escape, + no innerHTML (§3.3, §3.17)
   │
   ├─ background/
   │  ├─ service-worker.ts          # thin: message router only
   │  ├─ tab-commands.ts            # NEW: next/prev/close/restore/new/mute/pin
   │  ├─ navigation.ts              # NEW: one onUpdated listener + pending map (§3.7)
   │  ├─ omnibar-data.ts            # NEW: history/bookmark queries for the omnibar
   │  └─ commands-router.ts         # NEW: chrome.commands.onCommand (§3.5)
   │
   ├─ options/
   │  ├─ options.html               # + hash routing, + a11y markup
   │  ├─ options.ts                 # targeted renderers, not renderAll() (§3.16)
   │  ├─ tabs/                      # NEW: one module per options tab
   │  │  ├─ bindings-tab.ts
   │  │  ├─ scroll-tab.ts
   │  │  ├─ hints-tab.ts
   │  │  ├─ sites-tab.ts
   │  │  ├─ access-tab.ts
   │  │  ├─ data-tab.ts
   │  │  └─ privacy-tab.ts
   │  └─ styles.css                 # extracted out of options.html
   │
   ├─ onboarding/                   # NEW
   │  └─ tutorial.ts                # the "zero learning cliff" promise, made real
   │
   ├─ debug/                        # NEW: opt-in, ships disabled
   │  └─ inspector.ts               # why did this key do nothing? which profile? which target?
   │
   └─ __tests__/
      ├─ unit/                      # one file per module
      └─ fixtures/                  # vimium-config.txt, hint-pages.html, etc.
```

**The three structural rules this layout enforces:**

1. **One question, one owner.** "What applies on this host?" lives only in `settings/site-policy.ts`. "How do I match a site pattern?" lives only in `settings/site-match.ts`. "What does this message look like?" lives only in `core/messages.ts`. Every duplicate-answer bug in §3.4 and §3.13 is impossible by construction under these rules.
2. **Logic and DOM never share a file.** `hints-controller.ts` decides, `hint-overlay.ts` paints. `ui/modal.ts` owns focus and ARIA so no overlay reinvents it.
3. **Contexts are thin.** The service worker routes; it does not decide. The content controller wires; it does not implement policy.

---

## 5. The phased plan

Six phases. Each phase is independently shippable, ends with the repo green (`typecheck` + `test` + `build`), and has explicit **acceptance criteria** that must be demonstrated — not assumed.

### Phase 0 — Identity and foundation *(target: well under a day)*

The rename and the repo scaffolding. Nothing here is risky; all of it is required before anyone else looks at the project.

| # | Task | Files |
| --- | --- | --- |
| 0.1 | Apply the Kestrel rename per §1's checklist | `manifest.json`, `package.json`, `options.html`, `README.md` |
| 0.2 | Add `action` + real `commands` to the manifest, bump to `1.0.0` | `manifest.json` |
| 0.3 | Add `src/ui/dom-ids.ts` and replace every `"vimium-next-*"` literal with a constant | `ui/*`, `content/*` |
| 0.4 | `LICENSE` (MIT), `.gitignore`, `.editorconfig`, `CHANGELOG.md`, `CONTRIBUTING.md` | repo root |
| 0.5 | CI workflow running `npm ci && npm run typecheck && npm test && npm run build` | `.github/workflows/ci.yml` |
| 0.6 | ESLint + Prettier configs with `no-explicit-any`, `import/no-cycle`, `import/order`; fix the handful of existing `any` sites | `.eslintrc.cjs`, `.prettierrc`, `src/**` |
| 0.7 | Add `engines: { node: ">=20" }` and `lint`/`format`/`coverage` scripts to `package.json` | `package.json` |

**Acceptance:** `npm run lint && npm run typecheck && npm test && npm run build` all pass; the extension loads in Chrome with **zero** manifest warnings; the icon click does something observable.

---

### Phase 1 — Fix everything that is dead or lying *(the "make it true" phase)*

This is the highest-value phase in the whole plan. Every task maps to a numbered defect in §3, and the phase's exit condition is **"nothing the UI offers is a lie."**

| # | Task | Defect | Files |
| --- | --- | --- | --- |
| 1.1 | Split `settle()` / `teardown()` in the palette so selecting an item executes it | §3.1 | `ui/command-palette.ts` |
| 1.2 | Unbind `enterFindMode` from `/` until Phase 3 ships a real implementation; remove the dishonest toast | §3.2 | `commands/defaults.ts`, `content/dispatch.ts` |
| 1.3 | `CheatSheet.toggle()` + Escape + `close()` wired + no double-append | §3.3 | `ui/cheat-sheet.ts`, `content/content-controller.ts` |
| 1.4 | Build `settings/site-policy.ts`; `effectiveKeymap()` and `activeProfiles()` both read it | §3.4 | `settings/site-policy.ts`, `content/*` |
| 1.5 | Unbind `openOmnibar`, `openOmnibarNewTab`, `tabSearch` until Phase 2; make `options.ts` honour `location.hash` | §3.8 | `commands/defaults.ts`, `options/options.ts` |
| 1.6 | Position hint labels at paint time; track `scroll`/`resize`/`visualViewport`; cull offscreen; drop `!isConnected` | §3.6 | `hints/*` |
| 1.7 | Rewrite `HintsController.feed()` as an explicit key command set (Escape/Backspace/Enter/Shift-F) + typed-prefix HUD | §3.10 | `hints/hints-controller.ts`, `hints/hint-overlay.ts` |
| 1.8 | Fix the element-finder dedupe to prefer the *deepest* control, in one ordered pass | §3.9 | `hints/element-finder.ts` |
| 1.9 | One `tabs.onUpdated` listener + pending map with timeout and `onRemoved` eviction | §3.7 | `background/navigation.ts`, `chrome.d.ts` |
| 1.10 | Delete `escapeHtml`; rebuild cheat-sheet rows with `textContent`; audit every `innerHTML` in `src/ui/` | §3.17 | `ui/*` |
| 1.11 | Unify the two site matchers into `settings/site-match.ts` with documented semantics | §3.13 | `settings/site-match.ts`, `settings/builtin-profiles.ts`, `content/*`, `insert-mode.ts` |
| 1.12 | Make `forceInsertSelectors` ancestor-aware; delete `isSiteDisabled`/`isFullDisable` and the unused `_host` param | §3.12 | `content/insert-mode.ts` |
| 1.13 | Scroll engine: resolve the real scroll target (inner container first), clamp to remaining distance, cache reduced-motion, make `acceleration` uniform | §3.11 | `content/scroll-engine.ts` |
| 1.14 | Wire `chrome.commands.onCommand`; `_execute_action` opens the palette | §3.5 | `background/commands-router.ts` |
| 1.15 | Delete `commandNameFromChord` or use it; add `__tests__/unit/commands.test.ts` (exhaustive map + no conflicts + every command bound) | §3.20 | `commands/*`, `__tests__/*` |
| 1.16 | Split `ContentController` into `content-controller` / `mode-machine` / `dispatch` / `site-policy` | §3.21 | `content/*` |

**Acceptance criteria (each one demonstrated, not asserted):**
- `:` → arrow to a command → Enter → **the command runs**.
- `?` twice shows one sheet; Escape closes it; opening it three times leaves exactly one node in the DOM.
- Press `f`, scroll two viewports with the wheel, and every label is still over its own element.
- Press `f`, type one character, press Backspace, type another — the match count updates and the session survives.
- `F` on a `<button>` opens a new tab, not a navigation away.
- With hints open, `h`/`l` still scroll horizontally and the labels follow.
- A user site profile with `keymapOverrides` actually remaps keys on that site (unit test).
- `j`/`k` scroll a page whose scroller is an inner `<div>` (test fixture).
- No key in `DEFAULT_KEYMAP` leads to the options page.
- `npm test` ≥ 60 tests, all green.

---

### Phase 2 — The missing core features *(the "it's a real product now" phase)*

| # | Task | Notes |
| --- | --- | --- |
| 2.1 | **Omnibar** — overlay, keyboard model, frecency-ranked history/bookmarks/tabs, URL entry, paste-and-go | Uses `frecency.ts`/`fuzzy.ts`, the already-requested `history`/`bookmarks` permissions, and `core/messages.ts`. Rebind `o`/`O`. |
| 2.2 | **Keyword search engines** — `g`, `gh`, `w`, `yt` + user-defined engines in settings | The `searchEngines` feature Vimium users expect; `omnibar/engines.ts` + a settings tab. |
| 2.3 | **Tab search** (`T`) — same overlay primitives over `chrome.tabs.query` | Rebind `T`. Also: `chrome.tabs.onActivated` for live ordering. |
| 2.4 | **Storage lifecycle** — `settings-store` / `migrations` / `quota` / `broadcast` split; `sync.onChanged` listener; quota visible in the header with a `local` fallback | §3.15 |
| 2.5 | **Options refactor** — one module per tab, targeted renders, `UIState` that survives, all writes via `update()`, "Reset to defaults", label/`for` pairing | §3.14, §3.16 |
| 2.6 | **Vimium config import** — real `map`-line parser + fixture test + a "N bindings imported, M skipped" report | §3.16 |
| 2.7 | **Per-site editor for real** — set `keymapOverrides`, `forceInsertSelectors`, and `disabledCommands` per site from the UI | §3.22.10 |
| 2.8 | **Hint performance** — DOM-revision cache, node reuse across keystrokes, one injected stylesheet, early-out tiny frames | §3.19 |
| 2.9 | **Debug inspector** (opt-in) — "last key", "resolved command", "active profiles", "insert-mode confidence", "hint scan time" | Makes every future bug report self-diagnosing |

**Acceptance:** omnibar opens in under 20 ms with 1000 ranked history entries; typing filters in under 8 ms/keystroke; hint first-paint under 50 ms on a 300-target fixture page; settings survive a quota-forced `local` fallback; a real Vimium config imports with a correct summary; `npm test` ≥ 120 tests.
---

## 6. Addendum — additional improvements (author's review)

The phases above are sound. The following additions close the gaps I found while
reading the plan against the code. They are folded into the phases and executed
alongside them; each is marked with where it lands.

### S1 · The plan's acceptance criteria are untestable without a DOM test harness
Almost every Phase 1 acceptance bullet ("`: ` runs a command", "`?` twice shows
one sheet", "labels follow scroll", "Backspace survives") asserts **DOM
behaviour**, yet the suite is three pure-function files. The palette bug (§3.1)
is exactly the class a DOM test catches for free.
**Action:** add `jsdom` + a vitest `environment: "jsdom"` project and a
`test/dom.ts` helper; write controller-level tests for `CommandPalette`,
`CheatSheet`, `HintsController`, `Omnibar`, `FindController`, `SitePolicy`.
(Lands in every phase; converts "demonstrated by hand" into "demonstrated by CI".)

### S2 · No typed message protocol
`service-worker.ts` and `content-script.ts` both accept `msg: any` and duck-type
`msg?.type` strings. This is how `enterFindMode` silently fell through §3.2.
**Action:** `src/core/messages.ts` — a discriminated union `ExtMessage` with
`narrowMessage()`; every listener switches exhaustively on `type`, so a new
message with no handler is a **compile error**. (Phase 1.)

### S3 · `hints.style` is inert and non-QWERTY users are locked out
The plan notes (§3.18) `letters|numbers|filtered` is never read. "numbers" is a
genuine accessibility feature for non-QWERTY/AZERTY/Dvorak layouts.
**Action:** implement all three modes in the overlay + label generator; default
stays `letters`, but `filtered` (type-to-narrow, the plan's own §3.10 HUD) is one
click away and covered by a test. (Phase 1.)

### S4 · Site-match must not silently strip paths for the *privacy off-switch*
§3.13 unifies the matchers, but the danger is subtler than "two functions": a
user typing `example.com/admin` into **Disabled sites** today disables the whole
domain. That is a privacy control doing more than the user asked.
**Action:** `matchesSitePattern` implements the documented matrix **and**
`resolveSitePolicy` records *why* a site is disabled (`{pattern, kind}`), so the
options UI can show the exact pattern that matched. Unit-test the matrix incl.
malformed patterns, paths, ports and subdomains. (Phase 1/2.)

### S5 · Quota failure is silent — the worst possible storage behaviour
§3.15 notes `sync.set` can reject with no user-visible error. A settings UI that
silently stops persisting is worse than one that refuses a change.
**Action:** `storage/quota.ts` measures size before write, warns in the options
header at 70%, and on `set` rejection transparently falls back to
`storage.local` **and tells the user in the header** that sync is off. (Phase 2.)

### S6 · Reduced-motion and high-contrast are computed ad hoc in three places
`scroll.ts` calls `matchMedia` per scroevent; hints hard-code `#000/#fff`;
`toast`/`badge` ignore both entirely.
**Action:** `ui/styles.ts` — one injected stylesheet, one cached
`prefers-reduced-motion` `MediaQueryList`, one `Theme` object (palette from the
settings), so "high contrast" actually rings hint labels against dark imagery
(§3.14's real complaint) instead of just re-colouring them. (Phase 1/3.)

### S7 · Frame hygiene — the content script runs where it never should
§3.19 notes it injects into `about:blank` ad frames, PDF viewers and tiny
iframes at `document_start`.
**Action:** early-out in `main()` for `window.top !== window.self` cases that are
measurably useless: frames `< 120px` wide, `about:*`, `chrome*://`, and any frame
whose `location` throws. Measured with `core/perf.ts`. (Phase 1.)

### S8 · Vimium import is the strongest switch trigger and today it is a lie
§3.16 is right that it is a "growth lever", but the current button is worse than
nothing — it *advertises a parser that does not exist*.
**Action:** `migration/vimium.ts` — a real line parser (`map`, `unmap`, `unmapAll`,
`mapKey`, `#`/`"` comments, modifier normalisation to this project's chord
grammar) with a fixture test over real config lines and a
`imported / skipped` report in the UI. (Phase 2.)

### S9 · The debug inspector pays for itself immediately
Every remaining bug in §3 was found by *reading*, not by observing. A one-key
answer to "why did that key do nothing?" turns every future report into a fix.
**Action:** `debug/inspector.ts` behind `settings.debug.enabled` — shows last
key, resolved command, active profiles (+ why), insert-mode confidence, hint scan
time and cache state. (Phase 2.)

### S10 · Perfection means the repo is releasable, not just correct
§3.23 lists the release blockers. Two are added here because they are cheap and
the plan omits them: **`engines` + `.nvmrc`** (the code uses `structuredClone`
and ESM-only tooling — it needs Node ≥ 20 and nothing says so) and a **stale
`assets/*.map` exclusion** (sourcemaps are built but shipping them in a packed
extension both bloats the package and leaks source).
**Action:** add both in Phase 0; keep sourcemaps for `dev` only. (Phase 0.)
