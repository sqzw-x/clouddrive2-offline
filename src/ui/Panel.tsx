import { App as AntdApp, Button, Form, Input, Modal, Space, Tabs, Typography } from "antd";
import { useMemo, useState } from "react";
import { getConfig, setConfig } from "@/config";
import { addOffline } from "@/grpc/client";
import { OfflineTasksTab } from "./components/OfflineTasksTab";

export interface PanelProps {
  open: boolean;
  onClose: () => void;
}

export function Panel({ open, onClose }: PanelProps) {
  const { notification, message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [testingUrl, setTestingUrl] = useState("");
  const [batchUrls, setBatchUrls] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeKey, setActiveKey] = useState("settings");

  const cfg = getConfig();
  const onSave = async () => {
    const values = await form.validateFields();
    setConfig(values);
    notification.success({ message: "设置已保存", placement: "topLeft" });
  };

  const onTestAdd = async () => {
    try {
      const v = form.getFieldsValue();
      setConfig(v);
      await addOffline(testingUrl, v.offlineDestPath);
      message.success("已提交离线下载任务");
    } catch (err) {
      console.error(err);
      message.error((err as Error)?.message || "提交失败");
    }
  };

  const onBatchAdd = async () => {
    if (!batchUrls.trim()) {
      message.warning("请输入至少一个链接");
      return;
    }

    const v = form.getFieldsValue();
    setConfig(v);

    setSubmitting(true);
    try {
      await addOffline(batchUrls, v.offlineDestPath);
      message.success("已提交离线下载任务");
      setBatchUrls("");
    } catch (err) {
      console.error(err);
      message.error((err as Error)?.message || "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const settingsNode = (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Typography.Title level={5}>CloudDrive2 设置</Typography.Title>
      <Form form={form} layout="vertical" initialValues={cfg}>
        <Form.Item name="grpcBaseUrl" label="地址" rules={[{ required: true }]}>
          <Input placeholder="http://localhost:8080" />
        </Form.Item>
        <Form.Item name="apiToken" label="API Token">
          <Input.Password placeholder="Bearer token 或 API token" />
        </Form.Item>
        <Form.Item name="offlineDestPath" label="离线下载路径" rules={[{ required: true }]}>
          <Input placeholder="/" />
        </Form.Item>
        <Space>
          <Button onClick={() => form.resetFields()}>重置</Button>
          <Button type="primary" onClick={onSave}>
            保存
          </Button>
        </Space>
      </Form>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        快速测试
      </Typography.Title>
      <Input placeholder="粘贴磁力链接或直链 URL" value={testingUrl} onChange={(e) => setTestingUrl(e.target.value)} />
      <Button type="primary" onClick={onTestAdd} disabled={!testingUrl}>
        添加到离线下载
      </Button>
    </Space>
  );

  const addOfflineNode = (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Typography.Title level={5}>批量添加离线下载任务</Typography.Title>
      <Typography.Text type="secondary">每行一个磁力链接或直链 URL</Typography.Text>
      <Input.TextArea
        rows={12}
        placeholder="magnet:?xt=urn:btih:...&#10;https://example.com/file.zip&#10;..."
        value={batchUrls}
        onChange={(e) => setBatchUrls(e.target.value)}
      />
      <Button type="primary" onClick={onBatchAdd} loading={submitting} disabled={!batchUrls.trim()}>
        批量提交
      </Button>
    </Space>
  );

  const items = useMemo(
    () => [
      {
        key: "offline",
        label: "任务列表",
        children: <OfflineTasksTab onSwitchToSettings={() => setActiveKey("settings")} />,
      },
      { key: "add-offline", label: "添加任务", children: addOfflineNode },
      { key: "settings", label: "设置", children: settingsNode },
    ],
    [settingsNode, addOfflineNode],
  );

  return (
    <Modal
      title="管理"
      centered
      open={open}
      onCancel={onClose}
      footer={null}
      getContainer={false}
      width={"60%"}
      bodyStyle={{ overflow: "visible", padding: 16, height: 600 }}
    >
      <Tabs activeKey={activeKey} onChange={setActiveKey} items={items} />
    </Modal>
  );
}
