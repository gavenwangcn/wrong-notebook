#!/usr/bin/env bash
# 在 Ubuntu 22.04+（及 Docker）上触发 iOS 客户端构建。
#
# Apple 工具链仅能在 macOS 上运行 xcodebuild，Linux 容器内无法像安卓 APK 那样本地编译。
# 本脚本提供与 build-android-ubuntu.sh 对等的入口：
#   1) 配置 IOS_BUILD_SSH=user@mac 时：rsync 源码到 Mac，远程执行 build-ios-macos.sh，再拉回 dist/*.app
#   2) --pack-source：生成 dist/WrongNotebook-iOS-mac-build-<版本>.tar.gz，拷到 Mac 解压后 bash scripts/package/build-ios-macos.sh
#   3) 在 macOS 宿主机上运行本脚本时，自动转调 build-ios-macos.sh
#
# 用法：
#   bash scripts/package/build-ios-ubuntu.sh
#   IOS_BUILD_SSH=builder@192.168.1.20 bash scripts/package/build-ios-ubuntu.sh
#   bash scripts/package/build-ios-ubuntu.sh --pack-source
#   bash scripts/package/build-ios-ubuntu.sh --simulator          # 与 --pack-source / 远程构建配合
#   bash scripts/package/build-ios-ubuntu.sh --validate-only
#   bash scripts/package/build-ios-ubuntu.sh --install-apt-deps   # openssh-client rsync zip（需 sudo）
#   bash scripts/package/build-ios-ubuntu.sh --help
#
# Docker：见 docker-compose.ios-build.yml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

SIMULATOR=false
PACK_SOURCE=false
VALIDATE_ONLY=false
SKIP_NPM_CI=false
INSTALL_APT=false
FORCE_REMOTE=false

usage() {
    sed -n '2,22p' "$0" | sed 's/^# \?//'
    exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --simulator) SIMULATOR=true ;;
        --pack-source) PACK_SOURCE=true ;;
        --validate-only) VALIDATE_ONLY=true ;;
        --skip-npm-ci) SKIP_NPM_CI=true ;;
        --install-apt-deps) INSTALL_APT=true ;;
        --remote) FORCE_REMOTE=true ;;
        -h|--help) usage 0 ;;
        *) echo "未知参数: $1" >&2; usage 1 ;;
    esac
    shift
done

log() { echo "[ios-ubuntu] $*"; }

need_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "缺少命令: $1" >&2
        return 1
    fi
}

check_node() {
    need_cmd node || return 1
    local major minor
    major="$(node -p 'process.versions.node.split(".")[0]')"
    minor="$(node -p 'process.versions.node.split(".")[1]')"
    if (( major < 22 || (major == 22 && minor < 15) )); then
        echo "需要 Node.js 22.15+，当前 $(node -v)" >&2
        return 1
    fi
}

validate_ios_project() {
    local missing=0
    for f in \
        packaging/ios/WrongNotebookClient.xcodeproj/project.pbxproj \
        packaging/ios/WrongNotebookClient.xcodeproj/xcshareddata/xcschemes/WrongNotebookClient.xcscheme \
        packaging/ios/WrongNotebookClient/Resources/bridge.js \
        scripts/package/build-ios-macos.sh \
        scripts/package/build.mjs
    do
        if [[ ! -e "$ROOT/$f" ]]; then
            echo "缺少文件: $f" >&2
            missing=1
        fi
    done
    return "$missing"
}

package_version() {
    node -p "require('./package.json').version.replace(/^v/, '')"
}

pack_source() {
    need_cmd tar
    validate_ios_project
    local ver
    ver="$(package_version)"
    mkdir -p "$ROOT/dist"
    local out="$ROOT/dist/WrongNotebook-iOS-mac-build-${ver}.tar.gz"
    log "打包 Mac 构建用源码包 → ${out#"$ROOT/"}"
    tar -czf "$out" \
        --exclude='._*' \
        packaging/ios \
        scripts/package/build.mjs \
        scripts/package/build-ios-macos.sh \
        scripts/package/android-runtime.mjs \
        scripts/package/android-version.mjs \
        package.json \
        package-lock.json
    log "在 Mac 上：tar -xzf $(basename "$out") && npm ci && bash scripts/package/build-ios-macos.sh"
}

