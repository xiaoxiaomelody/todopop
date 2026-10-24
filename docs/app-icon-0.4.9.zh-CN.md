# TODOPOP 0.4.9

应用图标替换为 Figma 左侧 App icon / Outline，节点 152:5147，原始画布 1024×1024。使用 Figma 返回的原始 SVG，未重绘路径；导出 PNG 后生成标准 iconset 和 ICNS，并通过 electron-builder 的 mac.icon 接入。

本轮仅更换应用图标并打包，未实施之前讨论的文字对比度或透视方案。安装前完全退出旧版，替换 Applications 中的应用。
