/*
  Entry of the userscript bundle.
  We mount a React app into the target page and expose minimal GM usage with types.
*/
import "@ant-design/v5-patch-for-react-19";
import { notification } from "antd";
import { createRoot } from "react-dom/client";
import { getConfig } from "@/config";
import { addOffline } from "@/grpc/client";
import { App } from "./ui/App";

function ensureContainer(id = "cd2-userscript-root") {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}

(function main() {
  const container = ensureContainer();
  const root = createRoot(container);
  root.render(<App />);

  // Enhance magnet links
  const addButtons = () => {
    const anchors = Array.from(document.querySelectorAll('a[href^="magnet:"]')) as HTMLAnchorElement[];
    anchors.forEach((a) => {
      if (a.dataset.cd2Injected === "1") return;
      a.dataset.cd2Injected = "1";
      const btn = document.createElement("button");
      btn.className = "cd2-offline-btn";
      btn.setAttribute("type", "button");
      btn.setAttribute("aria-label", "提交离线下载");
      btn.title = "提交到 CloudDrive 离线下载";
      // minimal spacing from the link
      btn.style.marginLeft = "8px";
      const icon = document.createElement("span");
      icon.className = "cd2-offline-btn__icon";
      const label = document.createElement("span");
      label.textContent = "离线下载";
      btn.appendChild(icon);
      btn.appendChild(label);
      btn.onclick = async (e) => {
        e.preventDefault();
        const cfg = getConfig();
        const prevLabel = label.textContent;
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        label.textContent = "提交中…";
        try {
          await addOffline(a.href, cfg.offlineDestPath);
          notification.success({ message: "已提交离线下载任务" });
        } catch (err) {
          notification.error({ message: `提交失败: ${err || "未知错误"}` });
        } finally {
          btn.disabled = false;
          btn.removeAttribute("aria-busy");
          label.textContent = prevLabel || "离线下载";
        }
      };
      a.insertAdjacentElement("afterend", btn);
    });
  };

  addButtons();
  const mo = new MutationObserver(() => addButtons());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
