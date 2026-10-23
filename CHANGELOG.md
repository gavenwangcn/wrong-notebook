# 更新日志

本文件记录各正式版的改动，由 `scripts/changelog.sh` 根据提交信息生成，请勿手动编辑。
预览版（`v年.月.日-n`）的改动见 [GitHub Releases](https://github.com/margrop/wrong-notebook/releases)，并归入其后的正式版。

## [2026.10.23](https://github.com/margrop/wrong-notebook/releases/tag/v2026.10.23) - 2026-10-23

### ✨ 新功能
- 错题复习状态改为待复习、复习中、已掌握三类
- 新增安卓单机版，APK 内置 Node.js 与服务端，无需部署服务器
- 新增安卓手机版、平板版客户端，发布时随 Release 提供 APK
- 完善 PWA，补齐多尺寸图标并加入 Service Worker 与离线页
- SVG 动画讲解绑定界面语言，中英文版本分别生成并随语言自动切换

### 🛠 修复
- SVG 净化循环内联到替换处，日志去换行改用标准写法，便于代码扫描识别
- 桌面版 Electron 升级到 42.11.3，修复多项已公开的安全漏洞
- 安卓 App 关闭系统备份，Bridge 只为本服务器页面执行操作
- HTTPS 代理与测试脚本日志去掉换行，防止伪造日志行
- 配置文件和会话密钥读写消除先判断后操作的竞态
- 题目配图 SVG 反复净化直到稳定，防止嵌套拼接出脚本
- 拉取模型列表只允许 http/https 地址，去掉末尾斜杠改用无回溯实现
- 升级 global-agent 4 与 KaTeX 0.19，修复依赖漏洞和 http 模块代理未生效
- 「关于」页链接指向本项目仓库，更新版权说明

**完整变更**：https://github.com/margrop/wrong-notebook/compare/v2026.10.22...v2026.10.23

## [2026.10.22](https://github.com/margrop/wrong-notebook/releases/tag/v2026.10.22) - 2026-10-22

### ✨ 新功能
- 默认 AI 渠道改为 MiniMax，OpenAI 和 Gemini 移至渠道列表末尾
- 新增 Kimi 官方大模型渠道，默认使用 kimi-k3
- 新增 DeepSeek 官方大模型渠道，默认使用 deepseek-flash
- 新增智谱 GLM 官方大模型渠道，默认使用 glm-5.3-flash
- 新增 MiniMax 官方大模型渠道，默认使用 MiniMax-M3.1-Flash
- OpenAI 渠道默认模型改为 gpt-6.1-sol
- AI 识别知识点时将题目与完整解答过程一并提交
- 精简安装包中的 Prisma 文件，飞牛OS 和桌面版体积减半

### 🛠 修复
- 补全错题本筛选与原题图片按钮的英文翻译

**完整变更**：https://github.com/margrop/wrong-notebook/compare/v2026.10.21...v2026.10.22

## [2026.10.21](https://github.com/margrop/wrong-notebook/releases/tag/v2026.10.21) - 2026-10-21

### ✨ 新功能
- 增加 npm、Windows、macOS、Linux、飞牛OS 全平台安装包

**完整变更**：https://github.com/margrop/wrong-notebook/compare/v2026.10.20...v2026.10.21

## [2026.10.20](https://github.com/margrop/wrong-notebook/releases/tag/v2026.10.20) - 2026-10-20

- 首个正式版本，此前的改动见 Git 提交历史

