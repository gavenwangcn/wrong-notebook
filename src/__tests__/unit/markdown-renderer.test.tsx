import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '@/components/markdown-renderer';

describe('旧题缺少答案或解析时的详情渲染', () => {
    it.each([null, undefined, ''])('内容为 %s 时能正常显示空区域', (content) => {
        expect(() => renderToStaticMarkup(<MarkdownRenderer content={content} />)).not.toThrow();
    });
});
