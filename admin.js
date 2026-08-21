import './current-user.js?v=academic-foundation-1';
import { api, requireRole } from './frontend-api.js?v=academic-foundation-1';

const admin = await requireRole('ADMIN');
if (admin) {
  const overview = await api('/academic/admin/overview');
  document.querySelector('#admin-colleges').textContent = String(overview.colleges);
  document.querySelector('#admin-teachers').textContent = String(overview.teachers);
  document.querySelector('#admin-students').textContent = String(overview.students);
}
