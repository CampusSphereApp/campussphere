/* Icon rail supplements the existing, role-aware text navigation. */
(() => {
 const paths = {
  'dashboard.html':'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
  'academics.html':'m2 9 10-5 10 5-10 5Zm4 3v6q6 4 12 0v-6M22 9v8',
  'discover.html':'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 8l-3 5-5 3 3-5Z',
  'communities.html':'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM18 8a3 3 0 0 1 0 6M22 21v-2a4 4 0 0 0-3-4',
  'events.html':'M4 5h16v16H4ZM8 3v4M16 3v4M4 11h16',
  'projects.html':'M3 7h18v14H3ZM8 7V3h8v4M3 12h18',
  'opportunities.html':'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',
  'messages.html':'M3 4h18v14H9l-6 4ZM7 9h10M7 13h6',
  'settings.html':'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2'
 };
 const build = () => {
  const sidebar = document.querySelector('.internal-sidebar,.app-shell>.sidebar,.academic-sidebar');
  if (!sidebar || document.querySelector('.cs-reference-rail')) return;
  const rail = document.createElement('nav');
  rail.className = 'cs-reference-rail';
  rail.setAttribute('aria-label','Campus shortcuts');
  const brand = document.createElement('a');
  brand.href = 'dashboard.html';brand.className = 'rail-brand';brand.textContent = 'CAMPUS';
  rail.append(brand);
  const page = location.pathname.split('/').pop();
  for (const [file,path] of Object.entries(paths)) {
   const link = document.createElement('a');
   const academic = file === 'academics.html';
   link.href = academic ? (sidebar.querySelector('[data-academics-link]')?.getAttribute('href') || document.querySelector('.sidebar a[title*="Academic"]')?.getAttribute('href') || file) : file;
   const label = file.replace('.html','').replace(/^./,c=>c.toUpperCase());
   link.title = label;link.setAttribute('aria-label',label);
   if (page === file || (academic && /^(teacher-|college-admin|admin)/.test(page))) link.setAttribute('aria-current','page');
   link.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
   if (academic) link.addEventListener('click', () => {
    const current = document.querySelector('.internal-sidebar [data-academics-link],.sidebar a[href="academics.html"],.sidebar a[href="teacher-dashboard.html"],.sidebar a[href="college-admin.html"],.sidebar a[href="admin.html"]');
    if (current) link.href = current.getAttribute('href');
    else if (/^(teacher-|college-admin|admin)/.test(page)) link.href = page.startsWith('teacher-') ? 'teacher-dashboard.html' : page;
   });
   rail.append(link);
  }
  document.body.append(rail);
 };
 build();
 // The authenticated shell is mounted after session restoration.
 const observer = new MutationObserver(build);
 observer.observe(document.body,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
