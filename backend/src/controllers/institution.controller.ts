import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { InstitutionInvitationRole, LectureType, TimetableVersionStatus, UserRole, Weekday } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const id = z.string().min(1);
const collegeAdmin = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, collegeId: true, academicCollege: true } });
  if (!user || user.role !== UserRole.COLLEGE_ADMIN || !user.collegeId || !user.academicCollege || user.academicCollege.status !== 'ACTIVE') {
    throw new AppError(403, 'COLLEGE_ADMIN_SCOPE_REQUIRED', 'An active institution assignment is required.');
  }
  return user;
};
const scopedDepartment = async (collegeId: string, departmentId: string) => {
  const value = await prisma.department.findFirst({ where: { id: departmentId, collegeId } });
  if (!value) throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found in your institution.');
  return value;
};
const scopedProgram = async (collegeId: string, programId: string) => {
  const value = await prisma.academicProgram.findFirst({ where: { id: programId, department: { collegeId } } });
  if (!value) throw new AppError(404, 'PROGRAM_NOT_FOUND', 'Program not found in your institution.');
  return value;
};
const scopedClass = async (collegeId: string, classSectionId: string) => {
  const value = await prisma.classSection.findFirst({ where: { id: classSectionId, program: { department: { collegeId } }, term: { collegeId } } });
  if (!value) throw new AppError(404, 'CLASS_NOT_FOUND', 'Class or section not found in your institution.');
  return value;
};

export const institutionOverview: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub);
  const collegeId = admin.collegeId!;
  const [departments, programs, academicYears, terms, classes, subjects, teachers, students, invitations] = await Promise.all([
    prisma.department.findMany({ where: { collegeId }, orderBy: { name: 'asc' } }),
    prisma.academicProgram.findMany({ where: { department: { collegeId } }, orderBy: { name: 'asc' }, include: { department: true } }),
    prisma.academicYear.findMany({ where: { collegeId }, orderBy: { startsAt: 'desc' } }),
    prisma.academicTerm.findMany({ where: { collegeId }, orderBy: { startsAt: 'desc' }, include: { academicYear: true } }),
    prisma.classSection.findMany({ where: { program: { department: { collegeId } }, term: { collegeId } }, orderBy: { name: 'asc' }, include: { program: true, term: true, _count: { select: { enrollments: { where: { status: 'ACTIVE' } }, teachingAssignments: true } } } }),
    prisma.subject.findMany({ where: { department: { collegeId }, archivedAt: null }, orderBy: { name: 'asc' }, include: { department: true } }),
    prisma.user.findMany({ where: { collegeId, role: 'TEACHER' }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true, departmentId: true } }),
    prisma.user.findMany({ where: { collegeId, role: 'STUDENT' }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true, departmentId: true, academicProgramId: true } }),
    prisma.institutionInvitation.findMany({ where: { collegeId }, orderBy: { createdAt: 'desc' }, select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true } })
  ]);
  res.json({ success: true, data: { college: admin.academicCollege, departments, programs, academicYears, terms, classes, subjects, teachers, students, invitations } });
});

