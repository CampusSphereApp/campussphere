import './current-user.js?v=wit-admin-1';
import { api, escapeHtml, requireRole } from './frontend-api.js?v=wit-admin-1';

const admin = await requireRole('COLLEGE_ADMIN');
let state;
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
  $('#class-list').innerHTML = classes.length ? classes.map(v => row(v.name, `${v.program.name} · ${v.term.name} · ${v._count.enrollments} students`)).join('') : empty('No classes or sections have been added.');
  $('#subject-list').innerHTML = subjects.length ? subjects.map(v => row(`${v.code} — ${v.name}`, v.department.name)).join('') : empty('No subjects have been added.');
  $('#teacher-list').innerHTML = teachers.length ? teachers.map(v => row(v.fullName, v.email)).join('') : empty('No teachers are linked to WIT.');
  $('#student-list').innerHTML = students.length ? students.map(v => row(v.fullName, v.email)).join('') : empty('No verified students are linked to WIT.');
  const pending = invitations.filter(v => v.status === 'PENDING'); $('#invitation-list').innerHTML = pending.length ? pending.map(v => row(v.email, `${v.role} · expires ${new Date(v.expiresAt).toLocaleDateString()}`)).join('') : empty('No pending invitations.');
  document.querySelectorAll('select[name="departmentId"]').forEach(el => { const current = el.value; el.innerHTML = options(departments, v => `${v.code || ''} ${v.name}`.trim(), 'Department (optional)'); el.value = current; });
  document.querySelectorAll('select[name="academicProgramId"],select[name="programId"]').forEach(el => { const current = el.value; el.innerHTML = options(programs, v => v.name, el.name === 'programId' ? 'Select program' : 'Program (optional)'); el.value = current; });
  document.querySelectorAll('select[name="academicYearId"]').forEach(el => el.innerHTML = options(academicYears, v => v.name, 'Select academic year'));
  document.querySelectorAll('select[name="termId"]').forEach(el => el.innerHTML = options(terms, v => `${v.name} — ${v.academicYear?.name || 'Academic year'}`, 'Select term'));
  document.querySelectorAll('select[name="classSectionId"]').forEach(el => el.innerHTML = options(classes, v => v.name, el.closest('[data-invite]') ? 'Class (optional)' : 'Select class'));
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

if (admin) {
  await reload();
  $('.mobile-academic-menu').addEventListener('click', () => $('#admin-sidebar').classList.toggle('open'));
  document.querySelectorAll('.academic-nav a').forEach(link => link.addEventListener('click', () => {
    const panel = link.getAttribute('href').slice(1); document.querySelectorAll('.academic-nav a').forEach(v => v.classList.toggle('active', v === link)); document.querySelectorAll('.admin-panel').forEach(v => { v.hidden = v.dataset.panel !== panel; }); $('#admin-sidebar').classList.remove('open');
  }));
  document.querySelector('[data-go-setup]').addEventListener('click', () => document.querySelector('.academic-nav a[href="#setup"]').click());
  document.querySelectorAll('[data-create]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try { const body = payload(form); await api(`/academic/institution/${form.dataset.create}`, { method: 'POST', body: JSON.stringify(body) }); form.reset(); notice('Saved successfully.'); await reload(); } catch (error) { notice(error.message, true); } finally { button.disabled = false; }
  }));
  document.querySelectorAll('[data-invite]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
    try { const result = await api('/academic/institution/invitations', { method: 'POST', body: JSON.stringify({ ...payload(form), role: form.dataset.invite }) }); form.reset(); notice(`Invitation created. Share this one-time link securely: ${result.inviteUrl}`); await reload(); } catch (error) { notice(error.message, true); } finally { button.disabled = false; }
  }));
  $('[data-assignment]').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true; try { await api('/academic/institution/teacher-assignments', { method: 'POST', body: JSON.stringify(payload(form)) }); notice('Teacher assignment saved.'); await reload(); } catch (error) { notice(error.message, true); } finally { button.disabled = false; } });
  document.addEventListener('click', async event => {
    const yearButton = event.target.closest('[data-edit-year]'), termButton = event.target.closest('[data-edit-term]'); if (!yearButton && !termButton) return;
    const item = yearButton ? state.academicYears.find(v => v.id === yearButton.dataset.editYear) : state.terms.find(v => v.id === termButton.dataset.editTerm); if (!item) return;
    const name = prompt('Name', item.name); if (!name) return; const status = prompt('Status: UPCOMING, ACTIVE, or COMPLETED', item.status)?.toUpperCase(); if (!['UPCOMING', 'ACTIVE', 'COMPLETED'].includes(status)) return notice('Choose UPCOMING, ACTIVE, or COMPLETED.', true);
    try { const path = yearButton ? `academic-years/${item.id}` : `terms/${item.id}`; await api(`/academic/institution/${path}`, { method: 'PATCH', body: JSON.stringify({ name, status }) }); notice('Academic period updated.'); await reload(); } catch (error) { notice(error.message, true); }
  });
}
