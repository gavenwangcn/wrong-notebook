import { prisma } from "@/lib/prisma";

/**
 * 按学科名为用户找到错题本：先做包含匹配（如「数学」匹配「初二数学」），
 * 找不到时新建同名错题本。并发导入同一学科时用 upsert 避免重复创建。
 */
export async function resolveNotebookForSubject(userId: string, subjectName: string): Promise<{ id: string; name: string }> {
    const name = subjectName.trim();
    const notebooks = await prisma.subject.findMany({
        where: { userId },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
    });

    const matched = notebooks.find((notebook) => notebook.name === name)
        || notebooks.find((notebook) => notebook.name.includes(name) || name.includes(notebook.name));
    if (matched) {
        return matched;
    }

    try {
        return await prisma.subject.upsert({
            where: { name_userId: { name, userId } },
            update: {},
            create: { name, userId },
            select: { id: true, name: true },
        });
    } catch (error) {
        // 并发创建同名错题本时，另一请求已创建成功，直接读取
        if ((error as { code?: string })?.code === 'P2002') {
            return prisma.subject.findUniqueOrThrow({
                where: { name_userId: { name, userId } },
                select: { id: true, name: true },
            });
        }
        throw error;
    }
}