const departmentSchema = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(1).max(20).transform(v => v.toUpperCase()).optional() });
export const createInstitutionDepartment: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = departmentSchema.parse(req.body);
  const result = await prisma.department.create({ data: { collegeId: admin.collegeId!, ...body } });
  res.status(201).json({ success: true, data: result });
});
const programSchema = z.object({ departmentId: id, name: z.string().trim().min(2).max(120), code: z.string().trim().min(1).max(20).transform(v => v.toUpperCase()).optional(), durationYears: z.number().int().min(1).max(10).optional() });
export const createInstitutionProgram: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = programSchema.parse(req.body); await scopedDepartment(admin.collegeId!, body.departmentId);
  const result = await prisma.academicProgram.create({ data: body }); res.status(201).json({ success: true, data: result });
});
const periodStatus = z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED']);
const academicYearBody = z.object({ name: z.string().trim().min(2).max(40), startsAt: z.coerce.date(), endsAt: z.coerce.date(), status: periodStatus.default('UPCOMING') });
const academicYearSchema = academicYearBody.refine(v => v.endsAt > v.startsAt, { message: 'End date must be after start date.' });
export const createInstitutionAcademicYear: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = academicYearSchema.parse(req.body); const collegeId = admin.collegeId!;
  if (await prisma.academicYear.findUnique({ where: { collegeId_name: { collegeId, name: body.name } } })) throw new AppError(409, 'ACADEMIC_YEAR_EXISTS', 'An academic year with this name already exists.');
  const result = await prisma.academicYear.create({ data: { collegeId, ...body } }); res.status(201).json({ success: true, data: result });
});
export const updateInstitutionAcademicYear: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const yearId = req.params.academicYearId as string; const body = academicYearBody.partial().refine(v => Object.keys(v).length > 0, 'At least one field is required.').parse(req.body);
  const current = await prisma.academicYear.findFirst({ where: { id: yearId, collegeId: admin.collegeId! } }); if (!current) throw new AppError(404, 'ACADEMIC_YEAR_NOT_FOUND', 'Academic year not found in your institution.');
  const startsAt = body.startsAt || current.startsAt, endsAt = body.endsAt || current.endsAt; if (endsAt <= startsAt) throw new AppError(400, 'INVALID_DATE_RANGE', 'End date must be after start date.');
  if (body.name && body.name !== current.name && await prisma.academicYear.findUnique({ where: { collegeId_name: { collegeId: admin.collegeId!, name: body.name } } })) throw new AppError(409, 'ACADEMIC_YEAR_EXISTS', 'An academic year with this name already exists.');
  const result = await prisma.academicYear.update({ where: { id: yearId }, data: body }); res.json({ success: true, data: result });
});
const termBody = z.object({ academicYearId: id, name: z.string().trim().min(2).max(80), code: z.string().trim().min(1).max(20).transform(v => v.toUpperCase()).optional(), startsAt: z.coerce.date(), endsAt: z.coerce.date(), status: periodStatus.default('UPCOMING') });
const termSchema = termBody.refine(v => v.endsAt > v.startsAt, { message: 'End date must be after start date.' });
export const createInstitutionTerm: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = termSchema.parse(req.body); const collegeId = admin.collegeId!;
  const year = await prisma.academicYear.findFirst({ where: { id: body.academicYearId, collegeId } }); if (!year) throw new AppError(404, 'ACADEMIC_YEAR_NOT_FOUND', 'Academic year not found in your institution.');
  if (body.startsAt < year.startsAt || body.endsAt > year.endsAt) throw new AppError(400, 'TERM_OUTSIDE_ACADEMIC_YEAR', 'Term dates must fall within the selected academic year.');
  if (await prisma.academicTerm.findFirst({ where: { academicYearId: year.id, OR: [{ name: body.name }, ...(body.code ? [{ code: body.code }] : [])] } })) throw new AppError(409, 'ACADEMIC_TERM_EXISTS', 'A term with this name or code already exists in that academic year.');
  const result = await prisma.academicTerm.create({ data: { collegeId, ...body, isActive: body.status === 'ACTIVE' } }); res.status(201).json({ success: true, data: result });
});
export const updateInstitutionTerm: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const termId = req.params.termId as string; const current = await prisma.academicTerm.findFirst({ where: { id: termId, collegeId: admin.collegeId! } }); if (!current) throw new AppError(404, 'TERM_NOT_FOUND', 'Academic term not found in your institution.');
  const body = termBody.partial().refine(v => Object.keys(v).length > 0, 'At least one field is required.').parse(req.body); const academicYearId = body.academicYearId || current.academicYearId; if (!academicYearId) throw new AppError(400, 'ACADEMIC_YEAR_REQUIRED', 'Select an academic year.');
  const year = await prisma.academicYear.findFirst({ where: { id: academicYearId, collegeId: admin.collegeId! } }); if (!year) throw new AppError(404, 'ACADEMIC_YEAR_NOT_FOUND', 'Academic year not found in your institution.');
  const startsAt = body.startsAt || current.startsAt, endsAt = body.endsAt || current.endsAt; if (endsAt <= startsAt) throw new AppError(400, 'INVALID_DATE_RANGE', 'End date must be after start date.'); if (startsAt < year.startsAt || endsAt > year.endsAt) throw new AppError(400, 'TERM_OUTSIDE_ACADEMIC_YEAR', 'Term dates must fall within the selected academic year.');
  const status = body.status || current.status; const result = await prisma.academicTerm.update({ where: { id: termId }, data: { ...body, academicYearId, isActive: status === 'ACTIVE' } }); res.json({ success: true, data: result });
});
const classSchema = z.object({ programId: id, termId: id, name: z.string().trim().min(1).max(80), yearLevel: z.number().int().min(1).max(10).optional(), semester: z.number().int().min(1).max(12).optional() });
export const createInstitutionClass: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = classSchema.parse(req.body); await scopedProgram(admin.collegeId!, body.programId);
  const term = await prisma.academicTerm.findFirst({ where: { id: body.termId, collegeId: admin.collegeId! } }); if (!term) throw new AppError(404, 'TERM_NOT_FOUND', 'Academic term not found in your institution.');
  const result = await prisma.classSection.create({ data: body }); res.status(201).json({ success: true, data: result });
});
const subjectSchema = z.object({ departmentId: id, name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(30).transform(v => v.toUpperCase()), description: z.string().trim().max(1000).optional(), credits: z.number().int().min(0).max(30).optional() });
export const createInstitutionSubject: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = subjectSchema.parse(req.body); await scopedDepartment(admin.collegeId!, body.departmentId);
  const result = await prisma.subject.create({ data: body }); res.status(201).json({ success: true, data: result });
});

