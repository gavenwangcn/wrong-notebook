#!/usr/bin/env bash
# 在 Ubuntu 22.04+（及其他 Linux）上构建安卓 APK，封装 scripts/package/build.mjs 的前置步骤。
#
# 默认构建「客户端版」手机 + 平板 APK（连接已部署的服务端，无需 Prisma 交叉编译，最快）。
# 单机版需额外 dist/bundle、安卓 Prisma 引擎、NDK、rustup、patchelf，耗时长。
#
# 用法：
#   bash scripts/package/build-android-ubuntu.sh              # 客户端 phone + tablet
#   bash scripts/package/build-android-ubuntu.sh --standalone   # 单机版 phone + tablet
#   bash scripts/package/build-android-ubuntu.sh --all          # 四种 APK（与 CI 默认一致）
#   bash scripts/package/build-android-ubuntu.sh --mode client --flavor phone
#   bash scripts/package/build-android-ubuntu.sh --install-apt-deps   # 安装 apt 依赖（需 sudo）
#   bash scripts/package/build-android-ubuntu.sh --help
#
# 环境准备（首次在 Ubuntu 22 上，示例）：
#   # Node.js 22.15+：见 https://nodejs.org/ 或 nvm
#   sudo apt-get update
#   sudo apt-get install -y openjdk-17-jdk zip unzip curl patchelf
#   # Gradle 8.11：https://gradle.org/install/ 或使用 CI 同款：
#   #   curl -fsSL https://services.gradle.org/distributions/gradle-8.11.1-bin.zip -o /tmp/gradle.zip
#   #   sudo unzip -d /opt /tmp/gradle.zip && sudo ln -sf /opt/gradle-8.11.1/bin/gradle /usr/local/bin/gradle
#   # Android SDK（cmdline-tools），设置 ANDROID_HOME，例如：
#   #   export ANDROID_HOME=$HOME/Android/Sdk
#   #   sdkmanager "platforms;android-35" "build-tools;35.0.0"
#   # 单机版还需：rustup、Android NDK（sdkmanager "ndk;..."），并 export ANDROID_NDK_HOME
#
# 产物：dist/WrongNotebook-Android-*.apk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MODE="client"
FLAVOR=""
BUILD_ALL=false
SKIP_NPM_CI=false
SKIP_BUNDLE=false
SKIP_ENGINES=false
INSTALL_APT=false

usage() {
    sed -n '2,20p' "$0" | sed 's/^# \?//'
    exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --standalone) MODE="standalone" ;;
        --all) BUILD_ALL=true ;;
        --mode) MODE="${2:?}"; shift ;;
        --flavor) FLAVOR="${2:?}"; shift ;;
        --skip-npm-ci) SKIP_NPM_CI=true ;;
        --skip-bundle) SKIP_BUNDLE=true ;;
        --skip-engines) SKIP_ENGINES=true ;;
        --install-apt-deps) INSTALL_APT=true ;;
        -h|--help) usage 0 ;;
        *) echo "未知参数: $1" >&2; usage 1 ;;
    esac
    shift
done

if $BUILD_ALL; then
    MODE=""
    FLAVOR=""
fi

if [[ -n "$MODE" && "$MODE" != "client" && "$MODE" != "standalone" ]]; then
    echo "--mode 只能是 client 或 standalone" >&2
    exit 1
fi
if [[ -n "$FLAVOR" && "$FLAVOR" != "phone" && "$FLAVOR" != "tablet" ]]; then
    echo "--flavor 只能是 phone 或 tablet" >&2
    exit 1
fi

log() { echo "[android-ubuntu] $*"; }

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

check_java() {
    need_cmd java || return 1
    local ver
    ver="$(java -version 2>&1 | head -1)"
    if ! grep -qE 'version "1[7-9]|version "[2-9][0-9]' <<< "$ver"; then
        echo "需要 JDK 17+，当前: $ver" >&2
        return 1
    fi
}

check_android_sdk() {
    local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
    if [[ -z "$sdk" || ! -d "$sdk" ]]; then
        echo "请设置 ANDROID_HOME 或 ANDROID_SDK_ROOT 指向 Android SDK 目录" >&2
        return 1
    fi
    export ANDROID_HOME="$sdk"
    export ANDROID_SDK_ROOT="$sdk"
}

