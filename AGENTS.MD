# OHIF Viewers — 架构与代码指南（AGENTS.MD）

本文档面向 AI 编码助手（及人类开发者），系统梳理 OHIF Viewers 开源库的目录结构、核心架构、关键模块及开发规范，以便快速理解代码库、正确定位修改位置，并遵循既有约定。

---

## 1. 项目概述

**OHIF Viewer** 是由 Open Health Imaging Foundation (OHIF) 维护的零足迹医学影像 Web 阅片器。

- 基于 **React + TypeScript**，采用 **Monorepo（Lerna + Yarn Workspaces）** 管理多包
- 支持 DICOMweb 标准协议，可对接 Orthanc、dcm4chee 等 PACS 系统
- 核心能力：2D/3D 渲染、MPR、MIP、分割（Labelmap/Contour）、测量、RT Struct、显微镜、PDF、视频等
- 当前版本：`3.13.0-beta`（见 `lerna.json`）

---

## 2. Monorepo 包结构

```
Viewers/
├── platform/          # 核心平台包
│   ├── app/           # 主应用程序入口（@ohif/app）
│   ├── core/          # 核心业务逻辑（@ohif/core）
│   ├── ui/            # 旧版 UI 组件库（@ohif/ui）
│   ├── ui-next/       # 新版 UI 组件库（@ohif/ui-next，基于 shadcn/Radix UI）
│   ├── i18n/          # 国际化（@ohif/i18n，i18next）
│   ├── cli/           # CLI 工具（@ohif/cli）
│   └── docs/          # 文档站（Docusaurus）
├── extensions/        # 功能扩展包
│   ├── cornerstone/               # 主渲染扩展（@ohif/extension-cornerstone）
│   ├── default/                   # 默认数据源与布局（@ohif/extension-default）
│   ├── measurement-tracking/      # 测量追踪（@ohif/extension-measurement-tracking）
│   ├── cornerstone-dicom-seg/     # DICOM SEG 分割
│   ├── cornerstone-dicom-rt/      # RT Struct
│   ├── cornerstone-dicom-sr/      # DICOM SR 结构化报告
│   ├── cornerstone-dicom-pmap/    # 参数图
│   ├── cornerstone-dynamic-volume/# 动态体积（4D）
│   ├── dicom-microscopy/          # 全切片显微镜
│   ├── dicom-pdf/                 # DICOM PDF
│   ├── dicom-video/               # DICOM 视频
│   ├── tmtv/                      # 全身代谢肿瘤体积（TMTV）
│   ├── usAnnotation/              # 超声标注
│   └── test-extension/            # 测试用扩展
├── modes/             # 工作流模式包
│   ├── basic/                     # 基础模式（@ohif/mode-basic）
│   ├── longitudinal/              # 纵向追踪模式
│   ├── segmentation/              # 分割模式
│   ├── tmtv/                      # TMTV 模式
│   ├── microscopy/                # 显微镜模式
│   ├── preclinical-4d/            # 4D 临床前模式
│   ├── usAnnotation/              # 超声标注模式
│   ├── basic-dev-mode/            # 开发测试模式
│   └── basic-test-mode/           # E2E 测试模式
├── addOns/            # 附加外部依赖（addOns/externals）
├── tests/             # Playwright E2E 测试（.spec.ts）
├── testdata/          # 测试用 DICOM 数据（git submodule）
└── [配置文件]         # lerna.json, nx.json, tsconfig.json, rsbuild.config.ts 等
```

---

## 3. 核心架构分层

```
┌──────────────────────────────────────────────────────────┐
│                     platform/app                         │
│   (应用入口、路由、初始化、AppConfig、全局 Provider)       │
├──────────────────────────────────────────────────────────┤
│       Modes（工作流模式）                                 │
│   定义布局模板、工具组、Toolbar、路由、所需扩展依赖         │
├──────────────────────────────────────────────────────────┤
│       Extensions（功能扩展）                              │
│   提供 Viewport、Panel、Command、SOP 处理器等模块          │
├──────────────────────────────────────────────────────────┤
│       platform/core（核心）                              │
│   ExtensionManager、ServicesManager、CommandsManager 等   │
├─────────────────────┬────────────────────────────────────┤
│   platform/ui-next  │   platform/ui                      │
│   (新版 UI 组件)    │   (旧版 UI 组件)                   │
└─────────────────────┴────────────────────────────────────┘
```

