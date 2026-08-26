import type { RequestHandler } from 'express';
import { AttendanceRecordStatus, LectureType, UserRole, Weekday } from '@prisma/client';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const roleAssignmentSchema = z.object({ body: z.object({ role: z.nativeEnum(UserRole) }) });
const attendanceRecordSchema = z.object({ studentId: z.string().min(1), status: z.nativeEnum(AttendanceRecordStatus) });
const attendanceSessionSchema = z.object({ body: z.object({
  teachingAssignmentId: z.string().min(1), clientRequestId: z.string().uuid(), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(), notes: z.string().trim().max(1000).optional(), records: z.array(attendanceRecordSchema).min(1)
}) });
const attendanceUpdateSchema = z.object({ body: z.object({ endsAt: z.coerce.date().nullable().optional(), notes: z.string().trim().max(1000).nullable().optional(), records: z.array(attendanceRecordSchema).min(1) }) });
const subjectSchema = z.object({ body: z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()), description: z.string().trim().max(1000).optional(), credits: z.number().int().min(0).max(30).optional() }) });
const subjectUpdateSchema = z.object({ body: subjectSchema.shape.body.partial().refine((body) => Object.keys(body).length > 0, 'At least one field is required.') });
const classSchema = z.object({ body: z.object({ termId: z.string().min(1), name: z.string().trim().min(1).max(80), yearLevel: z.number().int().min(1).max(10).optional(), semester: z.number().int().min(1).max(12).optional() }) });
const timetableBody = z.object({ teachingAssignmentId: z.string().min(1), day: z.nativeEnum(Weekday), startMinutes: z.number().int().min(0).max(1439), endMinutes: z.number().int().min(1).max(1440), room: z.string().trim().max(120).optional(), lectureType: z.nativeEnum(LectureType).default(LectureType.LECTURE) });
const timetableSchema = z.object({ body: timetableBody.refine((body) => body.endMinutes > body.startMinutes, { message: 'End time must be after start time.', path: ['endMinutes'] }) });
const timetableUpdateSchema = z.object({ body: timetableBody.partial().refine((body) => Object.keys(body).length > 0, 'At least one field is required.') });
const firstParam = (value: string | string[]) => Array.isArray(value) ? value[0] : value;

const classSectionInclude = {
  program: { include: { department: { include: { college: true } } } },
  term: true
} as const;

export const studentAcademicOverview: RequestHandler = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.sub },
    select: {
      id: true,
      role: true,
      academicCollege: true,
      academicDepartment: true,
      academicProgram: true,
      studentEnrollments: {
        where: { status: 'ACTIVE' },
        orderBy: { enrolledAt: 'desc' },
        include: {
          classSection: {
            include: {
              ...classSectionInclude,
              teachingAssignments: {
                where: { isActive: true, subject: { archivedAt: null } },
                include: {
                  subject: true,
                  teacher: { select: { id: true, fullName: true, avatar: true } }
                }
              }
            }
          }
        }
      }
    }
  });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
  res.json({ success: true, data: user });
});

export const teacherOverview: RequestHandler = asyncHandler(async (req, res) => {
  const assignments = await prisma.teachingAssignment.findMany({
    where: { teacherId: req.auth!.sub, isActive: true, subject: { archivedAt: null } },
    orderBy: { assignedAt: 'desc' },
    include: {
      subject: true,
      classSection: {
        include: {
          ...classSectionInclude,
          _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } }
        }
      }
    }
  });
  const classIds = new Set(assignments.map(({ classSectionId }) => classSectionId));
  const today = new Date(); today.setHours(0, 0, 0, 0); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const todaySessions = await prisma.attendanceSession.findMany({ where: { teachingAssignment: { teacherId: req.auth!.sub }, startsAt: { gte: today, lt: tomorrow }, status: 'SUBMITTED' }, include: { records: true } });
  res.json({
    success: true,
    data: {
      assignments,
      summary: { subjectCount: new Set(assignments.map(({ subjectId }) => subjectId)).size, classCount: classIds.size, attendanceTakenToday: todaySessions.length, studentsPresentToday: todaySessions.flatMap((session) => session.records).filter((record) => record.status === 'PRESENT').length, studentsAbsentToday: todaySessions.flatMap((session) => session.records).filter((record) => record.status === 'ABSENT').length }
    }
  });
});

