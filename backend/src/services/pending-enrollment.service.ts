import type { Prisma } from '@prisma/client';

export async function claimPendingEnrollments(tx: Prisma.TransactionClient, userId: string, email: string) {
  const pending = await tx.pendingStudentEnrollment.findMany({
    where: { email: email.trim().toLowerCase(), status: 'PENDING' },
    include: { classSection: { include: { program: { include: { department: true } } } }, college: true },
    orderBy: { createdAt: 'asc' }
  });
  if (!pending.length) return 0;
  const collegeIds = new Set(pending.map(item => item.collegeId));
  if (collegeIds.size !== 1) return 0;
  const scope = pending[0];
  const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { collegeId: true } });
  if (account.collegeId && account.collegeId !== scope.collegeId) return 0;
  await tx.user.update({ where: { id: userId }, data: {
    role: 'STUDENT', collegeId: scope.collegeId,
    departmentId: scope.classSection.program.departmentId,
    academicProgramId: scope.classSection.programId
  } });
  for (const item of pending) {
    await tx.studentEnrollment.upsert({
      where: { studentId_classSectionId: { studentId: userId, classSectionId: item.classSectionId } },
      update: { status: 'ACTIVE', completedAt: null, rollNumber: item.rollNumber },
      create: { studentId: userId, classSectionId: item.classSectionId, rollNumber: item.rollNumber }
    });
    await tx.pendingStudentEnrollment.update({ where: { id: item.id }, data: { status: 'LINKED', linkedUserId: userId, linkedAt: new Date() } });
  }
  return pending.length;
}
