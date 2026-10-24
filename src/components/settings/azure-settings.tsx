"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AppConfig } from "@/types/api";

type AzureConfig = NonNullable<AppConfig["azure"]>;

interface AzureSettingsProps {
    value?: AzureConfig;
    onChange: (value: AzureConfig) => void;
}

/** Azure OpenAI 的配置表单，端点、部署名和 API Key 必填 */
export function AzureSettings({ value, onChange }: AzureSettingsProps) {
    const { t } = useLanguage();
    const update = (key: keyof AzureConfig, next: string) => onChange({ ...value, [key]: next });
    const required = (field?: string) => !field?.trim() ? 'border-destructive' : '';

    return (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
                <Label>{t.settings?.ai?.azureEndpoint || "Azure Endpoint"} <span className="text-destructive">*</span></Label>
                <Input
                    value={value?.endpoint || ''}
                    onChange={(e) => update('endpoint', e.target.value)}
                    placeholder={t.settings?.ai?.azureEndpointPlaceholder || "https://your-resource.openai.azure.com"}
                    className={required(value?.endpoint)}
                />
            </div>
            <div className="space-y-2">
                <Label>{t.settings?.ai?.azureDeployment || "Deployment Name"} <span className="text-destructive">*</span></Label>
                <Input
                    value={value?.deploymentName || ''}
                    onChange={(e) => update('deploymentName', e.target.value)}
                    placeholder={t.settings?.ai?.azureDeploymentPlaceholder || "gpt-4o-deployment"}
                    className={required(value?.deploymentName)}
                />
            </div>
            <div className="space-y-2">
                <Label>API Key <span className="text-destructive">*</span></Label>
                <PasswordInput
                    value={value?.apiKey || ''}
                    onChange={(e) => update('apiKey', e.target.value)}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className={required(value?.apiKey)}
                />
            </div>
            <div className="space-y-2">
                <Label>{t.settings?.ai?.azureApiVersion || "API Version"}</Label>
                <Input
                    value={value?.apiVersion || ''}
                    onChange={(e) => update('apiVersion', e.target.value)}
                    placeholder={t.settings?.ai?.azureApiVersionPlaceholder || "2024-02-15-preview"}
                />
            </div>
            <div className="space-y-2">
                <Label>{t.settings?.ai?.azureModel || "Model Display Name"}</Label>
                <Input
                    value={value?.model || ''}
                    onChange={(e) => update('model', e.target.value)}
                    placeholder="gpt-4o"
                />
            </div>
        </div>
    );
}
