import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { InstitutionInvitationRole, UserRole } from '@prisma/client';
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
