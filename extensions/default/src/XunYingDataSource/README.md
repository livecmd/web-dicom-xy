# 迅影 DataSource 适配器

## 概述

这是为 OHIF Viewers 框架开发的迅影公司 DICOM 后端 API 适配器。该适配器将迅影的专有 API 转换为 OHIF 期望的标准化 DICOM 格式。

## 文件结构

```
XunYingDataSource/
├── index.ts                    # DataSource 主入口，实现 IWebApiDataSource 接口
├── imageLoader.ts              # Cornerstone 图像加载器，处理 xunying: scheme
├── utils/
│   ├── httpClient.ts          # HTTP 请求工具，处理迅影 API 调用
│   └── mapFields.ts           # 字段映射工具，将迅影数据转换为标准 DICOM 格式
└── README.md                  # 本文档
```

## 核心功能

### 1. DataSource 实现 (`index.ts`)

实现了 OHIF 的 `IWebApiDataSource` 接口，提供以下功能：

- **initialize**: 从 URL 参数或配置中读取 `token` 和 `hospital`，初始化 HTTP 配置
- **query.series.search**: 查询指定 Study 的 Series 列表
- **retrieve.series.metadata**: 获取 Study 的完整元数据，包括所有 Series 和 Instance
- **retrieve.getGetThumbnailSrc**: 生成缩略图 URL
- **getImageIdsForDisplaySet**: 为 DisplaySet 生成 imageId 列表
- **getImageIdsForInstance**: 为单个 Instance 生成 imageId
- **getStudyInstanceUIDs**: 从 URL 参数中解析 StudyInstanceUID 列表

### 2. 图像加载器 (`imageLoader.ts`)

注册自定义的 `xunying:` scheme 图像加载器：

- **ImageId 格式**: `xunying:{studyUID}/{seriesUID}/{sopInstanceUID}[/frames/{frameNumber}]`
- **像素数据处理**: 
  - 支持 8-bit (Uint8Array)
  - 支持 16-bit 有符号 (Int16Array)
  - 支持 RGB 彩色图像
- **自动计算**: minPixelValue, maxPixelValue
- **窗宽窗位**: 从响应头的 `default_center` 和 `default_window` 读取

### 3. HTTP 客户端 (`utils/httpClient.ts`)

处理与迅影 API 的通信：

- **fetchJson**: 获取 JSON 元数据（Study、Series、Image 信息）
- **fetchPixelData**: 获取像素数据，解析响应头中的元数据
- **buildThumbnailUrl**: 生成缩略图 URL
- **认证方式**:
  - JSON API: `token` 放在请求头
  - WADO API: `token` 作为 URL 参数

### 4. 字段映射 (`utils/mapFields.ts`)

将迅影的数据格式转换为 OHIF 期望的标准化 DICOM 格式：

- **mapInstanceToNaturalized**: 将迅影的 Image 数据映射为标准 DICOM Instance
- **getSopClassUID**: 根据 Modality 推断 SOP Class UID
- **日期时间转换**: 将迅影的日期时间格式转换为 DICOM DA/TM 格式

## 配置

### 应用配置 (`platform/app/public/config/xunying.js`)

```javascript
window.config = {
  defaultDataSourceName: 'xunying',
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.xunying',
      sourceName: 'xunying',
      configuration: {
        friendlyName: '迅影 DICOM 服务器',
        name: 'xunying',
        baseUrl: '/webpacs/api',
        hospital: '',  // 从 URL 参数读取
        token: '',     // 从 URL 参数读取
      },
    },
  ],
  // ... 其他配置
};
```

### URL 参数

访问 OHIF Viewer 时，需要在 URL 中提供以下参数：

```
http://localhost:3000/viewer?hospital=your_hospital&studyuid=1.2.3.4&token=your_token
```

参数说明：
- `studyuid`: 生产环境使用的 Study 唯一标识符（必需）
- `token`: 迅影 API 认证令牌（必需）
- `hospital`: 医院标识符（必需）