const assignmentForTeacher = async (teacherId: string, assignmentId: string) => {
  const assignment = await prisma.teachingAssignment.findFirst({ where: { id: assignmentId, teacherId, isActive: true, subject: { archivedAt: null } }, include: { subject: true, classSection: { include: classSectionInclude } } });
  if (!assignment) throw new AppError(404, 'ASSIGNMENT_NOT_FOUND', 'This class and subject are not assigned to you.');
  return assignment;
};

const ensureRoster = async (classSectionId: string, records: Array<{ studentId: string }>) => {
  const ids = records.map(({ studentId }) => studentId);
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'DUPLICATE_STUDENT', 'Each student may appear only once in a submission.');
  const [enrolled, rosterSize] = await Promise.all([
    prisma.studentEnrollment.count({ where: { classSectionId, status: 'ACTIVE', studentId: { in: ids } } }),
    prisma.studentEnrollment.count({ where: { classSectionId, status: 'ACTIVE' } })
  ]);
  if (enrolled !== ids.length || rosterSize !== ids.length) throw new AppError(400, 'INVALID_ATTENDANCE_ROSTER', 'Attendance must contain each actively enrolled student exactly once.');
};

export const teacherClassStudents: RequestHandler = asyncHandler(async (req, res) => {
  const assignment = await assignmentForTeacher(req.auth!.sub, firstParam(req.params.assignmentId));
  const enrollments = await prisma.studentEnrollment.findMany({ where: { classSectionId: assignment.classSectionId, status: 'ACTIVE' }, orderBy: { student: { fullName: 'asc' } }, include: { student: { select: { id: true, fullName: true, email: true, avatar: true } } } });
  res.json({ success: true, data: { assignment, students: enrollments.map(({ student, rollNumber }) => ({ ...student, rollNumber })) } });
});

export const submitAttendance: RequestHandler = asyncHandler(async (req, res) => {
  const { body } = attendanceSessionSchema.parse({ body: req.body });
  const assignment = await assignmentForTeacher(req.auth!.sub, body.teachingAssignmentId);
  await ensureRoster(assignment.classSectionId, body.records);
  const session = await prisma.$transaction(async (tx) => {
    const existing = await tx.attendanceSession.findUnique({ where: { clientRequestId: body.clientRequestId }, include: { teachingAssignment: true } });
    if (existing && (existing.teachingAssignment.teacherId !== req.auth!.sub || existing.teachingAssignmentId !== body.teachingAssignmentId || existing.startsAt.getTime() !== body.startsAt.getTime())) throw new AppError(409, 'ATTENDANCE_REQUEST_CONFLICT', 'This attendance request does not match the existing session.');
    const saved = existing || await tx.attendanceSession.create({ data: { teachingAssignmentId: body.teachingAssignmentId, clientRequestId: body.clientRequestId, startsAt: body.startsAt, endsAt: body.endsAt, notes: body.notes, status: 'SUBMITTED' } });
    await Promise.all(body.records.map((record) => tx.attendanceRecord.upsert({ where: { attendanceSessionId_studentId: { attendanceSessionId: saved.id, studentId: record.studentId } }, update: { status: record.status }, create: { attendanceSessionId: saved.id, studentId: record.studentId, status: record.status } })));
    return tx.attendanceSession.findUniqueOrThrow({ where: { id: saved.id }, include: { records: true } });
  });
  res.status(201).json({ success: true, data: session });
});

export const teacherAttendanceHistory: RequestHandler = asyncHandler(async (req, res) => {
  const sessions = await prisma.attendanceSession.findMany({ where: { teachingAssignment: { teacherId: req.auth!.sub } }, orderBy: { startsAt: 'desc' }, include: { teachingAssignment: { include: { subject: true, classSection: true } }, records: true } });
  res.json({ success: true, data: sessions.map((session) => { const present = session.records.filter((record) => ['PRESENT', 'LATE'].includes(record.status)).length; const absent = session.records.filter((record) => record.status === 'ABSENT').length; return { ...session, present, absent, total: session.records.length, percentage: session.records.length ? Math.round((present / session.records.length) * 100) : 0, records: undefined }; }) });
});

