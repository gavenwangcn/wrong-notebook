# AI 模型配置

管理员可以在网页设置中修改 AI 配置，保存后后续请求读取新配置，无需重启服务。配置写入 `config/app-config.json`，已保存字段优先于环境变量。

## 配置步骤

1. 以管理员身份登录，打开“设置 → AI 设置”。
2. 选择提供商，填写 API Key、接口地址和模型或部署名称。
3. 测试连接；需要时从接口获取模型列表。
4. 保存设置，再用一道真实题目检查图片输入、解析格式和答案质量。

AI 设置、连接测试、模型列表与提示词设置只向管理员开放。OpenAI 配置支持多个实例，最多 10 个，通过当前激活实例决定实际使用的配置。

## 提供商参数

| 提供商 | 必需参数 | 地址与默认模型 |
| --- | --- | --- |
| Gemini | API Key、可用模型 | 官方 API；代码默认 `gemini-2.5-flash` |
| OpenAI 或兼容接口 | API Key、模型 | 默认 `https://api.openai.com/v1`；代码默认 `gpt-6.1-sol` |
| Azure OpenAI | API Key、Endpoint、部署名称 | API 版本默认 `2024-02-15-preview`；模型字段用于显示 |
| Anthropic 或兼容接口 | API Key、模型 | 默认 `https://api.anthropic.com`；代码默认 `claude-sonnet-5-5` |

默认名称来自当前代码，不代表你的账户已开通这些模型。模型可用性、计费和能力以服务商为准。

OpenAI 兼容服务的 Base URL 应包含其要求的 API 路径；Anthropic 兼容服务的 Base URL 不含 `/v1`，应用会拼接 `/v1/messages`。

## 环境变量

基础选择使用 `AI_PROVIDER`，可选 `gemini`、`openai`、`azure`、`anthropic`。

| 提供商 | 配置项 |
| --- | --- |
| Gemini | `GOOGLE_API_KEY`、`GEMINI_BASE_URL`、`GEMINI_MODEL` |
| OpenAI | `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` |
| Azure | `AZURE_OPENAI_API_KEY`、`AZURE_OPENAI_ENDPOINT`、`AZURE_OPENAI_DEPLOYMENT`、`AZURE_OPENAI_API_VERSION`、`AZURE_OPENAI_MODEL` |
| Anthropic | `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL` |

如果网页里已经保存配置，仅修改环境变量可能不会改变实际生效值；先检查网页中所选提供商和激活实例。全局 AI 分析超时可在管理员“设置 → 通用”中调整，代码默认 180 秒。

## 模型能力要求

| 能力 | 对应功能 |
| --- | --- |
| 图片输入 | 拍照识别、基于原图重绘配图、有原图时重新解答 |
| 数学推理与规范 LaTeX | 答案、解析、错因和难度评定 |
| 按指定标签或 JSON 返回内容 | 各类 AI 结果解析 |
| 输出 SVG 代码 | 静态配图与 SVG 动画讲解 |
| 足够长的输出 | 包含配图的识别结果及分步骤动画 |

SVG 配图与动画由语言模型输出代码生成，不调用图片生成接口。动画常需要较长输出，输出截断时应用会尝试提高输出上限重试；模型本身也必须支持相应长度。

## 提示词与生成规则

管理员可在“提示词”页自定义识别和举一反三模板。应用对生成题目还有统一约束：举一反三和试卷新题使用填空题或解答题，题目内容不含题号、分值和选择题选项。

知识点识别依据错题本的学段与学科，从对应知识点库选择标签。新接入服务时，建议分别验证文字录入、图片识别、举一反三和动画讲解。

## 网络与凭据

容器内的 `localhost` 指容器自身；AI 服务在其他主机或容器时，需要使用容器可访问的地址。需要代理时，可通过 `HTTP_PROXY` / `HTTPS_PROXY` 配置服务端网络。

API Key 保存在服务端配置中。备份 `config/` 时应妥善保存，反馈问题时只提供经过脱敏的配置、日志和错误信息。

实现入口：[配置读取](https://github.com/margrop/wrong-notebook/blob/main/src/lib/config.ts) · [提供商选择](https://github.com/margrop/wrong-notebook/blob/main/src/lib/ai/index.ts) · [提示词](https://github.com/margrop/wrong-notebook/blob/main/src/lib/ai/prompts.ts)。
