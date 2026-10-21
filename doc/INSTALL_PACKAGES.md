# 安装包

除 Docker 镜像外，每个版本还提供以下安装包，均可在 [GitHub Releases](https://github.com/margrop/wrong-notebook/releases) 下载（npm 包发布到 npm 仓库）。

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| npm | `npm install -g wrong-notebook` | 需要 Node.js 22.15 及以上，适合服务器或已有 Node 环境 |
| Windows | `WrongNotebook-Win-Setup-<版本>-x64.exe` / `WrongNotebook-Win-Portable-<版本>-x64.exe` | 安装版 / 免安装版 |
| macOS | `WrongNotebook-Mac-<版本>-arm64.dmg`（Apple 芯片）/ `-x64.dmg`（Intel），另有同名 `.zip` | 未签名，首次打开需右键选择「打开」 |
| Linux | `WrongNotebook-Linux-<版本>-<架构>.AppImage` / `.deb` | x86_64 与 arm64 |
| 飞牛OS | `WrongNotebook-FnOS-<版本>-x86.fpk` / `-arm.fpk` | 在应用中心手动安装，依赖应用中心的 Node.js v24 |

校验和见 Release 中的 `SHA256SUMS.txt`。

所有安装包运行同一个服务端（Next.js standalone 构建）和启动器 `packaging/runtime/launcher.js`，行为与 Docker 镜像一致：

- 首次启动复制预置数据库（含默认管理员和系统标签），默认管理员为 `admin@localhost` / `123456`，登录后请立即修改密码。
- 每次启动执行 `prisma migrate deploy`，只做增量迁移，升级保留已有数据。
- 数据库、`config/app-config.json` 和自动生成的 NextAuth 密钥都在数据目录，安装目录可以只读。

## 各平台说明

### npm

```bash
npm install -g wrong-notebook
wrong-notebook --port 3000 --host 0.0.0.0 --data-dir ~/.wrong-notebook
```

- 数据目录默认 `~/.wrong-notebook`，也可用环境变量 `WRONG_NOTEBOOK_HOME`。
- 安装时由 postinstall 按本机平台生成 Prisma Client 并下载引擎。国内网络可设置 `PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma`。
- 需要后台常驻时可交给 systemd、pm2 等进程管理工具。

### Windows / macOS / Linux 桌面版

桌面版基于 Electron，内置服务端，打开即用：

- 服务只监听 `127.0.0.1`，默认端口 39300，被占用时自动顺延。
- 数据目录：Windows `%APPDATA%\WrongNotebook\data`，macOS `~/Library/Application Support/WrongNotebook/data`，Linux `~/.config/WrongNotebook/data`。服务日志在数据目录的 `logs/server.log`。
- 卸载不会删除数据目录。
- 安装包未签名：Windows 可能出现 SmartScreen 提示，选择「仍要运行」；macOS 首次打开需右键「打开」，或执行 `xattr -dr com.apple.quarantine /Applications/WrongNotebook.app`。
- Linux 的 Prisma 引擎需要 OpenSSL 3（Ubuntu 22.04、Debian 12 及更新版本）。

### 飞牛OS

1. 在应用中心安装 Node.js v24。
2. 应用中心 →「手动安装」，选择与设备架构对应的 `.fpk`。
3. 安装后从桌面图标打开，服务端口 39300，局域网内其他设备也可通过 `http://<NAS 地址>:39300` 访问。

数据保存在应用数据目录（`@appdata/wrongnotebook`），日志为其中的 `wrong-notebook.log`。

## 本地构建

需要 Node.js 22.15 及以上。Prisma 引擎与构建机平台一致，桌面版和飞牛OS 包须在目标平台（及架构）上构建。

```bash
npm ci
node scripts/package/build.mjs bundle                 # 构建通用服务端包 dist/bundle
node scripts/package/build.mjs npm                    # dist/wrong-notebook-<版本>.tgz
node scripts/package/build.mjs desktop --mac --arm64  # 参数原样传给 electron-builder
node scripts/package/build.mjs fnos --arch x86        # 需要 PATH 中有 fnpack
```

- 版本号依次取 `--version`、环境变量 `PACKAGE_VERSION`、`package.json`。
- `bundle` 会构建 Next.js；只改了打包脚本时可加 `--skip-build` 复用已有的 `.next`。
- 产物全部输出到 `dist/`（已加入 `.gitignore`）。打包时会移除 standalone 带入的 `.env`、`config/` 和数据库文件，避免把本机密钥打进安装包。

## 发布

推送 `v*` 标签后，`.github/workflows/packages.yml` 在各平台 Runner 上构建全部安装包并上传到对应的 GitHub Release；也可以在 Actions 页面手动运行，只生成构建产物。

npm 发布需要在仓库 Secrets 中配置 `NPM_TOKEN`，未配置时跳过发布；带 `-` 的预发布标签发布到 npm 的 `next` 标签。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `scripts/package/build.mjs` | 构建脚本 |
| `packaging/runtime/launcher.js` | 各安装包共用的启动器 |
| `packaging/npm/` | npm 命令行入口与 README |
| `packaging/desktop/` | Electron 桌面壳与 electron-builder 配置 |
| `packaging/fnos/` | 飞牛OS manifest、生命周期脚本、安装向导和图标 |