export const teacherAttendanceSession: RequestHandler = asyncHandler(async (req, res) => {
  const session = await prisma.attendanceSession.findFirst({ where: { id: firstParam(req.params.sessionId), teachingAssignment: { teacherId: req.auth!.sub } }, include: { teachingAssignment: { include: { subject: true, classSection: { include: classSectionInclude } } }, records: { include: { student: { select: { id: true, fullName: true, avatar: true } } }, orderBy: { student: { fullName: 'asc' } } } } });
  if (!session) throw new AppError(404, 'ATTENDANCE_SESSION_NOT_FOUND', 'Attendance session not found.');
  res.json({ success: true, data: session });
});

export const updateAttendance: RequestHandler = asyncHandler(async (req, res) => {
  const sessionId = firstParam(req.params.sessionId); const { body } = attendanceUpdateSchema.parse({ body: req.body });
  const session = await prisma.attendanceSession.findFirst({ where: { id: sessionId, teachingAssignment: { teacherId: req.auth!.sub } }, include: { teachingAssignment: true } });
  if (!session) throw new AppError(404, 'ATTENDANCE_SESSION_NOT_FOUND', 'Attendance session not found.');
  await ensureRoster(session.teachingAssignment.classSectionId, body.records);
  const updated = await prisma.$transaction(async (tx) => { await tx.attendanceSession.update({ where: { id: sessionId }, data: { endsAt: body.endsAt, notes: body.notes, status: 'SUBMITTED' } }); await Promise.all(body.records.map((record) => tx.attendanceRecord.upsert({ where: { attendanceSessionId_studentId: { attendanceSessionId: sessionId, studentId: record.studentId } }, update: { status: record.status }, create: { attendanceSessionId: sessionId, studentId: record.studentId, status: record.status } }))); return tx.attendanceSession.findUniqueOrThrow({ where: { id: sessionId }, include: { records: true } }); });
  res.json({ success: true, data: updated });
});

const attendanceIndicator = (percentage: number) => percentage >= 75 ? 'GOOD' : percentage >= 65 ? 'WARNING' : 'CRITICAL';
export const studentAttendanceSummary: RequestHandler = asyncHandler(async (req, res) => {
  const records = await prisma.attendanceRecord.findMany({ where: { studentId: req.auth!.sub, attendanceSession: { status: 'SUBMITTED' } }, orderBy: { attendanceSession: { startsAt: 'desc' } }, include: { attendanceSession: { include: { teachingAssignment: { include: { subject: true, teacher: { select: { id: true, fullName: true } } } } } } } });
  const grouped = new Map<string, { subject: typeof records[number]['attendanceSession']['teachingAssignment']['subject']; teacher: { id: string; fullName: string }; present: number; absent: number; total: number }>();
  for (const record of records) { const { subject, teacher } = record.attendanceSession.teachingAssignment; const item = grouped.get(subject.id) || { subject, teacher, present: 0, absent: 0, total: 0 }; item.total += 1; if (['PRESENT', 'LATE'].includes(record.status)) item.present += 1; if (record.status === 'ABSENT') item.absent += 1; grouped.set(subject.id, item); }
  const subjects = [...grouped.values()].map((item) => { const percentage = item.total ? Math.round((item.present / item.total) * 100) : 0; return { ...item, percentage, indicator: attendanceIndicator(percentage) }; });
  const present = subjects.reduce((sum, item) => sum + item.present, 0); const total = subjects.reduce((sum, item) => sum + item.total, 0); const percentage = total ? Math.round((present / total) * 100) : 0;
  res.json({ success: true, data: { overall: { present, absent: subjects.reduce((sum, item) => sum + item.absent, 0), total, percentage, indicator: attendanceIndicator(percentage) }, subjects } });
});

export const studentSubjectAttendance: RequestHandler = asyncHandler(async (req, res) => {
  const subjectId = firstParam(req.params.subjectId); const records = await prisma.attendanceRecord.findMany({ where: { studentId: req.auth!.sub, attendanceSession: { status: 'SUBMITTED', teachingAssignment: { subjectId } } }, orderBy: { attendanceSession: { startsAt: 'desc' } }, include: { attendanceSession: { include: { teachingAssignment: { include: { subject: true, teacher: { select: { id: true, fullName: true } } } } } } } });
  if (!records.length) throw new AppError(404, 'ATTENDANCE_NOT_FOUND', 'No attendance records exist for this subject.');
  const present = records.filter((record) => ['PRESENT', 'LATE'].includes(record.status)).length; const absent = records.filter((record) => record.status === 'ABSENT').length; const percentage = Math.round((present / records.length) * 100);
  const assignment = records[0].attendanceSession.teachingAssignment;
  res.json({ success: true, data: { subject: assignment.subject, teacher: assignment.teacher, present, absent, total: records.length, percentage, indicator: attendanceIndicator(percentage), history: records.map((record) => ({ id: record.id, status: record.status, startsAt: record.attendanceSession.startsAt })) } });
});

