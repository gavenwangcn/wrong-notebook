/** 按难度星级给出默认卷别：1～3 星为 A 卷，4～5 星为 B 卷；未评级时不分类。 */
export function getDefaultPaperLevel(difficultyStars: number | null | undefined): 'a' | 'b' | null {
    if (typeof difficultyStars !== 'number' || !Number.isInteger(difficultyStars)
        || difficultyStars < 1 || difficultyStars > 5) {
        return null;
    }
    return difficultyStars <= 3 ? 'a' : 'b';
}
