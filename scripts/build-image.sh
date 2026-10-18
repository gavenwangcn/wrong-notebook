#!/usr/bin/env bash
# 构建生产镜像：镜像内 ci 阶段在 Alpine 中运行全部测试，builder 阶段完成生产构建。
# 用法：build-image.sh <完整提交号>；NODE_IMAGE、HTTP(S)_PROXY、NO_PROXY 从环境变量读取。
set -euo pipefail
cd "$(dirname "$0")/.."

revision=$(git rev-parse --verify "${1:-HEAD}^{commit}")
image="${IMAGE_REPOSITORY:-wrong-notebook}:$revision"

args=(--build-arg "APP_REVISION=$revision" --build-arg "NODE_IMAGE=${NODE_IMAGE:-node:22-alpine}")
# 只传入已设置的代理变量，未设置时不覆盖镜像内默认值
for name in HTTP_PROXY HTTPS_PROXY NO_PROXY; do
    [[ -n ${!name:-} ]] && args+=(--build-arg "$name=${!name}")
done

echo "Building $image"
DOCKER_BUILDKIT=1 docker build --progress=plain "${args[@]}" -t "$image" .
echo "Built $image"