const invitationSchema = z.object({ email: z.string().trim().email().transform(v => v.toLowerCase()), role: z.nativeEnum(InstitutionInvitationRole), departmentId: id.optional(), academicProgramId: id.optional(), classSectionId: id.optional() });
export const createInstitutionInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = invitationSchema.parse(req.body); const collegeId = admin.collegeId!;
  if (body.departmentId) await scopedDepartment(collegeId, body.departmentId);
  if (body.academicProgramId) await scopedProgram(collegeId, body.academicProgramId);
  if (body.classSectionId) await scopedClass(collegeId, body.classSectionId);
  if (body.role === 'TEACHER' && body.classSectionId) throw new AppError(400, 'INVALID_INVITATION_SCOPE', 'Teacher classes are assigned after onboarding.');
  const rawToken = crypto.randomBytes(32).toString('base64url'); const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitation = await prisma.institutionInvitation.create({ data: { ...body, collegeId, invitedById: admin.id, tokenHash, expiresAt } });
  res.status(201).json({ success: true, data: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt, inviteUrl: `${env.FRONTEND_URL}/institution-invite.html?token=${encodeURIComponent(rawToken)}` } });
});
const acceptSchema = z.object({ token: z.string().min(20) });
export const acceptInstitutionInvitation: RequestHandler = asyncHandler(async (req, res) => {
  const { token } = acceptSchema.parse(req.body); const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const invitation = await prisma.institutionInvitation.findUnique({ where: { tokenHash }, include: { college: true } });
  if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt <= new Date() || invitation.college.status !== 'ACTIVE') throw new AppError(410, 'INVITATION_UNAVAILABLE', 'This invitation is invalid or has expired.');
  const user = await prisma.user.findUnique({ where: { id: req.auth!.sub } }); if (!user || user.email.toLowerCase() !== invitation.email) throw new AppError(403, 'INVITATION_EMAIL_MISMATCH', 'Sign in with the email address that was invited.');
  const updated = await prisma.$transaction(async tx => {
    const account = await tx.user.update({ where: { id: user.id }, data: { role: invitation.role === 'TEACHER' ? 'TEACHER' : 'STUDENT', collegeId: invitation.collegeId, departmentId: invitation.departmentId, academicProgramId: invitation.academicProgramId }, select: { id: true, fullName: true, email: true, role: true, collegeId: true } });
    if (invitation.role === 'STUDENT' && invitation.classSectionId) await tx.studentEnrollment.upsert({ where: { studentId_classSectionId: { studentId: user.id, classSectionId: invitation.classSectionId } }, update: { status: 'ACTIVE', completedAt: null }, create: { studentId: user.id, classSectionId: invitation.classSectionId } });
    await tx.institutionInvitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } }); return account;
  });
  res.json({ success: true, data: { user: updated, college: invitation.college } });
});