const teacherScope = async (teacherId: string) => {
  const user = await prisma.user.findUnique({ where: { id: teacherId }, select: { departmentId: true, academicProgramId: true } });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Teacher not found.');
  return user;
};
const managedClass = async (teacherId: string, classSectionId: string) => {
  const section = await prisma.classSection.findFirst({ where: { id: classSectionId, OR: [{ teacherAccess: { some: { teacherId, canManage: true } } }, { teachingAssignments: { some: { teacherId } } }] }, include: { ...classSectionInclude, enrollments: { where: { status: 'ACTIVE' }, include: { student: { select: { id: true, fullName: true, avatar: true } } } }, teachingAssignments: { where: { teacherId }, include: { subject: true, timetableEntries: { where: { isActive: true } } } } } });
  if (!section) throw new AppError(404, 'CLASS_NOT_AUTHORIZED', 'This class is not within your teaching scope.'); return section;
};
const managedSubject = async (teacherId: string, subjectId: string) => {
  const subject = await prisma.subject.findFirst({ where: { id: subjectId, OR: [{ createdByTeacherId: teacherId }, { teachingAssignments: { some: { teacherId } } }] } });
  if (!subject) throw new AppError(404, 'SUBJECT_NOT_AUTHORIZED', 'This subject is not within your teaching scope.'); return subject;
};

export const teacherSubjects: RequestHandler = asyncHandler(async (req, res) => { const subjects = await prisma.subject.findMany({ where: { archivedAt: null, teachingAssignments: { some: { teacherId: req.auth!.sub, isActive: true } } }, orderBy: { name: 'asc' }, include: { department: true, teachingAssignments: { where: { teacherId: req.auth!.sub, isActive: true }, include: { classSection: { include: { program: true, term: true } } } } } }); res.json({ success: true, data: subjects }); });
export const teacherSetupOptions: RequestHandler = asyncHandler(async (req, res) => { const scope = await teacherScope(req.auth!.sub); const terms = scope.academicProgramId ? await prisma.academicTerm.findMany({ where: { college: { departments: { some: { programs: { some: { id: scope.academicProgramId } } } } } }, orderBy: { startsAt: 'desc' } }) : []; res.json({ success: true, data: { scope, terms } }); });
export const createTeacherSubject: RequestHandler = asyncHandler(async (req, res) => { const { body } = subjectSchema.parse({ body: req.body }); const scope = await teacherScope(req.auth!.sub); if (!scope.departmentId) throw new AppError(409, 'ACADEMIC_SCOPE_REQUIRED', 'Your teacher profile must be linked to a department before creating subjects.'); const subject = await prisma.subject.create({ data: { ...body, departmentId: scope.departmentId, createdByTeacherId: req.auth!.sub } }); res.status(201).json({ success: true, data: subject }); });
export const updateTeacherSubject: RequestHandler = asyncHandler(async (req, res) => { const id = firstParam(req.params.subjectId); await managedSubject(req.auth!.sub, id); const { body } = subjectUpdateSchema.parse({ body: req.body }); const subject = await prisma.subject.update({ where: { id }, data: body }); res.json({ success: true, data: subject }); });
export const archiveTeacherSubject: RequestHandler = asyncHandler(async (req, res) => { const id = firstParam(req.params.subjectId); await managedSubject(req.auth!.sub, id); const activeSessions = await prisma.attendanceSession.count({ where: { teachingAssignment: { subjectId: id } } }); const subject = await prisma.subject.update({ where: { id }, data: { archivedAt: new Date() } }); res.json({ success: true, data: { ...subject, preservedAttendanceSessions: activeSessions } }); });