---

## 4. platform/core — 核心模块详解

**包名**：`@ohif/core`  
**路径**：`platform/core/src/`

### 4.1 核心管理器（classes/）

| 类 | 文件 | 职责 |
|---|---|---|
| `CommandsManager` | `classes/CommandsManager.ts` | 注册并执行命名命令，支持上下文切换 |
| `HotkeysManager` | `classes/HotkeysManager.ts` | 快捷键绑定与管理 |
| `ExtensionManager` | `extensions/ExtensionManager.ts` | 注册/加载扩展，分发模块（MODULE_TYPES） |
| `ServicesManager` | `services/ServicesManager.ts` | 服务注册与查找 |
| `ServiceProvidersManager` | `services/ServiceProvidersManager.ts` | React Provider 层注册 |

### 4.2 模块类型（MODULE_TYPES）

扩展通过以下模块类型向系统贡献功能：

```js
// platform/core/src/extensions/MODULE_TYPES.js
{
  COMMANDS: 'commandsModule',         // 命令
  CUSTOMIZATION: 'customizationModule', // 定制化
  DATA_SOURCE: 'dataSourcesModule',   // 数据源
  PANEL: 'panelModule',               // 侧边面板
  SOP_CLASS_HANDLER: 'sopClassHandlerModule', // DICOM SOP 类处理
  TOOLBAR: 'toolbarModule',           // 工具栏按钮
  VIEWPORT: 'viewportModule',         // 视图组件
  LAYOUT_TEMPLATE: 'layoutTemplateModule', // 布局模板
  HANGING_PROTOCOL: 'hangingProtocolModule', // 悬挂协议
  UTILITY: 'utilityModule',           // 工具函数
  STATE_SYNC: 'stateSyncModule',      // 状态同步
  CONTEXT: 'contextModule',           // 上下文
}
```

### 4.3 核心服务（services/）

| 服务 | 职责 |
|---|---|
| `DisplaySetService` | 管理 DisplaySet（影像集）的创建、更新与分发 |
| `MeasurementService` | 测量数据的注册、存储与事件广播 |
| `HangingProtocolService` | 悬挂协议匹配与布局控制 |
| `ViewportGridService` | 视口网格布局状态管理 |
| `ToolbarService` | 工具栏状态与按钮分组管理 |
| `CineService` | CINE 播放控制 |
| `CustomizationService` | 运行时定制化配置 |
| `UINotificationService` | 通知消息 |
| `UIModalService` | 模态框 |
| `UIDialogService` | 对话框 |
| `UIViewportDialogService` | 视口内嵌对话框 |
| `UserAuthenticationService` | 用户认证（OpenID Connect） |
| `PanelService` | 侧边面板激活状态管理 |
| `StudyPrefetcherService` | 影像预加载策略 |
| `WorkflowStepsService` | 工作流步骤（多步骤阅片流程） |
| `MultiMonitorService` | 多显示器同步 |
| `DicomMetadataStore` | DICOM 元数据全局缓存 |

所有服务均基于 `PubSubService`（发布-订阅），支持 `subscribe` / `_broadcastEvent`。

### 4.4 数据源接口

`DataSources/IWebApiDataSource.js` — 定义数据源接口规范（`query`, `retrieve`, `store` 等），具体实现在 `extensions/default/src/DicomWebDataSource/`。

---

## 5. platform/app — 应用入口详解

**包名**：`@ohif/app`  
**路径**：`platform/app/src/`

### 5.1 启动流程