const assignmentSchema = z.object({ teacherId: id, subjectId: id, classSectionId: id });
export const createInstitutionTeacherAssignment: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = assignmentSchema.parse(req.body); const collegeId = admin.collegeId!;
  const teacher = await prisma.user.findFirst({ where: { id: body.teacherId, collegeId, role: 'TEACHER' } }); if (!teacher) throw new AppError(404, 'TEACHER_NOT_FOUND', 'Teacher not found in your institution.');
  const subject = await prisma.subject.findFirst({ where: { id: body.subjectId, department: { collegeId }, archivedAt: null } }); if (!subject) throw new AppError(404, 'SUBJECT_NOT_FOUND', 'Subject not found in your institution.'); await scopedClass(collegeId, body.classSectionId);
  const result = await prisma.$transaction(async tx => { const assignment = await tx.teachingAssignment.upsert({ where: { teacherId_subjectId_classSectionId: body }, update: {}, create: body }); await tx.teacherClassAccess.upsert({ where: { teacherId_classSectionId: { teacherId: body.teacherId, classSectionId: body.classSectionId } }, update: { canManage: true }, create: { teacherId: body.teacherId, classSectionId: body.classSectionId } }); return assignment; });
  res.status(201).json({ success: true, data: result });
});

const enrollmentSchema = z.object({ studentId: id, classSectionId: id });
export const createInstitutionEnrollment: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = enrollmentSchema.parse(req.body); const collegeId = admin.collegeId!;
  const student = await prisma.user.findFirst({ where: { id: body.studentId, collegeId, role: 'STUDENT' } }); if (!student) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found in your institution.'); await scopedClass(collegeId, body.classSectionId);
  const result = await prisma.studentEnrollment.upsert({ where: { studentId_classSectionId: body }, update: { status: 'ACTIVE', completedAt: null }, create: body }); res.status(201).json({ success: true, data: result });
});

const importRowSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  rollNumber: z.string().trim().min(1).max(40)
});
const importSchema = z.object({ classSectionId: id, rows: z.array(z.unknown()).min(1).max(1000) });

