/**
 * 题目的 SVG 动画讲解（AI 生成）。前后端共用，不要引入服务端模块。
 *
 * 净化规则与题目配图相同（见 figure-svg.ts），保留 SMIL 动画元素和 CSS 动画；
 * 显示时同样通过 <img> 加载，浏览器不会执行其中的脚本。
 */
import { sanitizeFigureSvg } from './figure-svg';

/** 单个动画讲解的最大长度（字符） */
export const MAX_SVG_ANIMATION_LENGTH = 200_000;

// 改写链接属性的动画（<animate attributeName="href" …>、<set attributeName="xlink:href" …>）
const HREF_ANIMATIONS = /<(animate|set)\b[^>]*attributeName\s*=\s*["']?(?:xlink:)?href["']?[^>]*?(\/>|>[\s\S]*?<\/\1\s*>)/gi;

/**
 * 从 AI 回复中取出动画 SVG 并净化；没有有效 SVG 或超长时返回 null
 */
export function sanitizeSvgAnimation(raw: unknown): string | null {
    const svg = sanitizeFigureSvg(raw, MAX_SVG_ANIMATION_LENGTH);
    return svg ? svg.replace(HREF_ANIMATIONS, '') : null;
}
