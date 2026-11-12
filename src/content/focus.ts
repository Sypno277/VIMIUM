// `gi` / `ge` — focus the first / last text input on the page. Walks the
// document for visible, editable fields and skips ones inside hidden or
// disabled regions.

const FIELD_SELECTOR = [
  "input:not([type])",
  "input[type=text]",
  "input[type=search]",
  "input[type=email]",
  "input[type=url]",
  "input[type=tel]",
  "input[type=password]",
  "input[type=number]",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='textbox']",
].join(",");

function isFocusableField(el: Element): boolean {
  if ((el as HTMLInputElement).disabled) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
}

/** Focus the first or last editable field on the page. Returns true on success. */
export function focusInput(which: "first" | "last"): boolean {
  const fields = Array.from(document.querySelectorAll(FIELD_SELECTOR)).filter(isFocusableField);
  if (fields.length === 0) return false;
  const target = (which === "first" ? fields[0] : fields[fields.length - 1]) as HTMLElement;
  target.focus();
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    try {
      target.select();
    } catch {
      /* some input types do not support select() */
    }
  }
  return true;
}