async function inspectImport(collegeId: string, classSectionId: string, rawRows: unknown[]) {
  await scopedClass(collegeId, classSectionId);
  const emails = new Set<string>(), rolls = new Set<string>();
  const rows: Array<{ index: number; valid: boolean; reason: string; fullName?: string; email?: string; rollNumber?: string; raw?: unknown; accountStatus?: string }> = rawRows.map((raw, index) => {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) return { index, valid: false, reason: parsed.error.issues[0]?.message || 'Invalid row', raw };
    const value = parsed.data;
    if (emails.has(value.email)) return { index, valid: false, reason: 'Duplicate email in import', ...value };
    if (rolls.has(value.rollNumber.toLowerCase())) return { index, valid: false, reason: 'Duplicate roll number in import', ...value };
    emails.add(value.email); rolls.add(value.rollNumber.toLowerCase());
    return { index, valid: true, reason: '', ...value };
  });
  const valid = rows.filter((row): row is typeof row & { email: string; rollNumber: string; fullName: string } => row.valid && Boolean(row.email && row.rollNumber && row.fullName));
  const [users, enrolled, pending] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: valid.map(row => row.email) } }, select: { id: true, email: true, collegeId: true } }),
    prisma.studentEnrollment.findMany({ where: { classSectionId, OR: [{ rollNumber: { in: valid.map(row => row.rollNumber) } }, { student: { email: { in: valid.map(row => row.email) } } }] }, include: { student: { select: { email: true } } } }),
    prisma.pendingStudentEnrollment.findMany({ where: { classSectionId, status: 'PENDING', OR: [{ email: { in: valid.map(row => row.email) } }, { rollNumber: { in: valid.map(row => row.rollNumber) } }] } })
  ]);
  const userByEmail = new Map(users.map(user => [user.email.toLowerCase(), user]));
  for (const row of valid) {
    const user = userByEmail.get(row.email), existing = enrolled.find(item => item.student.email.toLowerCase() === row.email || item.rollNumber?.toLowerCase() === row.rollNumber.toLowerCase());
    const queued = pending.find(item => item.email === row.email || item.rollNumber?.toLowerCase() === row.rollNumber.toLowerCase());
    if (existing) { row.valid = false; row.reason = 'Already enrolled or roll number is in use'; }
    else if (queued) { row.valid = false; row.reason = 'Enrollment is already pending'; }
    else if (user?.collegeId && user.collegeId !== collegeId) { row.valid = false; row.reason = 'Account belongs to another institution'; }
    else Object.assign(row, { accountStatus: user ? 'EXISTING_ACCOUNT' : 'INVITATION_PENDING' });
  }
  const accepted = rows.filter(row => row.valid).length;
  return { rows, summary: { total: rows.length, valid: accepted, invalid: rows.length - accepted } };
}

export const previewStudentImport: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = importSchema.parse(req.body);
  res.json({ success: true, data: await inspectImport(admin.collegeId!, body.classSectionId, body.rows) });
});

export const commitStudentImport: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const body = importSchema.parse(req.body); const collegeId = admin.collegeId!;
  const preview = await inspectImport(collegeId, body.classSectionId, body.rows);
  const accepted = preview.rows.filter((row): row is typeof row & { valid: true; email: string; rollNumber: string; fullName: string } => row.valid && 'email' in row);
  if (!accepted.length) throw new AppError(400, 'NO_VALID_STUDENTS', 'There are no valid students to import.');
  const section = await prisma.classSection.findUniqueOrThrow({ where: { id: body.classSectionId }, include: { program: true } });
  const result = await prisma.$transaction(async tx => {
    let linked = 0, pending = 0;
    for (const row of accepted) {
      const user = await tx.user.findUnique({ where: { email: row.email } });
      if (user) {
        await tx.user.update({ where: { id: user.id }, data: { role: 'STUDENT', collegeId, departmentId: section.program.departmentId, academicProgramId: section.programId } });
        await tx.studentEnrollment.create({ data: { studentId: user.id, classSectionId: section.id, rollNumber: row.rollNumber } }); linked++;
      } else {
        await tx.pendingStudentEnrollment.create({ data: { collegeId, classSectionId: section.id, email: row.email, fullName: row.fullName, rollNumber: row.rollNumber, createdById: admin.id } }); pending++;
      }
    }
    return { imported: accepted.length, linked, pending };
  });
  res.status(201).json({ success: true, data: { ...result, skipped: preview.summary.invalid } });
});