```
index.js
  └── App.tsx
        └── appInit.js          ← 创建所有 Manager 和 Service 实例
              ├── new CommandsManager()
              ├── new ServicesManager()
              ├── new ExtensionManager()
              ├── new HotkeysManager()
              └── 注册所有 Services
                    └── createRoutes()  ← 依据 Modes 生成路由
```

**关键文件**：
- `src/appInit.js` — 核心初始化逻辑，注册所有服务与扩展
- `src/App.tsx` — React 根组件，包裹所有 Context Provider
- `src/routes/buildModeRoutes.tsx` — 依据已注册 Mode 动态生成路由
- `src/routes/Mode/Mode.tsx` — Mode 路由组件，负责加载布局模板
- `src/routes/WorkList/WorkList.tsx` — 工作列表（Study List）页面
- `src/state/appConfig.tsx` — 全局应用配置 Context

### 5.2 路由结构

```
/                          → WorkList（研究列表）
/:modeId                   → Mode 路由（如 /viewer, /tmtv）
/callback                  → OIDC 回调
/local                     → 本地文件加载
```

---

## 6. Extensions — 扩展开发规范

每个扩展是一个独立的 npm 包，入口 `src/index.tsx` 导出一个对象：

```ts
export default {
  id: '@ohif/extension-xxx',
  
  // 可选生命周期
  preRegistration({ servicesManager, extensionManager, appConfig }) {},
  onModeEnter({ servicesManager }) {},
  onModeExit({ servicesManager }) {},
  
  // 可选模块（按需实现）
  getCommandsModule(params) { return { actions, definitions, defaultContext }; },
  getViewportModule(params) { return [{ name, component }]; },
  getPanelModule(params)    { return [{ name, iconName, component }]; },
  getToolbarModule(params)  { return [{ name, component }]; },
  getHangingProtocolModule(params) { return [{ name, protocol }]; },
  getSopClassHandlerModule(params) { return [{ name, sopClassUids, getDisplaySetsFromSeries }]; },
  getCustomizationModule(params)   { return [{ name, value }]; },
  getDataSourcesModule(params)     { return [{ name, type, createDataSource }]; },
};
```

### 6.1 cornerstone 扩展（最核心）

**包名**：`@ohif/extension-cornerstone`

- **渲染引擎**：基于 `@cornerstonejs/core` + `@cornerstonejs/tools`
- `src/Viewport/OHIFCornerstoneViewport.tsx` — 主视口 React 组件
- `src/services/ViewportService/` — 管理 Cornerstone 视口生命周期
- `src/services/ToolGroupService/` — 工具组管理（绑定工具到视口）
- `src/services/SegmentationService/` — 分割标注服务
- `src/services/SyncGroupService/` — 视口同步（窗宽/位置）
- `src/services/ColorbarService/` — 颜色条
- `src/hps/` — 内置悬挂协议（MPR、3D、fourUp 等）
- `src/panels/` — PanelMeasurement、PanelSegmentation

### 6.2 default 扩展

**包名**：`@ohif/extension-default`

- `src/DicomWebDataSource/` — DICOMweb 数据源实现（QIDO-RS, WADO-RS）
- `src/DicomLocalDataSource/` — 本地文件数据源
- `src/DicomJSONDataSource/` — JSON 元数据数据源
- `src/ViewerLayout/` — 默认布局模板（左/右面板 + 视口区）
- `src/hangingprotocols/` — 默认悬挂协议
- `src/Toolbar/` — 默认工具栏按钮

### 6.3 其他扩展简介

| 扩展 | 说明 |
|---|---|
| `measurement-tracking` | 测量追踪上下文、追踪视口、测量面板 |
| `cornerstone-dicom-seg` | DICOM SEG 分割叠加 |
| `cornerstone-dicom-rt` | RT Struct 渲染 |
| `cornerstone-dicom-sr` | 结构化报告解析与显示 |
| `cornerstone-dynamic-volume` | 4D 动态体积 |
| `dicom-microscopy` | 全切片显微镜（基于 dicom-microscopy-viewer） |
| `dicom-pdf` | PDF 渲染 |
| `dicom-video` | DICOM 视频播放 |
| `tmtv` | 全身代谢肿瘤体积分析工具 |

