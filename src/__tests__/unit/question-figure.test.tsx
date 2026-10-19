import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuestionFigure } from '@/components/question-figure';
import { LanguageProvider } from '@/contexts/LanguageContext';

const render = (svg: string | null) => renderToStaticMarkup(<LanguageProvider><QuestionFigure svg={svg} /></LanguageProvider>);

describe('题目配图', () => {
    it('以 <img> 加载 SVG data URI，不把 SVG 直接插入页面', () => {
        const markup = render('<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>');
        expect(markup).toContain('<img');
        expect(markup).toContain('src="data:image/svg+xml;charset=utf-8,');
        expect(markup).not.toContain('<svg');
        expect(markup).toContain('alt="题目配图"');
    });

    it('没有配图时不渲染', () => {
        expect(render(null)).toBe('');
    });
});
