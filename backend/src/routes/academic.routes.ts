import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  adminAcademicOverview,
  assignDevelopmentRole,
  studentAcademicOverview,
  teacherClass,
  teacherOverview,
  teacherClassStudents,
  submitAttendance,
  teacherAttendanceHistory,
  teacherAttendanceSession,
  updateAttendance,
  studentAttendanceSummary,
  studentSubjectAttendance
  ,teacherSubjects, teacherSetupOptions, createTeacherSubject, updateTeacherSubject, archiveTeacherSubject, teacherClasses, createTeacherClass, teacherClassDetails, assignTeacherSubject, teacherTimetable, createTimetableEntry, updateTimetableEntry, cancelTimetableEntry, studentTimetable
} from '../controllers/academic.controller.js';
import { authenticate, authorizeRoles } from '../middleware/authenticate.js';
import {
  acceptInstitutionInvitation, createInstitutionClass, createInstitutionDepartment,
  createInstitutionAcademicYear, updateInstitutionAcademicYear, updateInstitutionTerm,
  createInstitutionEnrollment, createInstitutionInvitation, createInstitutionProgram,
  createInstitutionSubject, createInstitutionTeacherAssignment, createInstitutionTerm,
  institutionOverview, previewStudentImport, commitStudentImport, institutionClassRoster,
  withdrawInstitutionEnrollment, replaceClassTeacherAssignments, institutionClassOperations,
  initializeInstitutionTimetableDraft, createInstitutionTimetableEntry,
  updateInstitutionTimetableEntry, deleteInstitutionTimetableEntry, publishInstitutionTimetable,
  updateInstitutionDepartment, deleteInstitutionDepartment, updateInstitutionProgram, deleteInstitutionProgram,
  deleteInstitutionAcademicYear, deleteInstitutionTerm, updateInstitutionClass, deleteInstitutionClass,
  updateInstitutionSubject, archiveInstitutionSubject, revokeInstitutionInvitation,
  removeInstitutionTeacherAssignment, institutionAttendanceSummary
} from '../controllers/institution.controller.js';

export const academicRouter = Router();

academicRouter.get('/me', authenticate, authorizeRoles(UserRole.STUDENT), studentAcademicOverview);
academicRouter.get('/teacher/overview', authenticate, authorizeRoles(UserRole.TEACHER), teacherOverview);
academicRouter.get('/teacher/classes/:classSectionId', authenticate, authorizeRoles(UserRole.TEACHER), teacherClass);
academicRouter.get('/teacher/assignments/:assignmentId/students', authenticate, authorizeRoles(UserRole.TEACHER), teacherClassStudents);
academicRouter.post('/teacher/attendance/sessions', authenticate, authorizeRoles(UserRole.TEACHER), submitAttendance);
academicRouter.get('/teacher/attendance/history', authenticate, authorizeRoles(UserRole.TEACHER), teacherAttendanceHistory);
academicRouter.get('/teacher/attendance/sessions/:sessionId', authenticate, authorizeRoles(UserRole.TEACHER), teacherAttendanceSession);
academicRouter.patch('/teacher/attendance/sessions/:sessionId', authenticate, authorizeRoles(UserRole.TEACHER), updateAttendance);
academicRouter.get('/attendance/summary', authenticate, authorizeRoles(UserRole.STUDENT), studentAttendanceSummary);
academicRouter.get('/attendance/subjects/:subjectId', authenticate, authorizeRoles(UserRole.STUDENT), studentSubjectAttendance);
academicRouter.get('/teacher/subjects', authenticate, authorizeRoles(UserRole.TEACHER), teacherSubjects);
academicRouter.get('/teacher/classes', authenticate, authorizeRoles(UserRole.TEACHER), teacherClasses);
academicRouter.get('/teacher/classes/:classSectionId/manage', authenticate, authorizeRoles(UserRole.TEACHER), teacherClassDetails);
academicRouter.get('/teacher/timetable', authenticate, authorizeRoles(UserRole.TEACHER), teacherTimetable);
academicRouter.get('/timetable', authenticate, authorizeRoles(UserRole.STUDENT), studentTimetable);
academicRouter.get('/admin/overview', authenticate, authorizeRoles(UserRole.ADMIN), adminAcademicOverview);
academicRouter.get('/institution/overview', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), institutionOverview);
academicRouter.post('/institution/departments', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionDepartment);
academicRouter.patch('/institution/departments/:departmentId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), updateInstitutionDepartment);
academicRouter.delete('/institution/departments/:departmentId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), deleteInstitutionDepartment);
academicRouter.post('/institution/programs', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionProgram);
academicRouter.patch('/institution/programs/:programId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), updateInstitutionProgram);
academicRouter.delete('/institution/programs/:programId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), deleteInstitutionProgram);
academicRouter.post('/institution/terms', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionTerm);
academicRouter.patch('/institution/terms/:termId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), updateInstitutionTerm);
academicRouter.delete('/institution/terms/:termId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), deleteInstitutionTerm);
academicRouter.post('/institution/academic-years', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionAcademicYear);
academicRouter.patch('/institution/academic-years/:academicYearId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), updateInstitutionAcademicYear);
academicRouter.delete('/institution/academic-years/:academicYearId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), deleteInstitutionAcademicYear);
academicRouter.post('/institution/classes', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionClass);
academicRouter.patch('/institution/classes/:classSectionId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), updateInstitutionClass);
academicRouter.delete('/institution/classes/:classSectionId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), deleteInstitutionClass);
academicRouter.post('/institution/subjects', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionSubject);
academicRouter.patch('/institution/subjects/:subjectId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), updateInstitutionSubject);
academicRouter.delete('/institution/subjects/:subjectId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), archiveInstitutionSubject);
academicRouter.post('/institution/invitations', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionInvitation);
academicRouter.delete('/institution/invitations/:invitationId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), revokeInstitutionInvitation);
academicRouter.post('/institution/teacher-assignments', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionTeacherAssignment);
academicRouter.delete('/institution/teacher-assignments/:assignmentId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), removeInstitutionTeacherAssignment);
academicRouter.post('/institution/enrollments', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionEnrollment);
academicRouter.post('/institution/student-import/preview', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), previewStudentImport);
academicRouter.post('/institution/student-import/commit', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), commitStudentImport);
academicRouter.get('/institution/classes/:classSectionId/roster', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), institutionClassRoster);
academicRouter.delete('/institution/classes/:classSectionId/enrollments/:enrollmentId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), withdrawInstitutionEnrollment);
academicRouter.get('/institution/classes/:classSectionId/operations', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), institutionClassOperations);
academicRouter.put('/institution/classes/:classSectionId/teacher-assignments', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), replaceClassTeacherAssignments);
academicRouter.post('/institution/classes/:classSectionId/timetable/draft', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), initializeInstitutionTimetableDraft);
academicRouter.post('/institution/classes/:classSectionId/timetable/entries', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), createInstitutionTimetableEntry);
academicRouter.patch('/institution/classes/:classSectionId/timetable/entries/:entryId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), updateInstitutionTimetableEntry);
academicRouter.delete('/institution/classes/:classSectionId/timetable/entries/:entryId', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), deleteInstitutionTimetableEntry);
academicRouter.post('/institution/classes/:classSectionId/timetable/publish', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), publishInstitutionTimetable);
academicRouter.get('/institution/attendance/summary', authenticate, authorizeRoles(UserRole.COLLEGE_ADMIN), institutionAttendanceSummary);
academicRouter.post('/institution/invitations/accept', authenticate, acceptInstitutionInvitation);
academicRouter.patch('/dev/users/:userId/role', authenticate, assignDevelopmentRole);
