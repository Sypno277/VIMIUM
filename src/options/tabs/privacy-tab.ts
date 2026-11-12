import { card, el, paragraph } from "./shared";

export function renderPrivacy(root: HTMLElement): void {
  root.replaceChildren();

  const explainer = el("div");
  const h3 = el("h3", {}, ["Why Kestrel requests browser permissions"]);
  const ul = el("ul");

  const items = [
    {
      title: "<all_urls> & host permission",
      desc: "Required to capture keyboard shortcuts, track scroll containers, and render hint overlays on the web pages you browse.",
    },
    {
      title: "storage",
      desc: "Persists your key bindings, site overrides, and marks. Syncs preferences securely across your browser sessions without third-party servers.",
    },
    {
      title: "tabs & sessions",
      desc: "Powers tab switching (J/K), closing (x), reopening closed tabs (X), and the live tab search feature (T).",
    },
    {
      title: "history & bookmarks",
      desc: "Feeds the fast omnibar search (o/O/b) with frecency-ranked results calculated entirely within your browser.",
    },
    {
      title: "commands",
      desc: "Registers global browser shortcuts (e.g. Alt+Shift+K) to open the command palette from anywhere.",
    },
    {
      title: "scripting",
      desc: "Used for restoring scroll offsets when jumping between persisted page marks.",
    },
  ];

  for (const item of items) {
    const li = el("li");
    const b = el("b", {}, [item.title]);
    li.append(b, document.createTextNode(" — " + item.desc));
    ul.append(li);
  }

  explainer.append(h3, ul);

  const wrap = card("Privacy & Security", [
    explainer,
    paragraph(
      "Kestrel is built with a strict local-first philosophy. Zero external analytics, zero tracking, and no external code execution.",
    ),
  ]);

  root.append(wrap);
}