export const institutionClassRoster: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const classSectionId = String(req.params.classSectionId); await scopedClass(admin.collegeId!, classSectionId);
  const [enrollments, pending] = await Promise.all([
    prisma.studentEnrollment.findMany({ where: { classSectionId, status: 'ACTIVE' }, orderBy: [{ rollNumber: 'asc' }, { student: { fullName: 'asc' } }], include: { student: { select: { id: true, fullName: true, email: true, avatar: true } } } }),
    prisma.pendingStudentEnrollment.findMany({ where: { classSectionId, status: 'PENDING' }, orderBy: [{ rollNumber: 'asc' }, { fullName: 'asc' }] })
  ]);
  res.json({ success: true, data: { enrollments, pending } });
});

export const withdrawInstitutionEnrollment: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const classSectionId = String(req.params.classSectionId); await scopedClass(admin.collegeId!, classSectionId);
  const enrollment = await prisma.studentEnrollment.findFirst({ where: { id: String(req.params.enrollmentId), classSectionId } });
  if (!enrollment) throw new AppError(404, 'ENROLLMENT_NOT_FOUND', 'Enrollment not found in this class.');
  await prisma.studentEnrollment.update({ where: { id: enrollment.id }, data: { status: 'WITHDRAWN', completedAt: new Date() } });
  res.status(204).send();
});

const assignmentsBody = z.object({ assignments: z.array(z.object({ subjectId: id, teacherId: id })).max(200) });
export const replaceClassTeacherAssignments: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const collegeId = admin.collegeId!, classSectionId = String(req.params.classSectionId); const body = assignmentsBody.parse(req.body);
  const section = await prisma.classSection.findFirst({ where: { id: classSectionId, program: { department: { collegeId } } }, include: { program: true } });
  if (!section) throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found in your institution.');
  const subjectIds = [...new Set(body.assignments.map(item => item.subjectId))], teacherIds = [...new Set(body.assignments.map(item => item.teacherId))];
  const [subjects, teachers] = await Promise.all([
    prisma.subject.findMany({ where: { id: { in: subjectIds }, departmentId: section.program.departmentId, archivedAt: null } }),
    prisma.user.findMany({ where: { id: { in: teacherIds }, collegeId, role: 'TEACHER' } })
  ]);
  if (subjects.length !== subjectIds.length) throw new AppError(403, 'SUBJECT_NOT_AUTHORIZED', 'One or more subjects are outside this class department.');
  if (teachers.length !== teacherIds.length) throw new AppError(403, 'TEACHER_NOT_AUTHORIZED', 'One or more teachers are outside your institution.');
  const saved = await prisma.$transaction(async tx => {
    const selected = new Set(body.assignments.map(item => `${item.subjectId}:${item.teacherId}`));
    const current = await tx.teachingAssignment.findMany({ where: { classSectionId } });
    for (const item of current) await tx.teachingAssignment.update({ where: { id: item.id }, data: { isActive: selected.has(`${item.subjectId}:${item.teacherId}`) } });
    for (const item of body.assignments) {
      await tx.teachingAssignment.upsert({ where: { teacherId_subjectId_classSectionId: { ...item, classSectionId } }, update: { isActive: true }, create: { ...item, classSectionId } });
      await tx.teacherClassAccess.upsert({ where: { teacherId_classSectionId: { teacherId: item.teacherId, classSectionId } }, update: { canManage: true }, create: { teacherId: item.teacherId, classSectionId } });
    }
    return tx.teachingAssignment.findMany({ where: { classSectionId, isActive: true }, include: { teacher: { select: { id: true, fullName: true, email: true } }, subject: true } });
  });
  res.json({ success: true, data: saved });
});