---

## 7. Modes — 工作流模式

Mode 定义了一种完整的阅片工作流，包括：布局、工具组、Toolbar、路由参数、所需扩展版本依赖。

每个 mode 入口 `src/index.ts` 导出对象示例：

```ts
export default {
  id: 'viewer',           // 路由路径段
  routeName: 'viewer',
  displayName: 'Basic Viewer',
  
  extensionDependencies: {
    '@ohif/extension-default': '^3.0.0',
    '@ohif/extension-cornerstone': '^3.0.0',
  },
  
  routes: [
    {
      path: 'viewer',
      layoutTemplate: () => ({ id: ohif.layout, props: { leftPanels, rightPanels, viewports } }),
    }
  ],
  
  onModeEnter({ servicesManager, extensionManager }) {},
  onModeExit({ servicesManager }) {},
};
```

### 已有 Modes

| Mode | ID | 说明 |
|---|---|---|
| `basic` | `viewer` | 基础 2D 阅片 |
| `longitudinal` | `viewer` | 基础 + 测量追踪 |
| `segmentation` | `segmentation` | 分割标注工作流 |
| `tmtv` | `tmtv` | PET/CT 全身代谢体积 |
| `microscopy` | `microscopy` | 全切片显微镜阅片 |
| `preclinical-4d` | `dynamic-volume` | 临床前 4D 动态体积 |
| `usAnnotation` | `usAnnotation` | 超声标注 |

---

## 8. platform/ui-next — 新版 UI 组件库

**包名**：`@ohif/ui-next`  
基于 **shadcn/ui + Radix UI + Tailwind CSS**，是主要的 UI 开发目标（逐步替代旧版 `@ohif/ui`）。

### 重要组件目录（`src/components/`）

| 组件 | 说明 |
|---|---|
| `StudyBrowser/` | 研究浏览器（Thumbnail 列表）|
| `SegmentationTable/` | 分割表格 |
| `MeasurementTable/` | 测量表格 |
| `Viewport/` | 视口容器 |
| `SidePanel/` | 侧边面板 |
| `Header/` | 顶部导航栏 |
| `ToolButton/` | 工具栏按钮 |
| `OHIFToolbox/` | 工具箱面板 |
| `CinePlayer/` | CINE 播放器 |
| `LayoutSelector/` | 布局选择器 |
| `ThemeWrapper/` | 主题包裹器（亮/暗模式）|
| `Icons/` | OHIF 图标集 |

### Context Providers（`src/contextProviders/`）

- `ViewportGridProvider` — 视口网格状态
- `DialogProvider` / `ModalProvider` — 对话框与模态框
- `CineProvider` — CINE 播放状态
- `NotificationProvider` — 通知系统
- `UserAuthenticationProvider` — 用户认证

---

## 9. 数据流与关键流程

### 9.1 影像加载流程

```
URL 参数（StudyInstanceUIDs）
  → DataSourceWrapper（路由组件）
  → DataSource.query.studies()        ← QIDO-RS
  → DataSource.retrieve.series()      ← WADO-RS metadata
  → DicomMetadataStore（元数据缓存）
  → DisplaySetService（生成 DisplaySet）
  → SOP Class Handler（判断影像类型）
  → HangingProtocolService（匹配布局）
  → ViewportGridService（分配视口）
  → CornerstoneViewportService（渲染）
```

### 9.2 测量流程

```
用户在视口操作测量工具（cornerstoneTools）
  → cornerstoneTools 事件
  → MeasurementService.addOrUpdate()
  → PubSub 广播 MEASUREMENT_ADDED/UPDATED
  → PanelMeasurement 订阅更新 UI
```

### 9.3 悬挂协议匹配

