# Contributing to Kestrel

Thanks for helping make keyboard browsing better. This document is short on
purpose — the important rules are the ones CI enforces.

## Ground rules

1. **`npm run typecheck && npm test && npm run build` must be green.** The
   TypeScript config is intentionally strict (`strict`, `noUnusedLocals`,
   `noUnusedParameters`, `noImplicitOverride`, `noFallthroughCasesInSwitch`).
   Do not weaken it to make a change land.
2. **Add a test with the fix.** A bug fix without a regression test is a bug
   waiting to return. UI behaviour is tested with `jsdom` (see
   `src/__tests__/`); pure logic with plain Vitest.
3. **One question, one owner.** Before adding a helper, check whether the
   question is already answered somewhere:
   - *"Does this site pattern match?"* → `src/settings/site-match.ts`
   - *"What applies on this host?"* → `src/settings/site-policy.ts`
   - *"What does this message look like?"* → `src/core/messages.ts`
   - *"What id does this overlay use?"* → `src/ui/dom-ids.ts`
   Duplicating any of these is the root cause of the bugs listed in `PLAN.md`.
4. **Logic and DOM do not share a file.** Controllers decide; overlay modules
   paint. `ui/modal.ts` owns focus + ARIA so no overlay reinvents it.
5. **No `innerHTML` with interpolated values.** Build nodes with
   `createElement` + `textContent`. There is no HTML-escaping helper in this
   repo and adding one will be rejected in review.

## Local development

```bash
npm install
npm run dev        # watch build into dist/
npm test           # unit + DOM tests
npm run typecheck
npm run build      # typecheck + production bundle + icons
```

Load the unpacked extension from `dist/` in `chrome://extensions`
(Developer mode → **Load unpacked**).

## Commit style

Conventional Commits: `fix(hints): keep labels anchored while scrolling`,
`feat(omnibar): keyword search engines`. One logical change per commit.

## Reporting a bug

If a key did nothing, open the **Debug inspector** (Settings → Accessibility →
Debug inspector, or `gd` once enabled) and paste the "last key / resolved
command / active profiles" panel into the issue. It usually contains the whole
diagnosis.
