import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Card, Checkbox, Divider, Flex, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getConfig } from "@/config";
import { getOfflineQuotaInfo, listAllOfflineFiles, removeOfflineFilesBulk } from "@/grpc/client";
import type { OfflineFileStatus } from "@/proto/clouddrive_pb";

type Row = {
  key: string; // infoHash or url fallback
  name: string;
  sizeMB: number;
  url: string;
  status: OfflineFileStatus; // keep raw
  percendDonePct: number; // 0-100
  infoHash?: string;
  addTime?: number; // epoch ms
};

export interface OfflineTasksTabProps {
  onSwitchToSettings?: () => void;
}

export function OfflineTasksTab({ onSwitchToSettings }: OfflineTasksTabProps) {
  const { message, modal } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [quota, setQuota] = useState<{ total: number; used: number; left: number } | null>(null);
  const [selected, setSelected] = useState<React.Key[]>([]);
  const reqIdRef = useRef(0); // 防止并发请求乱序覆盖

  const cfg = getConfig();

  const fetchAll = useCallback(async () => {
    const thisReqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const [listRes, quotaRes] = await Promise.all([listAllOfflineFiles(page), getOfflineQuotaInfo()]);
      const mapped: Row[] = listRes.offlineFiles.map((f) => ({
        key: f.infoHash || f.url,
        name: f.name,
        sizeMB: Number(f.size || 0) / (1024 * 1024),
        url: f.url,
        status: f.status,
        percendDonePct: f.percendDone,
        infoHash: f.infoHash,
        addTime: (() => {
          const v = Number(f.addTime || 0);
          if (!v) return undefined;
          // 处理秒/毫秒两种可能
          return v > 1e12 ? v : v * 1000;
        })(),
      }));
      // 只应用最新请求的结果，避免旧请求覆盖新页面数据
      if (thisReqId === reqIdRef.current) {
        setRows(mapped);
        setTotal(listRes.totalCount);
        setQuota(quotaRes);
      }
    } catch (err) {
      message.error((err as Error)?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [message, page]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const removeSelected = async () => {
    if (selected.length === 0) return;
    const keys = selected as string[];
    let shouldDelete = false;
    modal.confirm({
      title: `删除/取消 ${keys.length} 个任务？`,
      content: (
        <Space direction="vertical">
          <Checkbox
            onChange={(e) => {
              shouldDelete = e.target.checked;
            }}
          >
            同时删除已下载文件
          </Checkbox>
        </Space>
      ),
      okText: "确认",
      cancelText: "关闭",
      onOk: async () => {
        try {
          await removeOfflineFilesBulk(keys, shouldDelete);
          message.success("操作成功");
          setSelected([]);
          fetchAll();
        } catch (err) {
          message.error((err as Error)?.message || "操作失败");
        }
      },
    });
  };

  // 人类可读的大小显示（稳定引用）
  const formatBytes = useCallback((bytesInMB: number): string => {
    const bytes = bytesInMB * 1024 * 1024;
    if (!bytes || bytes <= 0) return "-";
    const units = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
    let idx = 0;
    let val = bytes;
    while (val >= 1024 && idx < units.length - 1) {
      val /= 1024;
      idx++;
    }
    return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${units[idx]}`;
  }, []);

  // 状态枚举转标签
  const renderStatusTag = useCallback((s: OfflineFileStatus) => {
    // 0: INIT, 1: DOWNLOADING, 2: FINISHED, 3: ERROR, 4: UNKNOWN
    const map = new Map([
      [0, { text: "初始", color: "default" }],
      [1, { text: "下载中", color: "processing" }],
      [2, { text: "已完成", color: "success" }],
      [3, { text: "错误", color: "error" }],
      [4, { text: "未知", color: "default" }],
    ] as const);
    const m = map.get(s) ?? { text: "未知", color: "default" };
    return <Tag color={m.color}>{m.text}</Tag>;
  }, []);

  const formatAddTime = useCallback((ts?: number) => {
    if (!ts) return "-";
    const d = new Date(ts);
    const mm = `${d.getMonth() + 1}`.padStart(2, "0");
    const dd = `${d.getDate()}`.padStart(2, "0");
    const hh = `${d.getHours()}`.padStart(2, "0");
    const mi = `${d.getMinutes()}`.padStart(2, "0");
    return `${mm}/${dd} ${hh}:${mi}`;
  }, []);

  const copyUrl = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        message.success("链接已复制");
      } catch {
        message.error("复制失败，请手动复制");
      }
    },
    [message],
  );

  const removeOne = useCallback(
    (row: Row) => {
      let shouldDelete = false;
      modal.confirm({
        title: `删除/取消任务？`,
        content: (
          <Space direction="vertical">
            <Typography.Text>可以选择仅取消任务，或同时删除已下载文件。</Typography.Text>
            <Checkbox
              onChange={(e) => {
                shouldDelete = e.target.checked;
              }}
            >
              同时删除已下载文件
            </Checkbox>
          </Space>
        ),
        okText: "确认",
        cancelText: "关闭",
        onOk: async () => {
          try {
            await removeOfflineFilesBulk([row.infoHash || row.key], shouldDelete);
            message.success("操作成功");
            fetchAll();
          } catch (err) {
            message.error((err as Error)?.message || "操作失败");
          }
        },
      });
    },
    [fetchAll, message, modal],
  );

  const columns: ColumnsType<Row> = useMemo(
    () => [
      { title: "名称", dataIndex: "name", key: "name", ellipsis: true },
      {
        title: "大小",
        dataIndex: "sizeMB",
        key: "size",
        width: 120,
        render: (v: number) => formatBytes(v),
      },
      {
        title: "状态",
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (v: number) => renderStatusTag(v),
      },
      {
        title: "进度",
        key: "progress",
        render: (_, r) => <Tag color="blue">{r.percendDonePct}%</Tag>,
        width: 100,
      },
      {
        title: "添加时间",
        dataIndex: "addTime",
        key: "added",
        width: 120,
        render: (v?: number) => formatAddTime(v),
      },
      {
        title: "操作",
        key: "actions",
        width: 120,
        render: (_, r) => (
          <Space size={8}>
            <Tooltip title="复制链接">
              <Button size="small" icon={<CopyOutlined />} onClick={() => copyUrl(r.url)} />
            </Tooltip>
            <Tooltip title="删除/取消">
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeOne(r)} />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [copyUrl, formatAddTime, formatBytes, removeOne, renderStatusTag],
  );

  const rowSelection = {
    selectedRowKeys: selected,
    onChange: (keys: React.Key[]) => setSelected(keys),
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      {!cfg.offlineDestPath ? (
        <Card>
          <Typography.Text>未设置“离线下载路径”，请先前往“设置”页签完成配置。</Typography.Text>
          {onSwitchToSettings ? (
            <Button type="link" onClick={onSwitchToSettings} style={{ paddingLeft: 8 }}>
              去设置
            </Button>
          ) : null}
        </Card>
      ) : null}

      <Flex align="center" justify="space-between" wrap>
        <Space size={8} align="center">
          <Button onClick={() => fetchAll()} loading={loading}>
            刷新
          </Button>
          <Button danger disabled={selected.length === 0} onClick={removeSelected}>
            取消所选
          </Button>
        </Space>
        <Space size={8}>
          {quota ? (
            <Typography.Text type="secondary">
              可用配额：{quota.left}/{quota.total}
            </Typography.Text>
          ) : null}
        </Space>
      </Flex>

      <Divider style={{ margin: "8px 0" }} />

      <Table<Row>
        size="small"
        rowKey={(r) => r.key}
        columns={columns}
        dataSource={rows}
        loading={loading}
        rowSelection={rowSelection}
        scroll={{ y: 360 }}
        pagination={{
          current: page,
          total,
          pageSize: 30, // cd2 api 固定30
          onChange: (p) => {
            setPage(p);
          },
        }}
      />
    </Space>
  );
}
