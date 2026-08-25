import {
  avatarUrl,
  restoreSession,
  logout
} from './frontend-api.js';


const ROLE_LABELS = {
  STUDENT: 'Student',
  TEACHER: 'Teacher',
  COLLEGE_ADMIN: 'College Admin',
  ADMIN: 'Admin'
};


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
      icon: '⌂',
      label: 'Dashboard'
    },
    {
      href: 'discover.html',
      icon: '◈',
      label: 'Discover'
    },
    {
      href: 'communities.html',
      icon: '◎',
      label: 'Communities'
    },
    {
      href: 'events.html',
      icon: '◷',
      label: 'Events'
    },
    {
      href: 'projects.html',
      icon: '◇',
      label: 'Projects'
    },
    {
      href: 'opportunities.html',
      icon: '↗',
      label: 'Opportunities'
    },
    {
      href: academics,
      icon: '▣',
      label: 'Academics',
      academics: true
    },
    {
      divider: true
    },
    {
      href: 'messages.html',
      icon: '◌',
      label: 'Messages'
    },
    {
      href: 'notifications.html',
      icon: '♧',
      label: 'Notifications'
    },
    {
      href: 'profile.html',
      icon: '♙',
      label: 'Profile'
    },
    {
      href: 'settings.html',
      icon: '⚙',
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
            ${item.icon}
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
        ↪
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
      ☰
    </button>

    <div class="internal-topbar-search">

      ⌕

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
        ♧
      </a>

      <a
        href="profile.html"
        aria-label="Profile"
      >
        <img
          data-current-user-avatar
          alt="Current user"
        >
      </a>

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


        button.textContent =
          '↪';


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