兼容性说明：
- DataSource 同时兼容 `studyuid`、`studyUID`、`StudyInstanceUID`、`studyInstanceUID`、`studyInstanceUid`、`StudyInstanceUIDs`、`studyInstanceUIDs`
- 推荐生产环境统一使用 `hospital=...&studyuid=...&token=...`

## API 映射

### 迅影 API → OHIF DataSource

| OHIF 方法 | 迅影 API | 说明 |
|----------|---------|------|
| `query.series.search` | `GET /study?level=study&studyuid={uid}&ai=1` | 获取 Study 的 Series 列表 |
| `retrieve.series.metadata` | `GET /study?level=image&studyuid={uid}&seriesuid={uid}` | 获取 Series 的 Image 列表 |
| 图像加载 | `GET /wado?requestType=gsps&studyUID={uid}&seriesUID={uid}&objectUID={uid}` | 获取像素数据 |
| 缩略图 | `GET /wado?requestType=wado&studyUID={uid}&seriesUID={uid}&objectUID={uid}&rows=128&columns=128` | 获取缩略图 |

## 技术细节

### BitType 计算

根据像素数据的字节数自动判断图像类型：

```typescript
const bytesPerPixel = arrayBuffer.byteLength / width / height;
if (bytesPerPixel === 1) bitType = 1;      // 8-bit 灰度
else if (bytesPerPixel === 2) bitType = 2; // 16-bit 有符号
else if (bytesPerPixel === 3) bitType = 3; // RGB 彩色
```

### 元数据缓存

使用 `studyMetadataPromises` Map 缓存 Study 级别的元数据请求，避免重复获取：

```typescript
const studyMetadataPromises = new Map<string, Promise<any>>();
```

### 多帧支持

自动处理多帧图像，为每一帧生成独立的 imageId：

```typescript
for (let frame = 1; frame <= numberOfFrames; frame++) {
  imageIds.push(buildXunYingImageId(studyUID, seriesUID, sopInstanceUID, frame));
}
```

## 使用方法

1. **启动应用时指定配置文件**:
   ```bash
   APP_CONFIG=xunying yarn run dev
   ```

2. **访问 Viewer**:
   ```
   http://localhost:3000/viewer?hospital=your_hospital&studyuid=1.2.3.4&token=your_token
   ```

3. **DataSource 自动初始化**:
   - 从 URL 读取 `token` 和 `hospital`
   - 注册 `xunying:` 图像加载器
   - 配置 HTTP 客户端

## 注意事项

1. **认证**: 迅影 API 使用双重认证方式：
   - JSON 元数据 API: `token` 在请求头
   - WADO 像素 API: `token` 作为 URL 参数

2. **FrameOfReferenceUID**: 由于迅影 API 不提供此字段，使用 `{seriesUID}.0` 作为合成值

3. **SOP Class UID**: 根据 Modality 推断，如果无法识别则使用默认值 `1.2.840.10008.5.1.4.1.1.7` (Secondary Capture)

4. **像素间距**: 从 `pixelspacing` 字段解析，格式为 `row\column`

5. **窗宽窗位**: 优先使用响应头的 `default_center` 和 `default_window`，其次使用 `imageinfo` 中的 `wincenter` 和 `winwidth`

## 故障排查

### 401 认证失败
- 检查 URL 中的 `token` 参数是否正确
- 检查 token 是否已过期

### 图像无法加载
- 检查浏览器控制台的网络请求
- 验证 `baseUrl` 配置是否正确
- 确认 WADO API 返回了正确的 `width` 和 `height` 响应头

### 元数据缺失
- 检查迅影 API 返回的数据格式
- 验证 `mapInstanceToNaturalized` 的字段映射是否正确

## 开发者信息

- **OHIF 版本**: 3.13.0-beta
- **Cornerstone.js 版本**: 2.x
- **TypeScript**: 支持
- **测试**: 需要连接到实际的迅影后端进行集成测试
