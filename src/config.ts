import { GM_getValue, GM_setValue } from "vite-plugin-monkey/dist/client";
export type AppConfig = {
  grpcBaseUrl: string;
  apiToken: string; // Bearer token or api token
  offlineDestPath: string; // default path for offline download
};

const KEY = "cf2_config_v1";

export function getConfig(): AppConfig {
  const v = (typeof GM_getValue !== "undefined" ? GM_getValue(KEY, null) : null) as AppConfig | null;
  if (v && typeof v === "object") return v;
  return {
    grpcBaseUrl: "http://localhost:8080",
    apiToken: "",
    offlineDestPath: "/",
  };
}

export function setConfig(cfg: AppConfig) {
  if (typeof GM_setValue !== "undefined") {
    GM_setValue(KEY, cfg);
    console.log("Config saved:", cfg);
  }
}
