import './current-user.js?v=wit-admin-1';
import { api, escapeHtml, requireRole } from './frontend-api.js?v=wit-admin-1';

const admin = await requireRole('COLLEGE_ADMIN');
let state;
let importRows = [], classOperations = null;
const $ = (selector) => document.querySelector(selector);
const notice = (message, error = false) => { const area = $('#notice'); area.textContent = message; area.classList.toggle('error', error); area.hidden = false; };
const row = (title, detail = '') => `<div class="record-row"><b>${escapeHtml(title)}</b><small>${escapeHtml(detail)}</small></div>`;
const empty = (message) => `<div class="empty-state"><b>${escapeHtml(message)}</b></div>`;
const options = (items, label, blank = 'Select') => `<option value="">${blank}</option>${items.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(label(item))}</option>`).join('')}`;

function render() {
  const { college, departments, programs, academicYears, terms, classes, subjects, teachers, students, invitations } = state;
  $('#admin-name').textContent = admin.fullName; $('#admin-email').textContent = admin.email;
  $('#college-name').textContent = college.name; $('#college-short-name').textContent = college.shortName;
  $('#college-location').textContent = [college.city, college.state, college.country].filter(Boolean).join(', ');
  $('#count-departments').textContent = departments.length; $('#count-teachers').textContent = teachers.length; $('#count-students').textContent = students.length;
  $('#setup-summary').innerHTML = departments.length ? `<b>${departments.length} department${departments.length === 1 ? '' : 's'} configured</b><p>${programs.length} programs, ${classes.length} classes, ${subjects.length} subjects.</p>` : '<b>Academic setup has not started</b><p>Create genuine WIT departments and programs when ready.</p>';
  $('#department-list').innerHTML = departments.length ? departments.map(v => row(v.name, v.code || 'No code')).join('') : empty('No departments have been added.');
  $('#program-list').innerHTML = programs.length ? programs.map(v => row(v.name, `${v.department.name}${v.code ? ` · ${v.code}` : ''}`)).join('') : empty('No programs have been added.');
  $('#academic-year-list').innerHTML = academicYears.length ? academicYears.map(v => `<div class="record-row"><span><b>${escapeHtml(v.name)}</b><small>${escapeHtml(v.status)}</small></span><span><button type="button" class="status-pill" data-edit-year="${escapeHtml(v.id)}">Edit</button></span></div>`).join('') : empty('No academic years have been added.');
  $('#term-list').innerHTML = terms.length ? terms.map(v => `<div class="record-row"><span><b>${escapeHtml(v.name)}</b><small>${escapeHtml(`${v.academicYear?.name || 'Legacy year'} · ${v.status}`)}</small></span><button type="button" class="status-pill" data-edit-term="${escapeHtml(v.id)}">Edit</button></div>`).join('') : empty('No academic terms have been added.');
  $('#class-list').innerHTML = classes.length ? classes.map(v => `<div class="record-row"><span><b>${escapeHtml(v.name)}</b><small>${escapeHtml(`${v.program.name} · ${v.term.name} · ${v._count.enrollments} students`)}</small></span><button type="button" class="status-pill" data-manage-class="${escapeHtml(v.id)}">Manage</button></div>`).join('') : empty('No classes or sections have been added.');
  $('#subject-list').innerHTML = subjects.length ? subjects.map(v => row(`${v.code} — ${v.name}`, v.department.name)).join('') : empty('No subjects have been added.');
  $('#teacher-list').innerHTML = teachers.length ? teachers.map(v => row(v.fullName, v.email)).join('') : empty('No teachers are linked to WIT.');
  $('#student-list').innerHTML = students.length ? students.map(v => row(v.fullName, v.email)).join('') : empty('No verified students are linked to WIT.');
  const pending = invitations.filter(v => v.status === 'PENDING'); $('#invitation-list').innerHTML = pending.length ? pending.map(v => row(v.email, `${v.role} · expires ${new Date(v.expiresAt).toLocaleDateString()}`)).join('') : empty('No pending invitations.');
  document.querySelectorAll('select[name="departmentId"]').forEach(el => { const current = el.value; el.innerHTML = options(departments, v => `${v.code || ''} ${v.name}`.trim(), 'Department (optional)'); el.value = current; });
  document.querySelectorAll('select[name="academicProgramId"],select[name="programId"]').forEach(el => { const current = el.value; el.innerHTML = options(programs, v => v.name, el.name === 'programId' ? 'Select program' : 'Program (optional)'); el.value = current; });
  document.querySelectorAll('select[name="academicYearId"]').forEach(el => el.innerHTML = options(academicYears, v => v.name, 'Select academic year'));
  document.querySelectorAll('select[name="termId"]').forEach(el => el.innerHTML = options(terms, v => `${v.name} — ${v.academicYear?.name || 'Academic year'}`, 'Select term'));
  document.querySelectorAll('select[name="classSectionId"]').forEach(el => el.innerHTML = options(classes, v => v.name, el.closest('[data-invite]') ? 'Class (optional)' : 'Select class'));
  ['#import-class', '#assignment-class', '#timetable-class'].forEach(selector => { const el = $(selector), current = el.value; el.innerHTML = options(classes, v => `${v.name} — ${v.term.name}`, 'Select class'); el.value = current; });
  $('#import-prerequisite').hidden = classes.length > 0;
  document.querySelectorAll('select[name="teacherId"]').forEach(el => el.innerHTML = options(teachers, v => v.fullName, 'Select teacher'));
  document.querySelectorAll('select[name="subjectId"]').forEach(el => el.innerHTML = options(subjects, v => `${v.code} — ${v.name}`, 'Select subject'));
  const classForm = document.querySelector('[data-create="classes"]'); $('#class-prerequisite').hidden = terms.length > 0; classForm.hidden = terms.length === 0;
  const termForm = document.querySelector('[data-create="terms"]'); $('#term-prerequisite').hidden = academicYears.length > 0; termForm.hidden = academicYears.length === 0;
}
async function reload() { state = await api('/academic/institution/overview'); render(); }
const payload = (form) => Object.fromEntries([...new FormData(form)].map(([key, value]) => {
  if (['durationYears', 'yearLevel', 'semester'].includes(key)) return [key, value ? Number(value) : undefined];
  return [key, typeof value === 'string' && !value.trim() ? undefined : value];
}).filter(([, value]) => value !== undefined));

const parseRows = text => text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).map(line => {
  const cells = line.includes('\t') ? line.split('\t') : line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
  return cells.map(value => value.trim().replace(/^\"|\"$/g, '').replace(/\"\"/g, '"'));
}).filter((cells, index) => !(index === 0 && /name/i.test(cells[0]) && /email/i.test(cells[1] || ''))).map(cells => ({ fullName: cells[0], email: cells[1], rollNumber: cells[2] }));
const minutes = value => { const [hours, mins] = value.split(':').map(Number); return hours * 60 + mins; };
const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

async function loadRoster(classSectionId) {
  if (!classSectionId) return $('#roster-list').innerHTML = empty('Select a class to view its roster.');
  const data = await api(`/academic/institution/classes/${classSectionId}/roster`);
  const items = [...data.enrollments.map(item => ({ ...item, name: item.student.fullName, email: item.student.email, account: 'Linked account' })), ...data.pending.map(item => ({ ...item, name: item.fullName, account: 'Pending account' }))];
  const query = $('#roster-search').value.toLowerCase(), filtered = items.filter(item => `${item.name} ${item.email} ${item.rollNumber || ''}`.toLowerCase().includes(query));
  $('#roster-list').innerHTML = filtered.length ? filtered.map(item => `<div class="record-row"><span><b>${escapeHtml(item.rollNumber || '—')} · ${escapeHtml(item.name)}</b><small>${escapeHtml(item.email)} · ${escapeHtml(item.account)}</small></span>${item.student ? `<button type="button" class="status-pill danger" data-withdraw="${escapeHtml(item.id)}">Remove</button>` : ''}</div>`).join('') : empty(items.length ? 'No roster matches your search.' : 'No students are enrolled in this class.');
}

async function loadClassOperations(classSectionId, initializeDraft = false) {
  if (!classSectionId) { classOperations = null; $('#assignment-editor').innerHTML = empty('Select a class to manage assignments.'); $('#save-assignments').hidden = true; return; }
  if (initializeDraft) await api(`/academic/institution/classes/${classSectionId}/timetable/draft`, { method: 'POST' });
  classOperations = await api(`/academic/institution/classes/${classSectionId}/operations`);
  const assignmentBySubject = new Map(classOperations.section.teachingAssignments.map(item => [item.subjectId, item.teacherId]));
  $('#assignment-editor').innerHTML = classOperations.subjects.length ? classOperations.subjects.map(subject => `<label class="assignment-row"><span><b>${escapeHtml(subject.code)}</b><small>${escapeHtml(subject.name)}</small></span><select data-subject-teacher="${escapeHtml(subject.id)}">${options(classOperations.teachers, teacher => teacher.fullName, 'Unassigned')}</select></label>`).join('') : empty('No subjects have been added to this class department.');
  classOperations.subjects.forEach(subject => { const select = document.querySelector(`[data-subject-teacher="${CSS.escape(subject.id)}"]`); if (select) select.value = assignmentBySubject.get(subject.id) || ''; });
  $('#save-assignments').hidden = !classOperations.subjects.length;
  renderTimetable();
}

function renderTimetable() {
  if (!classOperations) return $('#timetable-grid').innerHTML = empty('Select a class to build its timetable.');
  const draft = classOperations.versions.find(version => version.status === 'DRAFT'), published = classOperations.versions.find(version => version.status === 'PUBLISHED'), entries = draft?.entries || [];
  $('#timetable-status').textContent = published ? `Published ${new Date(published.publishedAt).toLocaleDateString()}` : 'Draft only'; $('#preview-timetable').disabled = !draft; $('#publish-timetable').disabled = !draft;
  const assignments = classOperations.section.teachingAssignments, select = $('#lecture-form select[name="teachingAssignmentId"]'); select.innerHTML = options(assignments, item => `${item.subject.code} — ${item.teacher.fullName}`, 'Select subject & teacher');
  $('#timetable-dependency').hidden = assignments.length > 0; $('#lecture-form').hidden = assignments.length === 0;
  const days = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  $('#timetable-grid').innerHTML = days.map(day => `<section class="day-column"><h3>${day[0] + day.slice(1).toLowerCase()}</h3>${entries.filter(entry => entry.day === day).sort((a,b) => a.startMinutes-b.startMinutes).map(entry => `<article class="lecture-slot"><b>${escapeHtml(entry.teachingAssignment.subject.code)}</b><span>${clock(entry.startMinutes)}–${clock(entry.endMinutes)}</span><small>${escapeHtml(entry.teachingAssignment.teacher.fullName)} · ${escapeHtml(entry.room || 'Room TBA')} · ${escapeHtml(entry.lectureType)}</small><button type="button" data-remove-slot="${escapeHtml(entry.id)}">Remove</button></article>`).join('') || '<p class="muted">No lectures</p>'}</section>`).join('');
}

if (admin) {
  await reload();
  $('.mobile-academic-menu').addEventListener('click', () => $('#admin-sidebar').classList.toggle('open'));
  const panelNames = new Set([...document.querySelectorAll('.admin-panel')].map(panel => panel.dataset.panel));
  const activatePanel = requested => {
    const panelName = panelNames.has(requested) ? requested : 'dashboard';
    document.querySelectorAll('.academic-nav a').forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${panelName}`));
    document.querySelectorAll('.admin-panel').forEach(panel => { panel.hidden = panel.dataset.panel !== panelName; });
    $('#admin-sidebar').classList.remove('open');
    if (window.location.hash !== `#${panelName}`) history.replaceState(null, '', `#${panelName}`);
  };
  document.querySelectorAll('.academic-nav a').forEach(link => link.addEventListener('click', event => { event.preventDefault(); const panel = link.getAttribute('href').slice(1); history.pushState(null, '', `#${panel}`); activatePanel(panel); }));
  window.addEventListener('hashchange', () => activatePanel(window.location.hash.slice(1)));
  activatePanel(window.location.hash.slice(1) || 'dashboard');
  document.querySelector('[data-go-setup]')?.addEventListener('click', () => { history.pushState(null, '', '#setup'); activatePanel('setup'); });
  document.querySelectorAll('[data-create]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try { const body = payload(form); await api(`/academic/institution/${form.dataset.create}`, { method: 'POST', body: JSON.stringify(body) }); form.reset(); notice('Saved successfully.'); await reload(); } catch (error) { notice(error.message, true); } finally { button.disabled = false; }
  }));
  document.querySelectorAll('[data-invite]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try { const result = await api('/academic/institution/invitations', { method: 'POST', body: JSON.stringify({ ...payload(form), role: form.dataset.invite }) }); form.reset(); notice(`Invitation created. Share this one-time link securely: ${result.inviteUrl}`); await reload(); } catch (error) { notice(error.message, true); } finally { button.disabled = false; }
  }));
  $('[data-assignment]').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true; try { await api('/academic/institution/teacher-assignments', { method: 'POST', body: JSON.stringify(payload(form)) }); notice('Teacher assignment saved.'); await reload(); } catch (error) { notice(error.message, true); } finally { button.disabled = false; } });
  $('#student-csv').addEventListener('change', async event => { const file = event.target.files[0]; if (file) { $('#student-paste').value = await file.text(); notice(`${file.name} loaded. Review the class, then preview the import.`); } });
  $('#preview-import').addEventListener('click', async () => {
    const classSectionId = $('#import-class').value; if (!classSectionId) return notice('Select a class before importing students.', true);
    importRows = parseRows($('#student-paste').value); if (!importRows.length) return notice('Paste rows or choose a CSV file first.', true);
    try { const data = await api('/academic/institution/student-import/preview', { method: 'POST', body: JSON.stringify({ classSectionId, rows: importRows }) }); $('#import-preview').innerHTML = `<p><b>${data.summary.total}</b> detected · <b>${data.summary.valid}</b> valid · <b>${data.summary.invalid}</b> invalid</p><div class="preview-table">${data.rows.map(item => `<div class="preview-row ${item.valid ? 'valid' : 'invalid'}"><span>${escapeHtml(item.fullName || `Row ${item.index + 1}`)}</span><span>${escapeHtml(item.email || '')}</span><span>${escapeHtml(item.rollNumber || '')}</span><small>${escapeHtml(item.valid ? item.accountStatus : item.reason)}</small></div>`).join('')}</div>`; $('#commit-import').disabled = !data.summary.valid; notice('Import preview is ready. Nothing has been saved yet.'); } catch (error) { notice(error.message, true); }
  });
  $('#commit-import').addEventListener('click', async () => { try { const classSectionId = $('#import-class').value, result = await api('/academic/institution/student-import/commit', { method: 'POST', body: JSON.stringify({ classSectionId, rows: importRows }) }); notice(`${result.imported} students processed: ${result.linked} linked, ${result.pending} pending signup.`); $('#commit-import').disabled = true; await loadRoster(classSectionId); await reload(); } catch (error) { notice(error.message, true); } });
  $('#import-class').addEventListener('change', event => loadRoster(event.target.value).catch(error => notice(error.message, true)));
  $('#roster-search').addEventListener('input', () => loadRoster($('#import-class').value).catch(error => notice(error.message, true)));
  $('#assignment-class').addEventListener('change', event => loadClassOperations(event.target.value).catch(error => notice(error.message, true)));
  $('#save-assignments').addEventListener('click', async () => { const classSectionId = $('#assignment-class').value, assignments = [...document.querySelectorAll('[data-subject-teacher]')].filter(select => select.value).map(select => ({ subjectId: select.dataset.subjectTeacher, teacherId: select.value })); try { await api(`/academic/institution/classes/${classSectionId}/teacher-assignments`, { method: 'PUT', body: JSON.stringify({ assignments }) }); notice('Faculty and subject assignments saved.'); await loadClassOperations(classSectionId); } catch (error) { notice(error.message, true); } });
  $('#timetable-class').addEventListener('change', event => loadClassOperations(event.target.value, true).catch(error => notice(error.message, true)));
  $('#lecture-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget, data = payload(form), classSectionId = $('#timetable-class').value; data.startMinutes = minutes(data.startTime); data.endMinutes = minutes(data.endTime); delete data.startTime; delete data.endTime; try { await api(`/academic/institution/classes/${classSectionId}/timetable/entries`, { method: 'POST', body: JSON.stringify(data) }); form.reset(); notice('Lecture added to the draft.'); await loadClassOperations(classSectionId); } catch (error) { notice(error.message, true); } });
  $('#preview-timetable').addEventListener('click', () => { $('#timetable-grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); notice('Previewing the current draft. Students still see only the published version.'); });
  $('#publish-timetable').addEventListener('click', async () => { const classSectionId = $('#timetable-class').value; try { await api(`/academic/institution/classes/${classSectionId}/timetable/publish`, { method: 'POST' }); notice('Timetable published to enrolled students and assigned teachers.'); await loadClassOperations(classSectionId); } catch (error) { notice(error.message, true); } });
  document.addEventListener('click', async event => {
    const manage = event.target.closest('[data-manage-class]'), withdraw = event.target.closest('[data-withdraw]'), removeSlot = event.target.closest('[data-remove-slot]');
    if (manage) { $('#assignment-class').value = manage.dataset.manageClass; await loadClassOperations(manage.dataset.manageClass); }
    if (withdraw && confirm('Remove this student from the active class roster? Attendance history will be preserved.')) { try { await api(`/academic/institution/classes/${$('#import-class').value}/enrollments/${withdraw.dataset.withdraw}`, { method: 'DELETE' }); notice('Student removed from the active roster.'); await loadRoster($('#import-class').value); } catch (error) { notice(error.message, true); } }
    if (removeSlot && confirm('Remove this lecture from the draft timetable?')) { try { const classSectionId = $('#timetable-class').value; await api(`/academic/institution/classes/${classSectionId}/timetable/entries/${removeSlot.dataset.removeSlot}`, { method: 'DELETE' }); notice('Lecture removed from the draft.'); await loadClassOperations(classSectionId); } catch (error) { notice(error.message, true); } }
  });
  document.addEventListener('click', async event => {
    const yearButton = event.target.closest('[data-edit-year]'), termButton = event.target.closest('[data-edit-term]'); if (!yearButton && !termButton) return;
    const item = yearButton ? state.academicYears.find(v => v.id === yearButton.dataset.editYear) : state.terms.find(v => v.id === termButton.dataset.editTerm); if (!item) return;
    const name = prompt('Name', item.name); if (!name) return; const status = prompt('Status: UPCOMING, ACTIVE, or COMPLETED', item.status)?.toUpperCase(); if (!['UPCOMING', 'ACTIVE', 'COMPLETED'].includes(status)) return notice('Choose UPCOMING, ACTIVE, or COMPLETED.', true);
    try { const path = yearButton ? `academic-years/${item.id}` : `terms/${item.id}`; await api(`/academic/institution/${path}`, { method: 'PATCH', body: JSON.stringify({ name, status }) }); notice('Academic period updated.'); await reload(); } catch (error) { notice(error.message, true); }
  });
}
