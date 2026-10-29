#!/usr/bin/env bash
# 在 macOS 上构建 iOS 客户端（WrongNotebookClient.xcodeproj）。
#
#   bash scripts/package/build-ios-macos.sh              # 真机 Release .app → dist/
#   bash scripts/package/build-ios-macos.sh --simulator  # 模拟器 .app
#
# 安装到 iPhone/iPad：
#   1. 用 Xcode 打开 packaging/ios/WrongNotebookClient.xcodeproj
#   2. 设置 Signing & Capabilities 中的 Team（Apple ID 即可）
#   3. 连接设备，Product → Run；或使用 dist/ 下 .app + Apple Configurator / ios-deploy
#
# App Store / TestFlight 需 Archive 后 Export IPA（Xcode Organizer）。
set -euo pipefail
cd "$(dirname "$0")/../.."

if [[ "$(uname -s)" != Darwin ]]; then
  echo "iOS 构建仅支持 macOS（需安装 Xcode）" >&2
  exit 1
fi

args=(ios)
if [[ "${1:-}" == "--simulator" ]]; then
  args+=(--simulator)
fi

node scripts/package/build.mjs "${args[@]}"