const slotBody = z.object({ teachingAssignmentId: id, day: z.nativeEnum(Weekday), startMinutes: z.number().int().min(0).max(1439), endMinutes: z.number().int().min(1).max(1440), room: z.string().trim().max(80).optional(), lectureType: z.nativeEnum(LectureType).default(LectureType.LECTURE) }).refine(value => value.endMinutes > value.startMinutes, { message: 'End time must be after start time.' });
async function draftVersion(classSectionId: string) {
  const existing = await prisma.timetableVersion.findUnique({ where: { classSectionId_status: { classSectionId, status: TimetableVersionStatus.DRAFT } } });
  if (existing) return existing;
  return prisma.$transaction(async tx => {
    const draft = await tx.timetableVersion.create({ data: { classSectionId, status: TimetableVersionStatus.DRAFT } });
    const published = await tx.timetableVersion.findUnique({ where: { classSectionId_status: { classSectionId, status: TimetableVersionStatus.PUBLISHED } }, include: { entries: true } });
    if (published?.entries.length) await tx.timetableEntry.createMany({ data: published.entries.map(entry => ({ timetableVersionId: draft.id, teachingAssignmentId: entry.teachingAssignmentId, day: entry.day, startMinutes: entry.startMinutes, endMinutes: entry.endMinutes, room: entry.room, lectureType: entry.lectureType, isActive: entry.isActive })) });
    return draft;
  });
}
async function timetableConflict(classSectionId: string, assignment: { id: string; teacherId: string }, body: z.infer<typeof slotBody>, excludeId?: string) {
  const overlaps = await prisma.timetableEntry.findMany({ where: { id: excludeId ? { not: excludeId } : undefined, isActive: true, day: body.day, startMinutes: { lt: body.endMinutes }, endMinutes: { gt: body.startMinutes }, timetableVersion: { status: { in: ['DRAFT', 'PUBLISHED'] } } }, include: { teachingAssignment: true, timetableVersion: true } });
  const conflict = overlaps.find(entry => {
    if (entry.timetableVersion?.classSectionId === classSectionId) return entry.timetableVersion.status === 'DRAFT';
    if (entry.teachingAssignment.teacherId === assignment.teacherId) return true;
    return Boolean(body.room && entry.room && body.room.toLowerCase() === entry.room.toLowerCase());
  });
  if (conflict) throw new AppError(409, 'TIMETABLE_CONFLICT', conflict.teachingAssignment.teacherId === assignment.teacherId ? 'The teacher is already scheduled at this time.' : body.room && conflict.room?.toLowerCase() === body.room.toLowerCase() ? 'The room is already booked at this time.' : 'This class already has a lecture at this time.');
}

export const institutionClassOperations: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub); const classSectionId = String(req.params.classSectionId); const section = await prisma.classSection.findFirst({ where: { id: classSectionId, program: { department: { collegeId: admin.collegeId! } } }, include: { program: { include: { department: true } }, term: { include: { academicYear: true } }, teachingAssignments: { where: { isActive: true }, include: { subject: true, teacher: { select: { id: true, fullName: true, email: true } } } } } });
  if (!section) throw new AppError(404, 'CLASS_NOT_FOUND', 'Class not found in your institution.');
  const [subjects, teachers, versions] = await Promise.all([
    prisma.subject.findMany({ where: { departmentId: section.program.departmentId, archivedAt: null }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { collegeId: admin.collegeId!, role: 'TEACHER' }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true } }),
    prisma.timetableVersion.findMany({ where: { classSectionId }, include: { entries: { where: { isActive: true }, include: { teachingAssignment: { include: { subject: true, teacher: { select: { id: true, fullName: true } }, classSection: true } } } } } })
  ]);
  res.json({ success: true, data: { section, subjects, teachers, versions } });
});

