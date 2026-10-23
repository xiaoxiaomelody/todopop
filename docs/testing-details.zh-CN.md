# TODOPOP 测试详情

日期：2026-10-23。自动化使用隔离的临时 App 数据目录和 Chromium profile，不把测试任务写入日常任务库。

## 已执行的检查

| 检查        | 命令/证据                                                                          | 结果与边界                                                                   |
| ----------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| TypeScript  | `npm run typecheck`                                                                | 桌面、扩展、shared、ui 四个 workspace 通过                                   |
| 逻辑测试    | `npm test`；[unit.log](test-results/unit.log)                                      | 20 项通过、0 失败                                                            |
| 格式        | `npm run format:check`                                                             | 应用、共享包、测试脚本及文档按统一格式检查                                   |
| 构建        | `npm run build`；[build.log](test-results/build.log)                               | Electron main/preload/renderer 和扩展产物生成成功                            |
| 扩展 UI     | `node scripts/extension-ui.mjs`；[结果 JSON](extension-ui-test.json)               | 真正加载 Manifest V3 扩展，使用受控本机 WebSocket 服务验证配对流程与 UI      |
| 桌面验收    | `node scripts/desktop-acceptance.mjs`；[结果 JSON](desktop-acceptance-result.json) | 15 组真实 Electron 场景通过，rendererErrors 为空                             |
| Chrome 集成 | `node scripts/e2e.mjs`；[结果 JSON](e2e-result.json)                               | 真实 MV3 worker、URL、导航和标签链路通过；前台状态使用已标注 fixture，见下节 |
| 打包 App    | `node scripts/package-smoke.mjs`；[结果 JSON](package-smoke-result.json)           | Apple Silicon App 从 app.asar 启动，能创建/完成任务，正常退出刷新数据        |

完整流水线入口为 `npm run verify`，原始汇总保存在 [summary.json](test-results/summary.json)。输入框去矩形 focus 框和最后的草稿保留改动还分别做了专项复跑。测试结果文件中的时间是各次执行时间，不是人工复核签字时间。

## 20 项逻辑测试覆盖

1. 旧任务迁移、保留 ID、一次性生成旧完成记录。
2. 分组、设置、增长、历史和已删除记录的序列化往返；拒绝未来 schema。
3. Rebubble 新建一轮，保留旧完成历史、清零新增长和专注累计。
4. 重复完成幂等；删除与 Undo 不破坏历史。
5. 四档全局暂停、明天日界线、手动恢复和到期判断。
6. 正式增长速度、低级别速率、暂停/Snooze 不增长、长时间间隔限幅。
7. 预设组色交换；自定义色换 Tint 后保持；删除组不删除任务。
8. 排序全量校验、重复/缺失 ID 拒绝、rank 保存。
9. 圆形布局边界、中心面板避让和容量满判断。
10. 归档完成数与跨统计周期的 Focus 时长分摊。
    11–20. 原有 URL 标准化、不同路径/域名/query 不误匹配、Google Docs ID、无效协议、前后台判定、同 URL 多任务完成、任务输入与浏览器消息校验等。

## 15 组桌面场景覆盖

- 旧 `tasks.json` 迁移到 `state.json`，且保留备份与完成历史。
- 正式增长推进；全局 Pause 不隐藏气泡且停止增长。
- 60× Demo 与正式增长隔离，退出 Demo 恢复正式尺寸。
- grip 的方向键排序保存 rank。
- 无链接气泡点击 Pop 并记录完成。
- 有链接气泡点击打开 URL，不自动完成。
- Snooze 与 Show now 保持同任务 ID，区别于全局暂停。
- Rebubble 创建新 ID，保留旧完成任务与历史。
- 删除后点 toast Undo，恢复同一个任务。
- 新建/改名/侧边/自定义组色，换 Tint 不丢自定义颜色。
- 真正右键打开独立编辑窗口，窗口在可用屏幕内，Save 保存。
- 周/月归档、月历 42 格、前后日期操作读取真实记录。
- Launcher 能恢复隐藏的主面板。
- 重启后保存主题、组、排序、暂停和历史，Demo 回到 Real。
- 尚未保存的新任务草稿，切去管理分组后不丢。

链接打开的桌面点击测试会拦截 Electron 的 `shell.openExternal` 并检查目标 URL，避免在正常 Chrome profile 中打开测试页面。真正的扩展导航测试另用隔离 Chromium 和本机 HTTP 测试页。

## 扩展 UI 专项

测试了共享本地字体实际加载、三枚 Logo 素材加载、帮助展开、输入验证、错误配对码、真实认证成功、已保存代码不回显、Show/Hide、Change pairing code、重连、断开和 popup 宽度。

额外检查：

- 聚焦配对输入框后，computed `outlineStyle` 为 `none`，保留下划线。
- 收到桌面 APPEARANCE 消息后，扩展的共享主题变量更新。
- rendererErrors 为空。

[无外框的聚焦截图](screenshots/extension-input-focus.png)、[未连接截图](screenshots/extension-unpaired.png)、[已连接截图](screenshots/extension-connected.png)。

## 必须如实说明的测试边界

**macOS 原生前台切换没有在本轮自动化中完整验证。** 测试 Chromium 的窗口未能稳定成为系统前台，即使其标签已被激活，Chrome API 返回的 focused 仍为 false。

因此集成脚本在检测到该环境条件后，会明确开启一个只用于测试的 Chrome API 边界 fixture；真实 service worker、URL 查询、导航、标签事件、WebSocket 和 Electron 显隐逻辑仍参与测试。`e2e-result.json` 的 `foregroundFixture: true` 与 `nativeForegroundVerified: false` 保留了这个区别，原始 integration.log 也写有 NOTE。

这项结果只能证明链路在指定前台输入下工作，不能据此声称“你的正常 Chrome 与其它 macOS 应用之间的真实切换已通过”。请按人工清单 A6 复核。

其它未完成的验证：外屏拔插、所有 Spaces/全屏组合、长时间 CPU/显存、真实物理厘米、所有系统色彩控件、干净陌生机器的 Gatekeeper、Apple 公证与商店审核。

## 运行方式

先退出正在运行的 TODOPOP，避免本地 17846 端口冲突：

```sh
npm run verify
```

单项可使用：

```sh
npm test
npm run test:extension
npm run test:desktop
npm run test:e2e
node scripts/package-smoke.mjs
```

最后一项需要先存在本地 arm64 打包 App；它不会替你完成 Apple 的正式签名、公证或分发审核。
