import './current-user.js?v=academic-foundation-1';
import { api, escapeHtml, requireRole } from './frontend-api.js?v=academic-foundation-1';

const teacher = await requireRole('TEACHER');
if (teacher) {
  const attendanceLink = document.querySelector('a[href="#attendance"]'); if (attendanceLink) attendanceLink.href = 'teacher-attendance.html';
  const classesLink = document.querySelector('a[href="#classes"]'); if (classesLink) classesLink.href = 'teacher-management.html#classes';
  const subjectsLink = document.querySelector('a[href="#subjects"]'); if (subjectsLink) { subjectsLink.href = 'teacher-management.html#subjects'; subjectsLink.insertAdjacentHTML('afterend', '<a href="teacher-management.html#timetable">Timetable</a>'); }
  document.querySelector('[data-teacher-name]').textContent = teacher.fullName;
  document.querySelector('#teacher-greeting').textContent = `Welcome back, ${teacher.fullName.split(' ')[0]}.`;
  const overview = await api('/academic/teacher/overview');
  document.querySelector('#teacher-class-count').textContent = String(overview.summary.classCount);
  document.querySelector('#teacher-subject-count').textContent = String(overview.summary.subjectCount);
  const summaryValues = document.querySelectorAll('.summary-card strong'); if (summaryValues[2]) summaryValues[2].textContent = String(overview.summary.attendanceTakenToday);
  const assignmentMarkup = overview.assignments.length ? `<div class="assignment-list">${overview.assignments.map(({ subject, classSection }) => `<article class="assignment"><b>${escapeHtml(subject.code)} · ${escapeHtml(subject.name)}</b><small>${escapeHtml(classSection.name)} · ${escapeHtml(classSection.program.name)} · ${classSection._count.enrollments} students</small></article>`).join('')}</div>` : '<div class="empty-state"><b>No classes assigned today</b><p>Your real class and subject assignments will appear after academic setup by an administrator.</p></div>';
  document.querySelector('#teacher-assignments').innerHTML = assignmentMarkup;
  const uniqueSubjects = [...new Map(overview.assignments.map((assignment) => [assignment.subject.id, assignment.subject])).values()];
  document.querySelector('#teacher-subjects').innerHTML = uniqueSubjects.length ? `<div class="assignment-list">${uniqueSubjects.map((subject) => `<article class="assignment"><b>${escapeHtml(subject.code)}</b><small>${escapeHtml(subject.name)}</small></article>`).join('')}</div>` : '<div class="empty-state"><b>No subjects assigned</b><p>Assigned subjects will appear here.</p></div>';
  document.querySelector('.mobile-academic-menu').addEventListener('click', () => document.querySelector('.academic-sidebar').classList.toggle('open'));
}
