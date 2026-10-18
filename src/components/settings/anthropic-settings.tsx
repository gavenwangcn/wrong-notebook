"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelSelector } from "@/components/ui/model-selector";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AppConfig } from "@/types/api";

type AnthropicConfig = NonNullable<AppConfig["anthropic"]>;

interface AnthropicSettingsProps {
    value?: AnthropicConfig;
    onChange: (value: AnthropicConfig) => void;
}

/** Anthropic 及兼容接口的配置表单 */
export function AnthropicSettings({ value, onChange }: AnthropicSettingsProps) {
    const { t } = useLanguage();
    const [showApiKey, setShowApiKey] = useState(false);
    const update = (key: keyof AnthropicConfig, next: string) => onChange({ ...value, [key]: next });

    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                    <Input
                        type={showApiKey ? "text" : "password"}
                        value={value?.apiKey || ""}
                        onChange={(e) => update("apiKey", e.target.value)}
                        placeholder="sk-ant-..."
                        className="pr-10"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowApiKey(!showApiKey)}
                        aria-label={showApiKey ? "Hide API Key" : "Show API Key"}
                    >
                        {showApiKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                </div>
            </div>
            <div className="space-y-2">
                <Label>Base URL (Optional)</Label>
                <Input
                    value={value?.baseUrl || ""}
                    onChange={(e) => update("baseUrl", e.target.value)}
                    placeholder="https://api.anthropic.com"
                />
                <p className="text-xs text-muted-foreground">{t.settings?.ai?.anthropicBaseUrlHint}</p>
            </div>
            <ModelSelector
                provider="anthropic"
                apiKey={value?.apiKey}
                baseUrl={value?.baseUrl}
                currentModel={value?.model}
                onModelChange={(model) => update("model", model)}
            />
        </div>
    );
}
