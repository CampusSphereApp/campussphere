import {
  avatarUrl,
  escapeHtml,
  restoreSession,
  logout
} from './frontend-api.js';


const ROLE_LABELS = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  COLLEGE_ADMIN: 'College Admin',
  ADMIN: 'Admin'
};


const initInternalShell = async () => {

  const shell =
    document.querySelector('.internal-shell');

  if (!shell) return;


  const session =
    await restoreSession();


  if (!session) {

    window.location.assign('login.html');

    return;

  }


  /* ==========================================
     CURRENT USER
     ========================================== */

  document
    .querySelectorAll(
      '[data-current-user-avatar]'
    )
    .forEach(image => {

      image.src =
        avatarUrl(session, 64);

      image.alt =
        session.fullName ||
        'CampusSphere member';

    });


  const name =
    document.querySelector(
      '[data-current-user-name]'
    );


  if (name) {

    name.textContent =
      session.fullName ||
      'CampusSphere member';

  }


  const detail =
    document.querySelector(
      '[data-current-user-detail]'
    );


  if (detail) {

    detail.textContent =
      [
        ROLE_LABELS[session.role] ||
          'CampusSphere member',

        session.college
      ]
        .filter(Boolean)
        .join(' · ');

  }


  document.body.dataset.role =
    session.role ||
    'STUDENT';


  /* ==========================================
     ROLE-AWARE ACADEMICS
     ========================================== */

  const academicsLink =
    document.querySelector(
      '.internal-nav [data-academics-link]'
    );


  if (academicsLink) {

    if (
      session.role === 'TEACHER'
    ) {

      academicsLink.href =
        'teacher-dashboard.html';

      academicsLink.title =
        'Open Teacher Academics';

    }

    else if (
      session.role ===
      'COLLEGE_ADMIN'
    ) {

      academicsLink.href =
        'college-admin.html';

      academicsLink.title =
        'Manage Institution Academics';

    }

    else {

      academicsLink.href =
        'academics.html';

      academicsLink.title =
        'Open Academics';

    }

  }


  /* ==========================================
     LOGOUT
     ========================================== */

  const logoutButton =
    document.querySelector(
      '[data-internal-logout]'
    );


  logoutButton?.addEventListener(
    'click',
    async event => {

      event.preventDefault();


      try {

        await logout();

      }

      finally {

        window.location.assign(
          'login.html'
        );

      }

    }
  );

};


initInternalShell()
  .catch(error => {

    console.error(
      'CampusSphere internal shell:',
      escapeHtml(
        error?.message ||
        'Unable to initialize shell.'
      )
    );

  });