```
DisplaySet 创建完成
  → HangingProtocolService.run(protocol)
  → HPMatcher 匹配 study/series 属性
  → ProtocolEngine 计算最优布局
  → ViewportGridService 更新网格
  → 各视口加载对应 DisplaySet
```

---

## 10. 构建与开发命令

```bash
# 安装依赖
yarn install --frozen-lockfile

# 本地开发（DICOMweb 模式）
yarn dev

# 连接本地 Orthanc
yarn dev:orthanc

# 连接 dcm4chee
yarn dev:dcm4chee

# 生产构建
yarn build

# 单元测试
yarn test:unit

# E2E 测试（Playwright）
yarn test:e2e

# 清理
yarn clean
```

### CLI 工具

```bash
# 添加扩展到项目
yarn cli add-extension @ohif/extension-xxx

# 添加 Mode
yarn cli add-mode @ohif/mode-xxx

# 创建新扩展包
yarn cli create-extension
```

---

## 11. 配置系统

应用配置通过 `platform/app/public/config/` 下的 JS 文件注入，支持：

- `dataSources`：数据源配置（DICOMweb URL、认证等）
- `defaultDataSourceName`：默认数据源
- `oidc`：OpenID Connect 认证配置
- `customizationService`：UI 定制化
- `hotkeys`：快捷键覆盖
- `showStudyList`：是否显示研究列表
- `maxNumberOfWebWorkers`：Web Worker 数量
- `studyPrefetcher`：预加载策略

---

## 12. 测试规范

- **单元测试**：`jest`，各包内 `*.test.js/ts` 文件
- **E2E 测试**：`Playwright`，根目录 `tests/*.spec.ts`
- **视觉回归**：Percy（CI 集成）
- 测试数据：`testdata/` git submodule，需运行 `yarn test:data` 初始化

---

## 13. 关键约定与注意事项

1. **新增功能优先通过扩展实现**，不要直接修改 platform/core 除非是基础设施变更
2. **Mode 仅组合已有扩展**，不应包含业务逻辑；业务逻辑放在对应扩展中
3. **UI 组件新开发使用 `@ohif/ui-next`**（shadcn/Radix），避免继续在旧版 `@ohif/ui` 中添加
4. **服务之间通过 PubSub 解耦**，禁止服务之间直接互相引用（通过 `servicesManager.services.XXX` 访问）
5. **CommandsManager** 是扩展间通信的主要桥梁，跨模块操作优先通过命令实现
6. **悬挂协议** 的匹配条件写在 `getHangingProtocolModule` 中，避免硬编码视口数量
7. **TypeScript** 是主要语言，新文件使用 `.ts/.tsx`；旧 JS 文件按需迁移
8. 包版本统一在 `lerna.json` 管理，版本号遵循 semver

---

## 14. 重要文件索引

| 文件 | 说明 |
|---|---|
| `platform/core/src/index.ts` | `@ohif/core` 公开 API 总入口 |
| `platform/core/src/extensions/ExtensionManager.ts` | 扩展管理器实现 |
| `platform/core/src/extensions/MODULE_TYPES.js` | 模块类型枚举 |
| `platform/core/src/services/ServicesManager.ts` | 服务管理器 |
| `platform/app/src/appInit.js` | 应用初始化（Manager + Service 注册）|
| `platform/app/src/App.tsx` | React 应用根组件 |
| `platform/app/src/routes/Mode/Mode.tsx` | Mode 路由组件 |
| `extensions/cornerstone/src/index.tsx` | cornerstone 扩展入口 |
| `extensions/cornerstone/src/Viewport/OHIFCornerstoneViewport.tsx` | 主视口组件 |
| `extensions/default/src/DicomWebDataSource/index.ts` | DICOMweb 数据源 |
| `extensions/default/src/ViewerLayout/` | 默认布局模板 |
| `modes/longitudinal/src/index.ts` | 纵向追踪 Mode 示例 |
| `lerna.json` | Monorepo 包版本与包列表 |
| `package.json` | 根级脚本与 workspace 配置 |
