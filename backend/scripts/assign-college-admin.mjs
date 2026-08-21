import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.argv[2]?.trim().toLowerCase();
const slug = process.argv[3]?.trim() || 'wit-solapur';

if (!email) {
  console.error('Usage: npm run admin:assign-college-admin -- <existing-user-email> [college-slug]');
  process.exitCode = 1;
} else {
  try {
    const [user, college] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true, email: true } }),
      prisma.college.findUnique({ where: { slug }, select: { id: true, name: true, status: true } })
    ]);
    if (!user) throw new Error('No existing CampusSphere account matches that email.');
    if (!college || college.status !== 'ACTIVE') throw new Error('The requested institution is missing or inactive.');
    await prisma.user.update({ where: { id: user.id }, data: { role: 'COLLEGE_ADMIN', collegeId: college.id } });
    console.log(`Assigned existing account ${user.email} as COLLEGE_ADMIN for ${college.name} (${college.id}).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Assignment failed.');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
