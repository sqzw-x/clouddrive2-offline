type OpenSettings = () => void;

let openSettingsHandler: OpenSettings | null = null;

/** 由 React 应用注册打开回调; 应用未挂载时为空 */
export function registerOpenSettings(handler: OpenSettings | null) {
  openSettingsHandler = handler;
}

/** 打开设置面板 (需先挂载 React 应用) */
export function openSettingsPanel() {
  openSettingsHandler?.();
}
