# 版本发布指南

本文档说明如何发布新版本 Docker 镜像。

## 版本标签策略

项目以发布日期作为版本号，格式：`v年.月.日`，例如 `v2026.10.19`。

- 月、日不补零：2026 年 1 月 5 日写作 `v2026.1.5`，不能写成 `v2026.01.05`（npm 版本号不允许前导零）。
- 同一天需要再次发布时，可追加预发布后缀，如 `v2026.10.19-1`（带 `-` 的标签不会更新 `latest`）。
- `package.json` 的 `version` 字段与标签保持一致（不含 `v`），设置页「关于」中显示为 `v` + 版本号。可用以下命令修改：

```bash
npm version 2026.10.19 --no-git-tag-version
```

## 发布操作流程

### 1. 确保代码已提交

```bash
git status
git add .
git commit -m "feat: 新功能描述"
git push origin main
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
git push origin v2026.10.19
```

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
    image: ghcr.io/wttwins/wrong-notebook:2026.10.19
    
    # 或：自动获取当月更新
    image: ghcr.io/wttwins/wrong-notebook:2026.10
    
    # 不推荐：始终最新（生产环境慎用）
    image: ghcr.io/wttwins/wrong-notebook:latest
```

## 常用命令

```bash
# 查看所有标签
git tag -l

# 删除本地标签
git tag -d v2026.10.19

# 删除远程标签
git push origin --delete v2026.10.19

# 查看标签对应的提交
git show v2026.10.19
```
