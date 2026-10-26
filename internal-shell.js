import {
  avatarUrl,
  restoreSession,
  logout
} from './frontend-api.js';

if (!document.querySelector('link[href="completion-ui.css"]')) document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="completion-ui.css">');


const ROLE_LABELS = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  COLLEGE_ADMIN: 'College Admin',
  ADMIN: 'Admin'
};

const iconPaths = {
  dashboard: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  discover: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>', social: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  communities: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 12 0v2M18 8a3 3 0 1 1 0 6"/>', events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>', projects: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>', opportunities: '<path d="M9 18h6M10 22h4M8.5 14.5A7 7 0 1 1 15.5 14.5c-.9.7-1.5 1.5-1.5 2.5h-4c0-1-.6-1.8-1.5-2.5Z"/>', academics: '<path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12.5V17c3 2 7 2 10 0v-4.5M21 10v6"/>', messages: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/>', notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>', profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>', logout: '<path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
};
const icon = name => `<svg class="internal-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;


const currentPage = () => {
  const file =
    window.location.pathname
      .split('/')
      .pop();

  return file || 'dashboard.html';
};


const academicTarget = role => {

  if (role === 'TEACHER') {
    return 'teacher-dashboard.html';
  }

  if (role === 'COLLEGE_ADMIN') {
    return 'college-admin.html';
  }

  if (role === 'ADMIN') {
    return 'admin.html';
  }

  return 'academics.html';
};


const collegeLabel = session => {

  if (!session?.college) {
    return '';
  }

  if (typeof session.college === 'string') {
    return session.college;
  }

  return (
    session.college.name ||
    session.college.shortName ||
    ''
  );

};


const navigation = session => {

  const academics =
    academicTarget(session.role);

  return [
    {
      href: 'dashboard.html',
      icon: 'dashboard',
      label: 'Dashboard'
    },
    {
      href: 'discover.html',
      icon: 'discover',
      label: 'Discover'
    },
    {
  href: 'social-network.html',
  icon: 'social',
  label: 'Social Network'
},
    {
      href: 'communities.html',
      icon: 'communities',
      label: 'Communities'
    },
    {
      href: 'events.html',
      icon: 'events',
      label: 'Events'
    },
    {
      href: 'projects.html',
      icon: 'projects',
      label: 'Projects'
    },
    {
      href: 'opportunities.html',
      icon: 'opportunities',
      label: 'Opportunities'
    },
    {
      href: academics,
      icon: 'academics',
      label: 'Academics',
      academics: true
    },
    {
      divider: true
    },
    {
      href: 'messages.html',
      icon: 'messages',
      label: 'Messages'
    },
    {
      href: 'notifications.html',
      icon: 'notifications',
      label: 'Notifications'
    },
    {
      href: 'profile.html',
      icon: 'profile',
      label: 'Profile'
    },
    {
      href: 'settings.html',
      icon: 'settings',
      label: 'Settings'
    }
  ];

};


const createSidebar = session => {

  const sidebar =
    document.createElement('aside');

  sidebar.className =
    'internal-sidebar';


  const nav =
    navigation(session)
      .map(item => {

        if (item.divider) {
          return '<hr>';
        }

        const selected =
          item.href === currentPage() ||
          (
            item.academics &&
            [
              'academics.html',
              'teacher-dashboard.html',
              'college-admin.html'
            ].includes(currentPage())
          );

        return `
          <a
            href="${item.href}"
            ${item.academics ? 'data-academics-link' : ''}
            ${selected ? 'class="selected"' : ''}
          >
            ${icon(item.icon)}
            <span>${item.label}</span>
          </a>
        `;
      })
      .join('');


  sidebar.innerHTML = `

    <a
      class="internal-brand"
      href="dashboard.html"
    >
      <b>C</b>
      CampusSphere
    </a>

    <nav class="internal-nav">
      ${nav}
    </nav>

    <div class="internal-sidebar-user">

      <img
        data-current-user-avatar
        alt="Current user"
      >

      <div>
        <b data-current-user-name>
          Loading…
        </b>

        <small data-current-user-detail>
          CampusSphere member
        </small>
      </div>

      <button
        class="internal-logout"
        type="button"
        data-internal-logout
        aria-label="Log out"
        title="Log out"
      >
        ${icon('logout')}
      </button>

    </div>
  `;


  return sidebar;

};


const createTopbar = () => {

  const topbar =
    document.createElement('header');

  topbar.className =
    'internal-topbar';

  topbar.innerHTML = `

    <button
      class="internal-mobile-menu"
      type="button"
      aria-label="Open navigation"
    >
      ${icon('menu')}
    </button>

    <div class="internal-topbar-search">
      ${icon('search')}

      <input
        id="internal-global-search"
        type="search"
        placeholder="Search CampusSphere"
        autocomplete="off"
      >
    </div>

    <div class="internal-top-actions">

      <a
        href="notifications.html"
        aria-label="Notifications"
        title="Notifications"
      >
        ${icon('notifications')}
      </a>

      <div class="internal-account-menu">

        <button
          class="internal-account-trigger"
          type="button"
          aria-label="Account menu"
          aria-expanded="false"
        >
          <img
            data-current-user-avatar
            alt="Current user"
          >
        </button>

        <div
          class="internal-account-dropdown"
          hidden
        >

          <a href="profile.html">
            View profile
          </a>

          <a href="settings.html">
            Settings
          </a>

          <button
            class="danger"
            type="button"
            data-account-logout
          >
            Log out
          </button>

        </div>

      </div>

    </div>
  `;

  return topbar;
};


const extractExistingMain = () => {

  /*
   * Discover currently has:
   *
   * .app
   *   .sidebar
   *   main
   *     header.top
   *     .content
   */

  const oldApp =
    document.querySelector(
      'body > .app'
    );


  if (oldApp) {

    const main =
      oldApp.querySelector(
        ':scope > main'
      );


    if (!main) {
      return null;
    }


    main
      .querySelector(
        ':scope > header.top'
      )
      ?.remove();


    /*
     * Move main outside .app
     * before deleting old shell.
     */

    document.body.insertBefore(
      main,
      oldApp
    );


    oldApp.remove();


    return main;
  }


  /*
   * Communities / Events / Projects
   * currently use body > header + body > main.
   */

  document
    .querySelector(
      'body > header'
    )
    ?.remove();


  return document.querySelector(
    'body > main'
  );

};


const createShell = session => {

  /*
   * Opportunities already has the
   * shared shell manually installed.
   */

  const existing =
    document.querySelector(
      '.internal-shell'
    );


  if (existing) {
    existing
      .querySelector('.internal-sidebar')
      ?.replaceWith(createSidebar(session));

    existing
      .querySelector('.internal-topbar')
      ?.replaceWith(createTopbar());

    return existing;
  }


  const main =
    extractExistingMain();


  if (!main) {

    console.warn(
      'CampusSphere shell: page content was not found.'
    );

    return null;
  }


  const shell =
    document.createElement('div');


  shell.className =
    'internal-shell';


  const page =
    document.createElement('section');


  page.className =
    'internal-page';


  const sidebar =
    createSidebar(session);


  const topbar =
    createTopbar();


  page.append(
    topbar,
    main
  );


  shell.append(
    sidebar,
    page
  );


  document.body.insertBefore(
    shell,
    document.body.firstChild
  );


  return shell;

};


const hydrateIdentity = (
  shell,
  session
) => {

  document.body.dataset.role =
    session.role ||
    'STUDENT';


  shell
    .querySelectorAll(
      '[data-current-user-avatar]'
    )
    .forEach(image => {

      image.src =
        avatarUrl(
          session,
          64
        );

      image.alt =
        session.fullName ||
        'CampusSphere member';

    });


  const name =
    shell.querySelector(
      '[data-current-user-name]'
    );


  if (name) {

    name.textContent =
      session.fullName ||
      'CampusSphere member';

  }


  const detail =
    shell.querySelector(
      '[data-current-user-detail]'
    );


  if (detail) {

    detail.textContent =
      [
        ROLE_LABELS[session.role] ||
          'CampusSphere member',

        collegeLabel(session)
      ]
        .filter(Boolean)
        .join(' · ');

  }

};


const hydrateAcademics = (
  shell,
  session
) => {

  let link =
    shell.querySelector(
      '[data-academics-link]'
    );


  /*
   * Compatibility with the manually
   * created Opportunities shell.
   */

  if (!link) {

    link =
      [...shell.querySelectorAll(
        '.internal-nav a'
      )]
        .find(anchor =>
          anchor.textContent
            .includes('Academics')
        );

  }


  if (!link) return;


  link.dataset.academicsLink =
    'true';


  link.href =
    academicTarget(
      session.role
    );


  if (session.role === 'TEACHER') {

    link.title =
      'Open Teacher Academics';

  }

  else if (
    session.role ===
    'COLLEGE_ADMIN'
  ) {

    link.title =
      'Manage Institution Academics';

  }

  else {

    link.title =
      'Open Academics';

  }

};


const hydrateSelectedPage =
  shell => {

    const page =
      currentPage();


    shell
      .querySelectorAll(
        '.internal-nav a'
      )
      .forEach(anchor => {

        const href =
          anchor
            .getAttribute('href')
            ?.split('?')[0]
            ?.split('#')[0];


        const academics =
          anchor.hasAttribute(
            'data-academics-link'
          );


        const selected =
          href === page ||
          (
            academics &&
            [
              'academics.html',
              'teacher-dashboard.html',
              'college-admin.html'
            ].includes(page)
          );


        anchor.classList.toggle(
          'selected',
          selected
        );

      });

};


const wireLogout =
  shell => {

    let button =
      shell.querySelector(
        '[data-internal-logout]'
      );


    /*
     * If Opportunities was created
     * before the logout button existed,
     * add it automatically.
     */

    if (!button) {

      const account =
        shell.querySelector(
          '.internal-sidebar-user'
        );


      if (account) {

        button =
          document.createElement(
            'button'
          );


        button.type =
          'button';


        button.className =
          'internal-logout';


        button.dataset.internalLogout =
          'true';


        button.setAttribute(
          'aria-label',
          'Log out'
        );


        button.title =
          'Log out';


        button.innerHTML = icon('logout');


        account.append(button);

      }

    }


    button?.addEventListener(
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


const wireMobileNavigation =
  shell => {

    const button =
      shell.querySelector(
        '.internal-mobile-menu'
      );


    const sidebar =
      shell.querySelector(
        '.internal-sidebar'
      );


    button?.addEventListener(
      'click',
      () => {

        sidebar?.classList.toggle(
          'mobile-open'
        );

      }
    );


    shell
      .querySelectorAll(
        '.internal-nav a'
      )
      .forEach(link => {

        link.addEventListener(
          'click',
          () => {

            sidebar?.classList.remove(
              'mobile-open'
            );

          }
        );

      });

};


const wireGlobalSearch =
  shell => {

    const globalSearch =
      shell.querySelector(
        '.internal-topbar-search input'
      );


    if (!globalSearch) return;


    const localSearch =
      document.querySelector(
        [
          '#student-search',
          '#community-search',
          '#event-search',
          '#project-search',
          '#search'
        ].join(',')
      );


    if (!localSearch) {

      globalSearch.placeholder =
        'Search CampusSphere';

      return;

    }


    globalSearch.placeholder =
      localSearch.placeholder ||
      'Search this page';


    globalSearch.addEventListener(
      'input',
      () => {

        localSearch.value =
          globalSearch.value;


        localSearch.dispatchEvent(
          new Event(
            'input',
            {
              bubbles: true
            }
          )
        );

      }
    );

};

const wireAccountMenu = shell => {

  const trigger =
    shell.querySelector(
      '.internal-account-trigger'
    );

  const menu =
    shell.querySelector(
      '.internal-account-dropdown'
    );

  if (!trigger || !menu) return;


  const close = () => {

    menu.hidden = true;

    trigger.setAttribute(
      'aria-expanded',
      'false'
    );

  };


  trigger.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      menu.hidden =
        !menu.hidden;

      trigger.setAttribute(
        'aria-expanded',
        String(!menu.hidden)
      );

    }
  );


  document.addEventListener(
    'click',
    event => {

      if (
        !event.target.closest(
          '.internal-account-menu'
        )
      ) {

        close();

      }

    }
  );


  document.addEventListener(
    'keydown',
    event => {

      if (event.key === 'Escape') {
        close();
      }

    }
  );


  menu
    .querySelector(
      '[data-account-logout]'
    )
    ?.addEventListener(
      'click',
      async () => {

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
const initInternalShell =
  async () => {

    const session =
      await restoreSession();


    if (!session) {

      window.location.assign(
        'login.html'
      );

      return;

    }


    if (
      session.role === 'ADMIN'
    ) {

      /*
       * Platform admin remains
       * separate.
       */

      window.location.assign(
        'admin.html'
      );

      return;

    }


    const shell =
      createShell(session);


    if (!shell) return;


    hydrateIdentity(
      shell,
      session
    );


    hydrateAcademics(
      shell,
      session
    );


    hydrateSelectedPage(
      shell
    );


    wireLogout(
      shell
    );
wireAccountMenu(
  shell
);

    wireMobileNavigation(
      shell
    );


    wireGlobalSearch(
      shell
    );
document.documentElement.classList.remove(
  'cs-shell-loading'
);

document.documentElement.classList.add(
  'cs-shell-ready'
);
};


const boot = () => {

  initInternalShell()
    .catch(error => {

      console.error(
        'CampusSphere internal shell:',
        error
      );
document.documentElement.classList.remove(
  'cs-shell-loading'
);
    });

};


/*
 * Run only after all existing page scripts
 * have had a chance to initialize.
 */

boot();