export const initializeInstitutionTimetableDraft: RequestHandler = asyncHandler(async (req, res) => { const admin = await collegeAdmin(req.auth!.sub); const classSectionId = String(req.params.classSectionId); await scopedClass(admin.collegeId!, classSectionId); res.status(201).json({ success: true, data: await draftVersion(classSectionId) }); });
export const createInstitutionTimetableEntry: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub), classSectionId = String(req.params.classSectionId), body = slotBody.parse(req.body); await scopedClass(admin.collegeId!, classSectionId);
  const assignment = await prisma.teachingAssignment.findFirst({ where: { id: body.teachingAssignmentId, classSectionId, isActive: true, teacher: { collegeId: admin.collegeId! } } }); if (!assignment) throw new AppError(403, 'ASSIGNMENT_NOT_AUTHORIZED', 'Select an active teacher assignment for this class.');
  const draft = await draftVersion(classSectionId); await timetableConflict(classSectionId, assignment, body);
  const entry = await prisma.timetableEntry.create({ data: { ...body, timetableVersionId: draft.id } }); res.status(201).json({ success: true, data: entry });
});
export const updateInstitutionTimetableEntry: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub), classSectionId = String(req.params.classSectionId), entryId = String(req.params.entryId), body = slotBody.parse(req.body); await scopedClass(admin.collegeId!, classSectionId);
  const entry = await prisma.timetableEntry.findFirst({ where: { id: entryId, timetableVersion: { classSectionId, status: 'DRAFT' } } }); if (!entry) throw new AppError(404, 'TIMETABLE_ENTRY_NOT_FOUND', 'Draft timetable entry not found.');
  const assignment = await prisma.teachingAssignment.findFirst({ where: { id: body.teachingAssignmentId, classSectionId, isActive: true, teacher: { collegeId: admin.collegeId! } } }); if (!assignment) throw new AppError(403, 'ASSIGNMENT_NOT_AUTHORIZED', 'Select an active teacher assignment for this class.'); await timetableConflict(classSectionId, assignment, body, entryId);
  res.json({ success: true, data: await prisma.timetableEntry.update({ where: { id: entryId }, data: body }) });
});
export const deleteInstitutionTimetableEntry: RequestHandler = asyncHandler(async (req, res) => { const admin = await collegeAdmin(req.auth!.sub), classSectionId = String(req.params.classSectionId), entryId = String(req.params.entryId); await scopedClass(admin.collegeId!, classSectionId); const result = await prisma.timetableEntry.deleteMany({ where: { id: entryId, timetableVersion: { classSectionId, status: 'DRAFT' } } }); if (!result.count) throw new AppError(404, 'TIMETABLE_ENTRY_NOT_FOUND', 'Draft timetable entry not found.'); res.status(204).send(); });
export const publishInstitutionTimetable: RequestHandler = asyncHandler(async (req, res) => {
  const admin = await collegeAdmin(req.auth!.sub), classSectionId = String(req.params.classSectionId); await scopedClass(admin.collegeId!, classSectionId);
  const draft = await prisma.timetableVersion.findUnique({ where: { classSectionId_status: { classSectionId, status: 'DRAFT' } }, include: { entries: { where: { isActive: true }, include: { teachingAssignment: true } } } }); if (!draft) throw new AppError(409, 'NO_TIMETABLE_DRAFT', 'Create the timetable draft before publishing.');
  for (const entry of draft.entries) await timetableConflict(classSectionId, entry.teachingAssignment, slotBody.parse(entry), entry.id);
  const published = await prisma.$transaction(async tx => {
    const old = await tx.timetableVersion.findUnique({ where: { classSectionId_status: { classSectionId, status: 'PUBLISHED' } } }); if (old) await tx.timetableVersion.delete({ where: { id: old.id } });
    const version = await tx.timetableVersion.create({ data: { classSectionId, status: 'PUBLISHED', publishedAt: new Date(), publishedById: admin.id } });
    if (draft.entries.length) await tx.timetableEntry.createMany({ data: draft.entries.map(entry => ({ timetableVersionId: version.id, teachingAssignmentId: entry.teachingAssignmentId, day: entry.day, startMinutes: entry.startMinutes, endMinutes: entry.endMinutes, room: entry.room, lectureType: entry.lectureType, isActive: true })) });
    return version;
  });
  res.json({ success: true, data: published });
});
