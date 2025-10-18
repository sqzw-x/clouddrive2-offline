import { SettingOutlined } from "@ant-design/icons";
import { App as AntdApp, ConfigProvider, FloatButton, theme } from "antd";
import { useState } from "react";
import { Panel } from "./Panel";
import "./styles.less";

export function App() {
  const [open, setOpen] = useState(false);
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
        <FloatButton icon={<SettingOutlined />} style={{ left: 0, bottom: 0 }} onClick={() => setOpen(true)} />
        <Panel open={open} onClose={() => setOpen(false)} />
      </AntdApp>
    </ConfigProvider>
  );
}
