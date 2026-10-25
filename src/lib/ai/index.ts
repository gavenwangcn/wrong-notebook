import { AIService } from "./types";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";
import { AzureOpenAIProvider } from "./azure-provider";
import { AnthropicProvider } from "./anthropic-provider";
import { MiniMaxCodeProvider } from "./minimax-code-provider";
import { isVendorProvider, resolveVendorConfig, VENDOR_PRESETS } from "./vendor-presets";

export * from "./types";

import { getAppConfig, getActiveOpenAIConfig } from "../config";
import { createLogger } from "../logger";

const logger = createLogger('ai');

export function getAIService(): AIService {
    // Always get fresh config
    const config = getAppConfig();
    const provider = config.aiProvider;

    if (provider === "openai") {
        const activeConfig = getActiveOpenAIConfig();
        logger.info({ activeInstance: activeConfig?.name }, 'Using OpenAI Provider');
        return new OpenAIProvider(activeConfig);
    } else if (provider === "azure") {
        logger.info({ deployment: config.azure?.deploymentName }, 'Using Azure OpenAI Provider');
        return new AzureOpenAIProvider(config.azure);
    } else if (provider === "anthropic") {
        logger.info({ model: config.anthropic?.model }, 'Using Anthropic Provider');
        return new AnthropicProvider(config.anthropic);
    } else if (provider === "minimax-code") {
        logger.info({ model: config.minimaxCode?.model }, 'Using MiniMax Code OAuth Provider');
        return new MiniMaxCodeProvider(config.minimaxCode);
    } else if (provider === "gemini") {
        logger.info('Using Gemini Provider');
        return new GeminiProvider(config.gemini);
    } else {
        // 国产大模型官方渠道；未知取值回退到默认的 MiniMax
        const vendor = isVendorProvider(provider) ? provider : 'minimax';
        const vendorConfig = resolveVendorConfig(vendor, config[vendor]);
        logger.info({ vendor: VENDOR_PRESETS[vendor].name, model: vendorConfig.model }, 'Using vendor provider (OpenAI compatible)');
        return new OpenAIProvider(vendorConfig);
    }
}

