# 技术说明

## 插件形态

本插件是 DSH 的 **Host + Client** 双半部插件：

- `index.js`（Host）在 DSH Host 进程中运行：注册状态/控制路由，探测原生窗口材质，管理后备采样器。
- `client.js`（web client）由页面加载：注入玻璃样式、设置页、背景帧轮询和原生/后备模式切换。
- 无 npm 运行时依赖；`package.json` 中 `dsh.bundle.patch` 指向 `cordis.patch.yml`，`dsh.client.immediately` 让页面启动时加载客户端。

## 原生亚克力的实现

AutoInterview 这类应用的磨砂质感来自 Electron 主进程的窗口材质。页面插件无法修改 `BrowserWindow`，因此需要一次性的 `app.asar` 适配：

```ts
// 修改前
...process.platform === "win32" && primary ? {
  backgroundColor: chromeFallbackFill(),
  titleBarStyle: "hidden",
  titleBarOverlay: { height: 40, color: chromeFallbackFill(), symbolColor: ... }
} : {},

// 修改后
...process.platform === "win32" && primary ? {
  backgroundColor: chromeFallbackFill(),
  transparent: true,
  backgroundMaterial: "acrylic",
  titleBarStyle: "hidden",
  titleBarOverlay: { height: 40, color: chromeFallbackFill(), symbolColor: ... }
} : {},

function chromeFallbackFill() {
  return "#00000000"; // 原实现按明暗主题返回不透明色
}
```

`native/install-glass.mjs` 以**同字节长度**方式修改 `lib/main.js`：

1. 读取 asar 头部，定位 `lib/main.js` 的 offset/size；
2. 替换上述两处文本，并通过裁剪紧邻注释保持总字节数不变；
3. 更新该文件在 asar 头部记录的 SHA-256（`hash` 与 `blocks`）；
4. 用 `node --check` 校验补丁后的 ESM 语法；
5. 先在内存中构建完整 asar 并回读验证，再原地写入；
6. 写入前备份为 `app.asar.dsh-desktop-glass.bak`。

`native/probe-window.ps1` 用 Win32 `DwmGetWindowAttribute(hwnd, 38)` 读取 `DWMWA_SYSTEMBACKDROP_TYPE`：值为 `3`（`DWMSBT_TRANSIENTWINDOW`，acrylic）即视为原生材质；同时校验 Windows build ≥ 22621 和系统透明效果开关。

Host 只有在**补丁标记有效 + 探测到 acrylic**时才进入原生模式；否则启动采样器作为后备。

## 页面玻璃

页面样式不画实际模糊，只把主题色板改成半透明并去掉布局接缝：

```css
html[data-dsh-glass="on"] body {
  --dsw-alias-bg-base: color-mix(in srgb, var(--dsh-glass-base-color) var(--dsh-glass-strength), transparent) !important;
  --dsw-specific-sidebar-fill: color-mix(in srgb, var(--dsh-glass-base-color) var(--dsh-glass-strength), transparent) !important;
}
```

同时覆盖：

- `[class*="_frame"]:has(> [class*="_centerCol"])`、`[class*="_sidebarCol"]`、`[class*="_centerCol"]` 的背景/圆角；
- `[class*="_scrollFade"]`：侧栏会话列表底部的白色渐变；
- `[class*="_composerSeat"]`：输入框下方 `linear-gradient(transparent, base 0.3)` 的底部渐变；
- composer card 与用户 `_bubble_` 的悬浮磨砂。

原生模式下 `body::before`（背景帧）和 `body::after`（CSS 模糊）通过 `:not([data-dsh-glass-native="on"])` 关闭，因此不会盖住 DWM acrylic。

## 后备采样模式

- `helper/glass-helper.ps1` 通过 `PrintWindow` 采集窗口后方可见窗口，按 z 序缩放到低分辨率并合成为 JPEG。
- Host 提供 `/dsh-desktop-glass/state`、`/frame.jpg`、`/control`。
- 客户端按设置轮询状态和帧，使用 `--dsh-glass-image` + `backdrop-filter` 展示。
- 设置页的“背景采样帧率 / 自动节能 / 页面高斯模糊”仅在此模式出现。

## 模式探测与切换

Host 启动后：

1. 读取 `native/patch-state.json`，与 `app.asar` 的 size/mtime 对比；
2. 找到补丁标记后，启动 `probe-window.ps1`，在主窗口创建前后重试，直到找到 DSH 主窗口；
3. 若窗口为 acrylic，返回 `native: true` 并停止采样器；否则返回 `native: false` 并启动采样器；
4. 客户端每 2 秒轮询一次状态；检测到 `nativeChecked` 后切换样式。

这样即使页面在窗口创建前加载，也能在几秒内正确进入原生模式；DSH 升级后标记失效则自动回退。

## 恢复

```bat
native\restore-glass.cmd
```

恢复会将备份复制回 `resources/app.asar`，并删除 `native/patch-state.json`（包括已安装插件目录中的标记）。

## 已知限制

- 原生 acrylic 的模糊半径由 Windows 固定；
- Windows 10 或关闭系统透明效果时只能使用采样模式；
- `app.asar` 是 DSH 的打包文件，DSH 更新会覆盖补丁；更新后需重新运行安装器；
- 本插件不修改 DSH 的账号、会话或设置数据。
