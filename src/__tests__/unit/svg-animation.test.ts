import { describe, expect, it } from 'vitest';
import { MAX_SVG_ANIMATION_LENGTH, sanitizeSvgAnimation } from '@/lib/svg-animation';
import { generateSvgAnimationPrompt } from '@/lib/ai/prompts';

const animation = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">'
    + '<rect width="800" height="500" fill="#fff"/>'
    + '<line x1="0" y1="0" x2="100" y2="100" stroke="#000"><animate attributeName="x2" from="0" to="100" dur="2s" fill="freeze"/></line>'
    + '<text x="20" y="480" opacity="0">第一步<set attributeName="opacity" to="1" begin="2s" fill="freeze"/></text>'
    + '<g><animateTransform attributeName="transform" type="rotate" from="0" to="90" dur="3s" fill="freeze"/></g>'
    + '</svg>';

describe('sanitizeSvgAnimation', () => {
    it('保留 SMIL 动画元素', () => {
        expect(sanitizeSvgAnimation(animation)).toBe(animation);
    });

    it('去掉脚本、事件属性和改写链接的动画', () => {
        const dirty = animation.replace('</svg>', ''
            + '<script>alert(1)</script>'
            + '<a><animate attributeName="href" to="https://evil.example" begin="1s"/><circle r="3" onclick="x()"/></a>'
            + '<set attributeName="xlink:href" to="#other"/>'
            + '</svg>');
        const clean = sanitizeSvgAnimation(dirty)!;

        expect(clean).not.toMatch(/script|onclick|evil\.example|attributeName="(xlink:)?href"/);
        expect(clean).toContain('<circle r="3"/>');
        expect(clean).toContain('<animate attributeName="x2"');
    });

    it('没有有效 SVG 或超长时返回 null', () => {
        expect(sanitizeSvgAnimation('无法生成')).toBeNull();
        expect(sanitizeSvgAnimation(null)).toBeNull();
        const long = animation.replace('</svg>', `<text>${'x'.repeat(MAX_SVG_ANIMATION_LENGTH)}</text></svg>`);
        expect(sanitizeSvgAnimation(long)).toBeNull();
    });

    it('长度在配图上限以上、动画上限以内时仍可保存', () => {
        const svg = animation.replace('</svg>', `<text>${'x'.repeat(150_000)}</text></svg>`);
        expect(sanitizeSvgAnimation(svg)).not.toBeNull();
    });
});

describe('generateSvgAnimationPrompt', () => {
    it('填入题目、答案、解析和配图，空字段显示占位', () => {
        const prompt = generateSvgAnimationPrompt('求面积', '', '底乘高', '<svg><rect/></svg>');
        expect(prompt).toContain('求面积');
        expect(prompt).toContain('底乘高');
        expect(prompt).toContain('（无）');
        expect(prompt).toContain('<svg><rect/></svg>');
        expect(prompt).toContain('<svg_animation>');
        expect(prompt).not.toMatch(/\{\{\w+\}\}/);
    });

    it('没有配图时不输出配图段落', () => {
        expect(generateSvgAnimationPrompt('求面积', '6', '解析')).not.toContain('题目配图');
    });
});
