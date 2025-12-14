import { create } from "@bufbuild/protobuf";
import { EmptySchema } from "@bufbuild/protobuf/wkt";
import { type Client, createClient, type Interceptor } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { getConfig } from "@/config";
import {
  AddOfflineFileRequestSchema,
  type CloudAPI,
  CloudDriveFileSrv,
  type CloudDriveSystemInfo,
  type FileOperationResult,
  FindFileByPathRequestSchema,
  OfflineFileListAllRequestSchema,
  type OfflineFileListAllResult,
  type OfflineQuotaInfo,
  OfflineQuotaRequestSchema,
  RemoveOfflineFilesRequestSchema,
} from "@/proto/clouddrive_pb";
import gmFetch from "./gmFetch";

function getCloudDriveClient(): Client<typeof CloudDriveFileSrv> {
  const cfg = getConfig();
  const authInterceptor: Interceptor = (next) => async (req) => {
    const token = cfg.apiToken;
    if (token) {
      req.header.set("Authorization", token.startsWith("Bearer ") ? token : `Bearer ${token}`);
    }
    return await next(req);
  };

  const transport = createGrpcWebTransport({
    baseUrl: cfg.grpcBaseUrl,
    interceptors: [authInterceptor],
    // Use GM-based fetch to bypass page CSP when available
    fetch: (input, init) => gmFetch(input, init),
  });

  return createClient(CloudDriveFileSrv, transport);
}

/** 提交离线下载任务
 * @param urls 支持多个 URL, 用换行符分隔
 * @param destPath 目标路径
 */
export async function addOffline(urls: string, destPath: string): Promise<FileOperationResult> {
  const cfg = getConfig();
  const toFolder = destPath && destPath.length > 0 ? destPath : cfg.offlineDestPath;

  const req = create(AddOfflineFileRequestSchema, {
    urls: urls,
    toFolder,
  });

  const client = getCloudDriveClient();
  const res = await client.addOfflineFiles(req);
  return res;
}

export async function getSystemInfo(): Promise<CloudDriveSystemInfo> {
  const client = getCloudDriveClient();
  const res = await client.getSystemInfo(create(EmptySchema, {}));
  return res;
}

/**
 * Resolve CloudAPI info for a folder.
 */
export async function getFolderCloudAPI(p: string): Promise<CloudAPI | undefined> {
  const client = getCloudDriveClient();
  const req = create(FindFileByPathRequestSchema, { parentPath: p, path: "." });
  try {
    const file = await client.findFileByPath(req);
    return file.CloudAPI;
  } catch {
    return undefined;
  }
}

/**
 * Resolve cloudName/cloudAccountId from a configured path (default to cfg.offlineDestPath)
 */
async function resolveCloudContext(
  pathOverride?: string,
): Promise<{ cloudName: string; cloudAccountId: string; path?: string }> {
  const cfg = getConfig();
  const folderPath = pathOverride ?? cfg.offlineDestPath;
  const api = await getFolderCloudAPI(folderPath);
  if (!api) {
    throw new Error("无法获取云盘信息，请先在设置中正确配置“离线下载路径”");
  }
  return { cloudName: api.name, cloudAccountId: api.userName, path: folderPath };
}

/** 列出全局离线任务（分页） */
export async function listAllOfflineFiles(page = 1, pathOverride?: string): Promise<OfflineFileListAllResult> {
  const client = getCloudDriveClient();
  const { cloudName, cloudAccountId, path } = await resolveCloudContext(pathOverride);
  const req = create(OfflineFileListAllRequestSchema, { cloudName, cloudAccountId, page, path });
  return await client.listAllOfflineFiles(req);
}

/** 获取离线任务配额信息 */
export async function getOfflineQuotaInfo(pathOverride?: string): Promise<OfflineQuotaInfo> {
  const client = getCloudDriveClient();
  const { cloudName, cloudAccountId, path } = await resolveCloudContext(pathOverride);
  const req = create(OfflineQuotaRequestSchema, { cloudName, cloudAccountId, path });
  return await client.getOfflineQuotaInfo(req);
}

/** 批量删除/取消离线任务 */
export async function removeOfflineFilesBulk(infoHashes: string[], deleteFiles: boolean, pathOverride?: string) {
  const client = getCloudDriveClient();
  const { cloudName, cloudAccountId, path } = await resolveCloudContext(pathOverride);
  const req = create(RemoveOfflineFilesRequestSchema, { cloudName, cloudAccountId, deleteFiles, infoHashes, path });
  return await client.removeOfflineFiles(req);
}
