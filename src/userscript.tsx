/*
  Entry of the userscript bundle.

  - 设置面板不再注入页面悬浮按钮, 改为油猴菜单「CloudDrive2 设置」按需挂载
  - 为页面中的磁力 / ed2k 链接追加「离线下载」按钮, 并识别纯文本形式的 ed2k 链接
*/
import { notification } from "antd";
import { createRoot, type Root } from "react-dom/client";
import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client";

import { getConfig } from "@/config";
import { addOffline } from "@/grpc/client";

import { App } from "./ui/App";
import { openSettingsPanel } from "./ui/settingsPanel";

const ROOT_ID = "cd2-userscript-root";
/** 带 href 的链接 */
const LINK_SELECTOR = 'a[href^="magnet:"], a[href^="ed2k://"]';
/** 纯文本形式的 ed2k 链接: ed2k://|file|name|size|hash|/ 或带 h= 源列表 */
const ED2K_TEXT_RE = /ed2k:\/\/\|file\|[^|\n]*\|\d+\|[0-9a-fA-F]{32}\|(?:\/|h=[^|\n]*\/)/;
/** 这些容器里的文本不处理, 避免破坏链接、表单与代码块 */
const SKIP_CLOSEST = "a,button,textarea,input,select,option,script,style,noscript,code,svg";

let reactRoot: Root | null = null;

function ensureContainer(): HTMLElement {
  let el = document.getElementById(ROOT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = ROOT_ID;
    document.body.append(el);
  }
  return el;
}

/** 首次调用才挂载 React, 之后仅触发打开 */
function openSettings() {
  if (!reactRoot) {
    reactRoot = createRoot(ensureContainer());
    reactRoot.render(<App defaultOpen />);
    return;
  }
  openSettingsPanel();
}

function createOfflineButton(url: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cd2-offline-btn";
  button.style.marginLeft = "8px";
  button.setAttribute("aria-label", "提交离线下载");
  button.title = "提交到 CloudDrive2 离线下载";

  const icon = document.createElement("span");
  icon.className = "cd2-offline-btn__icon";
  const label = document.createElement("span");
  label.textContent = "离线下载";
  button.append(icon, label);

  button.addEventListener("click", async (event) => {
    event.preventDefault();
    const cfg = getConfig();
    const prevLabel = label.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    label.textContent = "提交中…";
    try {
      await addOffline(url, cfg.offlineDestPath);
      notification.success({ message: "已提交离线下载任务" });
    } catch (err) {
      notification.error({ message: `提交失败: ${(err as Error)?.message ?? "未知错误"}` });
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      label.textContent = prevLabel || "离线下载";
    }
  });

  return button;
}

/** 给页面中的磁力 / ed2k 链接追加按钮 */
function enhanceLinks(root: ParentNode) {
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>(LINK_SELECTOR)) {
    if (anchor.dataset.cd2Injected === "1") continue;
    const url = anchor.getAttribute("href")?.trim();
    anchor.dataset.cd2Injected = "1";
    if (!url) continue;
    anchor.insertAdjacentElement("afterend", createOfflineButton(url));
  }
}

/** 把同一个文本节点里出现的纯文本 ed2k 链接包成 a + 按钮 */
function wrapEd2kText(node: Text) {
  const text = node.nodeValue ?? "";
  const match = ED2K_TEXT_RE.exec(text);
  if (!match) return;

  const url = match[0];
  const parent = node.parentNode;
  if (!parent) return;

  const fragment = document.createDocumentFragment();
  if (match.index > 0) fragment.append(document.createTextNode(text.slice(0, match.index)));

  const link = document.createElement("a");
  link.className = "cd2-ed2k-link";
  link.href = url;
  link.textContent = url;
  link.dataset.cd2Injected = "1";
  fragment.append(link, createOfflineButton(url));

  const rest = text.slice(match.index + url.length);
  if (rest) fragment.append(document.createTextNode(rest));

  parent.replaceChild(fragment, node);

  // 同一文本节点里可能还有后续链接
  if (rest.includes("ed2k://")) {
    const tail = link.nextSibling?.nextSibling;
    if (tail instanceof Text) wrapEd2kText(tail);
  }
}

/** 识别并包装纯文本 ed2k 链接 */
function enhanceEd2kText(root: ParentNode) {
  if (!root.textContent?.includes("ed2k://")) return;

  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const value = node.nodeValue;
      if (!value?.includes("ed2k://") || !ED2K_TEXT_RE.test(value)) return NodeFilter.FILTER_REJECT;
      const parent = (node as Text).parentElement;
      if (!parent || parent.closest(SKIP_CLOSEST)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const targets: Text[] = [];
  while (walker.nextNode()) targets.push(walker.currentNode as Text);
  for (const target of targets) wrapEd2kText(target);
}

function scan(root: ParentNode) {
  enhanceLinks(root);
  enhanceEd2kText(root);
}

const pendingRoots: ParentNode[] = [];
let scanTimer: number | null = null;

function queueScan(root: ParentNode) {
  if (!pendingRoots.includes(root)) pendingRoots.push(root);
  if (scanTimer !== null) return;
  scanTimer = window.setTimeout(() => {
    scanTimer = null;
    for (const target of pendingRoots.splice(0)) {
      if ((target as Node).isConnected) scan(target);
    }
  }, 120);
}

function observeDom() {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          queueScan(node as Element);
        } else if (node.nodeType === Node.TEXT_NODE && node.parentElement?.textContent?.includes("ed2k://")) {
          queueScan(node.parentElement);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function boot() {
  try {
    GM_registerMenuCommand("CloudDrive2 设置", openSettings);
  } catch (err) {
    console.warn("[cd2] 注册油猴菜单失败", err);
  }

  if (document.body) scan(document.body);
  observeDom();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
