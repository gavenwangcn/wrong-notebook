# AI Configuration

Admins can change the AI configuration in the web settings. Once saved, later requests read the new configuration without restarting the service. The configuration is written to `config/app-config.json`, and saved fields take precedence over environment variables.

## Steps

1. Sign in as an admin and open "Settings → AI Provider".
2. Choose a provider and fill in the API key, endpoint, and model or deployment name.
3. Test the connection; fetch the model list from the API if needed.
4. Save, then check image input, output format and answer quality with a real question.

AI settings, connection tests, model lists and prompt settings are admin-only. The OpenAI configuration supports up to 10 instances; the currently active instance decides which configuration is used.

## Provider parameters

| Provider | Required | Endpoint and default model |
| --- | --- | --- |
| MiniMax | API key | Defaults to `https://api.minimax.cn/v1`; code default `MiniMax-M3.1-Flash` |
| Zhipu GLM | API key | Defaults to `https://open.bigmodel.cn/api/paas/v4`; code default `glm-5.3-flash` |
| DeepSeek | API key | Defaults to `https://api.deepseek.com`; code default `deepseek-flash` |
| Kimi | API key | Defaults to `https://api.moonshot.cn/v1`; code default `kimi-k3` |
| Anthropic or compatible | API key, model | Defaults to `https://api.anthropic.com`; code default `claude-sonnet-5-5` |
| Azure OpenAI | API key, endpoint, deployment name | API version defaults to `2024-02-15-preview`; the model field is for display |
| OpenAI or compatible | API key, model | Defaults to `https://api.openai.com/v1`; code default `gpt-6.1-sol` |
| Gemini | API key, an available model | Official API; code default `gemini-2.5-flash` |

The default names come from the current code and do not mean these models are enabled for your account. Model availability, billing and capabilities are determined by the provider.

For OpenAI-compatible services, the base URL should include the API path they require. For Anthropic-compatible services, the base URL excludes `/v1`; the app appends `/v1/messages`. The official MiniMax, GLM, DeepSeek and Kimi channels are called through the OpenAI-compatible API; leaving the endpoint and model empty uses the official defaults. Fill in the international endpoint if you use an international site.

## Environment variables

`AI_PROVIDER` selects the provider. It defaults to `minimax` and accepts `minimax`, `glm`, `deepseek`, `kimi`, `anthropic`, `azure`, `openai` and `gemini`.

| Provider | Variables |
| --- | --- |
| MiniMax | `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL` |
| Zhipu GLM | `GLM_API_KEY`, `GLM_BASE_URL`, `GLM_MODEL` |
| DeepSeek | `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL` |
| Kimi | `KIMI_API_KEY`, `KIMI_BASE_URL`, `KIMI_MODEL` |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` |
| Azure | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`, `AZURE_OPENAI_MODEL` |
| OpenAI | `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` |
| Gemini | `GOOGLE_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODEL` |

If a configuration has already been saved in the web UI, changing only the environment variables may not change what is actually used; check the selected provider and active instance in the web UI first. The global AI analysis timeout can be adjusted in the admin "Settings → General"; the code default is 180 seconds.

## Model capabilities

| Capability | Features |
| --- | --- |
| Image input | Photo recognition, redrawing figures from the original image, re-solving when an image is available |
| Math reasoning and clean LaTeX | Answers, analysis, mistake causes and difficulty rating |
| Returning content in the specified tags or JSON | Parsing of all AI results |
| Emitting SVG code | Static figures and SVG animated explanations |
| Long enough output | Recognition results with figures and step-by-step animations |

SVG figures and animations are generated as code by the language model; no image-generation API is called. Animations often need long output. When the output is truncated, the app retries with a higher output limit; the model itself must also support that length.

## Prompts and generation rules

Admins can customize the recognition and similar-question templates on the "Prompts" tab. The app also applies common rules to generated questions: similar questions and exam questions are fill-in-the-blank or free-response, and the question text contains no question number, score or multiple-choice options.

Knowledge points are chosen from the tag library matching the notebook's school stage and subject. When adding a new provider, verify text input, image recognition, similar questions and animated explanations separately.

## Network and credentials

`localhost` inside a container refers to the container itself. When the AI service runs on another host or container, use an address reachable from the container. If a proxy is needed, configure the server network with `HTTP_PROXY` / `HTTPS_PROXY`.

API keys are stored in the server configuration. Keep backups of `config/` safe, and only share redacted configuration, logs and error messages when reporting problems.

Code entry points: [configuration](https://github.com/margrop/wrong-notebook/blob/main/src/lib/config.ts) · [provider selection](https://github.com/margrop/wrong-notebook/blob/main/src/lib/ai/index.ts) · [prompts](https://github.com/margrop/wrong-notebook/blob/main/src/lib/ai/prompts.ts).