resolve_gradle() {
    if command -v gradle >/dev/null 2>&1; then
        echo gradle
        return 0
    fi
    local candidate
    for candidate in /opt/gradle-*/bin/gradle; do
        if [[ -x "$candidate" ]]; then
            echo "$candidate"
            return 0
        fi
    done
    echo gradle
}

check_gradle() {
    local g="${GRADLE:-$(resolve_gradle)}"
    if [[ "$g" == /* ]]; then
        [[ -x "$g" ]] || { echo "Gradle 不可执行: $g" >&2; return 1; }
    else
        need_cmd "$g" || return 1
    fi
    export GRADLE="$g"
    local gv
    gv="$("$g" -v 2>/dev/null | grep '^Gradle' | head -1 || true)"
    if [[ -z "$gv" ]]; then
        echo "无法获取 Gradle 版本，请安装 Gradle 8.11 左右" >&2
        return 1
    fi
    log "使用 $gv"
}

check_standalone_extras() {
    need_cmd patchelf || { echo "单机版需要 patchelf（apt install patchelf）" >&2; return 1; }
    need_cmd zip || { echo "单机版需要 zip" >&2; return 1; }
    need_cmd curl || return 1
    need_cmd rustc || { echo "单机版 Prisma 引擎需要 rustup/rustc" >&2; return 1; }
    local ndk="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-${ANDROID_NDK_LATEST_HOME:-}}}"
    if [[ -z "$ndk" || ! -d "$ndk/toolchains/llvm/prebuilt" ]]; then
        echo "单机版需要 Android NDK，请设置 ANDROID_NDK_HOME（sdkmanager 安装 ndk）" >&2
        return 1
    fi
}

if $INSTALL_APT; then
    log "安装 apt 依赖（openjdk-17-jdk zip unzip curl patchelf）…"
    sudo apt-get update
    sudo apt-get install -y openjdk-17-jdk zip unzip curl patchelf
fi

log "检查构建环境…"
check_node
check_java
check_android_sdk
check_gradle

NEED_STANDALONE=false
if $BUILD_ALL || [[ "$MODE" == "standalone" ]]; then
    NEED_STANDALONE=true
    check_standalone_extras
fi

if ! $SKIP_NPM_CI; then
    log "npm ci…"
    npm ci --registry="${npm_config_registry:-https://registry.npmjs.org}"
fi

log "prisma generate…"
npx prisma generate

if $NEED_STANDALONE; then
    if ! $SKIP_BUNDLE; then
        log "构建服务端 bundle（单机版内置）…"
        node scripts/package/build.mjs bundle
    else
        log "跳过 bundle（--skip-bundle）"
    fi
    ENGINES_DIR="${ANDROID_PRISMA_ENGINES_DIR:-$ROOT/dist/android-prisma-engines}"
    if ! $SKIP_ENGINES; then
        if [[ -f "$ENGINES_DIR/libquery_engine.so" && -f "$ENGINES_DIR/schema-engine" ]]; then
            log "已存在 Prisma 安卓引擎，跳过（$ENGINES_DIR）"
        else
            log "交叉编译 Prisma 安卓引擎（约 15–30 分钟）…"
            bash scripts/package/build-android-prisma-engines.sh "$ENGINES_DIR"
        fi
    else
        log "跳过 Prisma 引擎（--skip-engines）"
    fi
    export ANDROID_PRISMA_ENGINES_DIR="$ENGINES_DIR"
fi

BUILD_ARGS=(android)
if $BUILD_ALL; then
    :
elif [[ -n "$MODE" ]]; then
    BUILD_ARGS+=(--mode "$MODE")
fi
if [[ -n "$FLAVOR" ]]; then
    BUILD_ARGS+=(--flavor "$FLAVOR")
fi

log "构建 APK: node scripts/package/build.mjs ${BUILD_ARGS[*]}"
node scripts/package/build.mjs "${BUILD_ARGS[@]}"

log "完成。安装包："
ls -la "$ROOT/dist"/WrongNotebook-Android*.apk 2>/dev/null || true
