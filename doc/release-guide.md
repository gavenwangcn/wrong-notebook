# 版本发布指南

本文档说明如何从公开 `main` 发布新版本 Docker 镜像。下例的 `github` 远程指向公开仓库；私有部署分支不能用于公开发版。

## 版本标签策略

项目以发布日期作为版本号，格式：`v年.月.日`，例如 `v2026.10.19`。

- 月、日不补零：2026 年 1 月 5 日写作 `v2026.1.5`，不能写成 `v2026.01.05`（npm 版本号不允许前导零）。
- 同一天需要再次发布时，可追加预发布后缀，如 `v2026.10.19-1`（带 `-` 的标签不会更新 `latest`）。
- 版本号在构建镜像时由 Git 标签自动得出（环境变量 `APP_VERSION`），发版无需修改代码。设置页「关于」和 `/api/health` 显示该版本号（不含 `v`）。
  - 推送标签触发的构建使用标签本身的版本，如 `2026.10.19`。
  - 其他构建（`scripts/build-image.sh`、手动镜像构建）使用 `git describe` 的结果；标签之后还有提交时形如 `2026.10.19-3-gabc1234`。
  - 取不到标签时（本地开发、浅克隆）回退到 `package.json` 的 `version`，该字段无需随发版更新。

## 发布操作流程

### 1. 确保代码已提交

```bash
git status
git add .
git commit -m "feat: 新功能描述"
git push github main
```

### 2. 创建版本标签

```bash
# 创建标签（使用当天日期）
git tag v2026.10.19

# 或指定提交创建标签
git tag v2026.10.19 <commit-sha>
```

### 3. 推送标签触发构建

```bash
python3 scripts/check-public-history.py v2026.10.19
git push github v2026.10.19
```

首次发布后，GHCR 镜像默认为私有，需在 GitHub 的 Packages → wrong-notebook → Package settings 中改为 Public。

### 4. 查看构建状态

访问 GitHub 仓库的 **Actions** 页面查看构建进度。

## 自动生成的镜像标签

推送 `v2026.10.19` 标签后，CI 自动生成以下镜像标签：

| 标签 | 说明 |
|------|------|
| `2026.10.19` | 精确版本号 |
| `2026.10` | 当月最新版本 |
| `2026` | 当年最新版本 |
| `latest` | 最新版本 |
| `sha-xxxxxxx` | Git commit 短哈希 |

## 用户部署方式

```yaml
# docker-compose.yml
services:
  wrong-notebook:
    # 推荐：锁定精确版本
    image: ghcr.io/margrop/wrong-notebook:2026.10.19
    
    # 或：自动获取当月更新
    image: ghcr.io/margrop/wrong-notebook:2026.10
    
    # 不推荐：始终最新（生产环境慎用）
    image: ghcr.io/margrop/wrong-notebook:latest
```

## 常用命令

```bash
# 查看所有标签
git tag -l

# 删除本地标签
git tag -d v2026.10.19

# 删除远程标签
git push github --delete v2026.10.19

# 查看标签对应的提交
git show v2026.10.19
```