export const teacherClasses: RequestHandler = asyncHandler(async (req, res) => { const classes = await prisma.classSection.findMany({ where: { OR: [{ teacherAccess: { some: { teacherId: req.auth!.sub } } }, { teachingAssignments: { some: { teacherId: req.auth!.sub, isActive: true } } }] }, orderBy: { name: 'asc' }, include: { ...classSectionInclude, _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } }, teachingAssignments: { where: { teacherId: req.auth!.sub, isActive: true }, include: { subject: true } } } }); res.json({ success: true, data: classes }); });
export const createTeacherClass: RequestHandler = asyncHandler(async (req, res) => { const { body } = classSchema.parse({ body: req.body }); const scope = await teacherScope(req.auth!.sub); if (!scope.academicProgramId) throw new AppError(409, 'ACADEMIC_SCOPE_REQUIRED', 'Your teacher profile must be linked to an academic program before creating classes.'); const term = await prisma.academicTerm.findFirst({ where: { id: body.termId, college: { departments: { some: { programs: { some: { id: scope.academicProgramId } } } } } } }); if (!term) throw new AppError(404, 'TERM_NOT_AUTHORIZED', 'The selected term is outside your academic program.'); const section = await prisma.$transaction(async (tx) => { const created = await tx.classSection.create({ data: { ...body, programId: scope.academicProgramId!, createdByTeacherId: req.auth!.sub } }); await tx.teacherClassAccess.create({ data: { teacherId: req.auth!.sub, classSectionId: created.id } }); return created; }); res.status(201).json({ success: true, data: section }); });
export const teacherClassDetails: RequestHandler = asyncHandler(async (req, res) => { res.json({ success: true, data: await managedClass(req.auth!.sub, firstParam(req.params.classSectionId)) }); });
export const assignTeacherSubject: RequestHandler = asyncHandler(async (req, res) => { const classSectionId = firstParam(req.params.classSectionId), subjectId = firstParam(req.params.subjectId); await managedClass(req.auth!.sub, classSectionId); const subject = await managedSubject(req.auth!.sub, subjectId); if (subject.archivedAt) throw new AppError(409, 'SUBJECT_ARCHIVED', 'Archived subjects cannot be assigned.'); const assignment = await prisma.teachingAssignment.upsert({ where: { teacherId_subjectId_classSectionId: { teacherId: req.auth!.sub, subjectId, classSectionId } }, update: {}, create: { teacherId: req.auth!.sub, subjectId, classSectionId } }); res.status(201).json({ success: true, data: assignment }); });

const ensureNoTimetableConflict = async (teacherId: string, assignment: { id: string; classSectionId: string }, day: Weekday, startMinutes: number, endMinutes: number, excludeId?: string) => { const conflict = await prisma.timetableEntry.findFirst({ where: { id: excludeId ? { not: excludeId } : undefined, isActive: true, day, startMinutes: { lt: endMinutes }, endMinutes: { gt: startMinutes }, OR: [{ teachingAssignment: { teacherId } }, { teachingAssignment: { classSectionId: assignment.classSectionId } }] }, include: { teachingAssignment: { include: { subject: true, classSection: true } } } }); if (conflict) throw new AppError(409, 'TIMETABLE_CONFLICT', `Schedule conflict with ${conflict.teachingAssignment.subject.code} for ${conflict.teachingAssignment.classSection.name}.`); };
export const teacherTimetable: RequestHandler = asyncHandler(async (req, res) => { const entries = await prisma.timetableEntry.findMany({ where: { isActive: true, timetableVersion: { status: 'PUBLISHED' }, teachingAssignment: { teacherId: req.auth!.sub, isActive: true } }, orderBy: [{ day: 'asc' }, { startMinutes: 'asc' }], include: { teachingAssignment: { include: { subject: true, classSection: true } } } }); res.json({ success: true, data: entries }); });
export const createTimetableEntry: RequestHandler = asyncHandler(async (req, res) => { const { body } = timetableSchema.parse({ body: req.body }); const assignment = await assignmentForTeacher(req.auth!.sub, body.teachingAssignmentId); await ensureNoTimetableConflict(req.auth!.sub, assignment, body.day, body.startMinutes, body.endMinutes); const entry = await prisma.timetableEntry.create({ data: body }); res.status(201).json({ success: true, data: entry }); });
export const updateTimetableEntry: RequestHandler = asyncHandler(async (req, res) => { const id = firstParam(req.params.entryId); const existing = await prisma.timetableEntry.findFirst({ where: { id, teachingAssignment: { teacherId: req.auth!.sub } }, include: { teachingAssignment: true } }); if (!existing) throw new AppError(404, 'TIMETABLE_ENTRY_NOT_FOUND', 'Timetable entry not found.'); const { body } = timetableUpdateSchema.parse({ body: req.body }); const assignment = body.teachingAssignmentId ? await assignmentForTeacher(req.auth!.sub, body.teachingAssignmentId) : existing.teachingAssignment; const day = body.day || existing.day, startMinutes = body.startMinutes ?? existing.startMinutes, endMinutes = body.endMinutes ?? existing.endMinutes; if (endMinutes <= startMinutes) throw new AppError(400, 'INVALID_TIME_RANGE', 'End time must be after start time.'); await ensureNoTimetableConflict(req.auth!.sub, assignment, day, startMinutes, endMinutes, id); const entry = await prisma.timetableEntry.update({ where: { id }, data: body }); res.json({ success: true, data: entry }); });
export const cancelTimetableEntry: RequestHandler = asyncHandler(async (req, res) => { const id = firstParam(req.params.entryId); const existing = await prisma.timetableEntry.findFirst({ where: { id, teachingAssignment: { teacherId: req.auth!.sub } } }); if (!existing) throw new AppError(404, 'TIMETABLE_ENTRY_NOT_FOUND', 'Timetable entry not found.'); await prisma.timetableEntry.update({ where: { id }, data: { isActive: false } }); res.status(204).send(); });
export const studentTimetable: RequestHandler = asyncHandler(async (req, res) => { const entries = await prisma.timetableEntry.findMany({ where: { isActive: true, timetableVersion: { status: 'PUBLISHED' }, teachingAssignment: { isActive: true, classSection: { enrollments: { some: { studentId: req.auth!.sub, status: 'ACTIVE' } } }, subject: { archivedAt: null } } }, orderBy: [{ day: 'asc' }, { startMinutes: 'asc' }], include: { teachingAssignment: { include: { subject: true, classSection: true, teacher: { select: { id: true, fullName: true } } } } } }); res.json({ success: true, data: entries }); });