remote_build() {
    local ssh_target="${IOS_BUILD_SSH:?请设置 IOS_BUILD_SSH（例如 builder@mac-mini.local）}"
    need_cmd ssh
    need_cmd rsync
    validate_ios_project

    local remote_subdir="${IOS_BUILD_REMOTE_DIR:-wrong-notebook-ios-build}"
    remote_subdir="${remote_subdir#/}"
    local remote_path="~/${remote_subdir}"

    log "检查 SSH 连接 ${ssh_target} …"
    ssh -o BatchMode=yes -o ConnectTimeout=15 "$ssh_target" "uname -s" | grep -q Darwin || {
        echo "远程主机必须是 macOS（需已安装 Xcode 与 Node.js 22.15+）" >&2
        exit 1
    }

    log "同步源码到 ${ssh_target}:${remote_path} …"
    ssh -o BatchMode=yes "$ssh_target" "mkdir -p ${remote_path}"
    rsync -az --delete \
        --exclude node_modules \
        --exclude dist \
        --exclude .git \
        --exclude .next \
        --exclude coverage \
        --exclude 'packaging/android/.gradle' \
        "$ROOT/" "${ssh_target}:${remote_subdir}/"

    log "在 Mac 上执行 xcodebuild …"
    local sim_flag=""
    $SIMULATOR && sim_flag=" --simulator"
    local pv_prefix=""
    [[ -n "${PACKAGE_VERSION:-}" ]] && pv_prefix="export PACKAGE_VERSION=${PACKAGE_VERSION}; "
    ssh -o BatchMode=yes "$ssh_target" "${pv_prefix}set -euo pipefail; cd ${remote_subdir}; npm ci --registry=\${npm_config_registry:-https://registry.npmjs.org}; bash scripts/package/build-ios-macos.sh${sim_flag}"

    mkdir -p "$ROOT/dist"
    log "拉回 dist/WrongNotebook-iOS-*.app …"
    rsync -az --prune-empty-dirs \
        --include 'WrongNotebook-iOS-*/' \
        --include 'WrongNotebook-iOS-*/**' \
        --exclude '*' \
        "${ssh_target}:${remote_subdir}/dist/" "$ROOT/dist/" || {
        echo "远程未找到 .app，请检查 Mac 上 xcodebuild 与签名配置" >&2
        exit 1
    }
    log "完成。本地产物："
    ls -la "$ROOT/dist"/WrongNotebook-iOS-* 2>/dev/null || true
}

if [[ "$(uname -s)" == Darwin ]]; then
    args=()
    $SIMULATOR && args+=(--simulator)
    exec bash "$ROOT/scripts/package/build-ios-macos.sh" "${args[@]}"
fi

if $INSTALL_APT; then
    log "安装 apt 依赖（openssh-client rsync zip）…"
    sudo apt-get update
    sudo apt-get install -y openssh-client rsync zip ca-certificates
fi

log "检查 Node.js …"
check_node

log "校验 iOS 工程 …"
validate_ios_project

if $VALIDATE_ONLY; then
    log "校验通过。"
    exit 0
fi

if [[ -n "${IOS_BUILD_SSH:-}" ]] || $FORCE_REMOTE; then
    if ! $SKIP_NPM_CI && [[ -f package-lock.json ]]; then
        log "npm ci（远程构建前校验 lockfile）…"
        npm ci --registry="${npm_config_registry:-https://registry.npmjs.org}"
    fi
    remote_build
    exit 0
fi

if $PACK_SOURCE || [[ "${IOS_BUILD_MODE:-pack}" == pack ]]; then
    pack_source
    if [[ -z "${IOS_BUILD_SSH:-}" ]]; then
        log ""
        log "说明：Linux 无法本地运行 Xcode。若要在 Ubuntu/Docker 上直接得到 .app，"
        log "请在一台已安装 Xcode 的 Mac 上配置免密 SSH，并设置 IOS_BUILD_SSH 后重跑。"
        log "示例：IOS_BUILD_SSH=you@mac docker compose -f docker-compose.ios-build.yml run --rm ios-build"
    fi
    exit 0
fi

echo "未指定构建方式。请设置 IOS_BUILD_SSH，或使用 --pack-source / --validate-only。" >&2
exit 1
