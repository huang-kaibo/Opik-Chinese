import translations from "./zh-CN.json";
import templateTranslations from "./zh-CN-patterns.json";

const messages: Record<string, string> = translations;
const textAttributes = ["placeholder", "title", "aria-label", "alt"] as const;
const excluded = "pre, code, kbd, samp, textarea, [contenteditable], [data-localize='false'], .cm-editor";
const dynamicMessages = Object.entries(templateTranslations)
  .map(([source, translation]) => ({
    source,
    translation,
    pattern: new RegExp(`^${source.split(/ZXQ\d+ZXQ/).map((part) =>
      part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    ).join("([\\s\\S]*?)")}$`),
  }))
  .sort((a, b) => b.source.length - a.source.length);

export function localizeText(value: string): string {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const normalized = value.trim().replace(/\s+/g, " ");
  let translation = messages[normalized];
  if (!translation) {
    for (const message of dynamicMessages) {
      const match = message.pattern.exec(normalized);
      if (!match) continue;
      translation = message.translation.replace(/ZXQ(\d+)ZXQ/g, (_, index: string) =>
        match[Number(index) + 1] ?? "",
      );
      break;
    }
  }
  return translation ? `${leading}${translation}${trailing}` : value;
}

function shouldSkip(node: Node): boolean {
  const parent = node instanceof Element ? node : node.parentElement;
  return !parent || Boolean(parent.closest(excluded));
}

function localizeNode(node: Node): void {
  if (shouldSkip(node)) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const original = node.textContent ?? "";
    const translated = localizeText(original);
    if (translated !== original) node.textContent = translated;
    return;
  }
  if (!(node instanceof Element)) return;
  for (const attribute of textAttributes) {
    const original = node.getAttribute(attribute);
    if (original === null) continue;
    const translated = localizeText(original);
    if (translated !== original) node.setAttribute(attribute, translated);
  }
  if (node instanceof HTMLInputElement && ["button", "submit", "reset"].includes(node.type)) {
    node.value = localizeText(node.value);
  }
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) localizeNode(walker.currentNode);
  for (const element of node.querySelectorAll("*")) {
    if (!shouldSkip(element)) {
      for (const attribute of textAttributes) {
        const original = element.getAttribute(attribute);
        if (original === null) continue;
        const translated = localizeText(original);
        if (translated !== original) element.setAttribute(attribute, translated);
      }
      if (element instanceof HTMLInputElement && ["button", "submit", "reset"].includes(element.type)) {
        element.value = localizeText(element.value);
      }
    }
  }
}

export function startChineseLocalization(root: Element): MutationObserver {
  document.documentElement.lang = "zh-CN";
  document.title = "Opik 中文版";
  localizeNode(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData" || record.type === "attributes") {
        localizeNode(record.target);
      } else {
        for (const node of record.addedNodes) localizeNode(node);
      }
    }
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...textAttributes, "value"],
  });
  return observer;
}