export const teacherClass: RequestHandler = asyncHandler(async (req, res) => {
  const assignment = await prisma.teachingAssignment.findFirst({
    where: { teacherId: req.auth!.sub, classSectionId: firstParam(req.params.classSectionId), isActive: true },
    include: {
      subject: true,
      classSection: {
        include: {
          ...classSectionInclude,
          enrollments: {
            where: { status: 'ACTIVE' },
            orderBy: { student: { fullName: 'asc' } },
            include: { student: { select: { id: true, fullName: true, avatar: true } } }
          }
        }
      }
    }
  });
  if (!assignment) throw new AppError(404, 'CLASS_NOT_ASSIGNED', 'This class is not assigned to you.');
  res.json({ success: true, data: assignment });
});

export const adminAcademicOverview: RequestHandler = asyncHandler(async (_req, res) => {
  const [colleges, departments, programs, classSections, subjects, teachers, students] = await Promise.all([
    prisma.college.count(), prisma.department.count(), prisma.academicProgram.count(), prisma.classSection.count(),
    prisma.subject.count(), prisma.user.count({ where: { role: 'TEACHER' } }), prisma.user.count({ where: { role: 'STUDENT' } })
  ]);
  res.json({ success: true, data: { colleges, departments, programs, classSections, subjects, teachers, students } });
});

export const assignDevelopmentRole: RequestHandler = asyncHandler(async (req, res) => {
  if (env.NODE_ENV === 'production' || !env.DEV_ROLE_ASSIGNMENT_KEY) throw new AppError(404, 'NOT_FOUND', 'Route not found.');
  if (req.headers['x-dev-role-key'] !== env.DEV_ROLE_ASSIGNMENT_KEY) throw new AppError(403, 'ROLE_ASSIGNMENT_FORBIDDEN', 'The development role-assignment key is invalid.');
  const { body } = roleAssignmentSchema.parse({ body: req.body });
  if (body.role === UserRole.COLLEGE_ADMIN) throw new AppError(400, 'USE_SCOPED_ADMIN_ASSIGNMENT', 'College administrators must be assigned with an institution scope.');
  const user = await prisma.user.update({ where: { id: firstParam(req.params.userId) }, data: { role: body.role }, select: { id: true, fullName: true, role: true } });
  res.json({ success: true, data: user });
});
