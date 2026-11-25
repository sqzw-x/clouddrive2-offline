import { App as AntdApp, ConfigProvider, theme } from "antd";
import { useEffect, useState } from "react";

import { Panel } from "./Panel";
import { registerOpenSettings } from "./settingsPanel";

import "./styles.less";

export interface AppProps {
  /** 首次挂载时直接打开设置面板 */
  defaultOpen?: boolean;
}

export function App({ defaultOpen = false }: AppProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    registerOpenSettings(() => setOpen(true));
    return () => registerOpenSettings(null);
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          // 确保弹窗类组件（message/notification 等）层级更高
          zIndexPopupBase: 1_000_000,
        },
      }}
    >
      <AntdApp>
        <Panel open={open} onClose={() => setOpen(false)} />
      </AntdApp>
    </ConfigProvider>
  );
}
