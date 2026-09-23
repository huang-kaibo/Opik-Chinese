import { afterEach, describe, expect, it } from "vitest";
import { localizeText, startChineseLocalization } from "./index";

let observer: MutationObserver | undefined;

afterEach(() => {
  observer?.disconnect();
  document.body.innerHTML = "";
});

describe("Chinese UI localization", () => {
  it("translates fixed labels and variable text", () => {
    expect(localizeText("Create dataset")).toBe("创建题库");
    expect(localizeText("  Page 2 of 5 ")).toBe("  第 2 页，共 5 页 ");
  });

  it("translates inserted dialog text and accessibility labels without changing code content", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    observer = startChineseLocalization(root);

    const dialog = document.createElement("div");
    dialog.innerHTML = '<button title="Create dataset" aria-label="Create dataset">Create dataset</button>' +
      '<input placeholder="Search by name" />' +
      '<pre>Created by</pre>';
    root.append(dialog);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const button = dialog.querySelector("button")!;
    expect(button.textContent).toBe("创建题库");
    expect(button.title).toBe("创建题库");
    expect(button.getAttribute("aria-label")).toBe("创建题库");
    expect(dialog.querySelector("input")!.placeholder).toBe("按名称搜索");
    expect(dialog.querySelector("pre")!.textContent).toBe("Created by");
  });
});
