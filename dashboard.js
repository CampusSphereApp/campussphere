import './current-user.js';

import {
  api,
  avatarUrl,
  escapeHtml,
  formatDate,
  restoreSession,
  logout
} from './frontend-api.js';


/* ============================================================
   CAMPUSSPHERE UNIVERSAL DASHBOARD
   Student + Teacher + College Admin share this dashboard.
   Only role-sensitive academic information differs.
   ============================================================ */


const ROLE_CONFIG = {

  STUDENT: {
    label: 'Student',
    eyebrow: 'YOUR ACADEMICS',
    title: 'Your academic space',
    description:
      'View your classes, attendance, timetable, subjects and academic tasks.',
    action: 'Open Academics'
  },

  TEACHER: {
    label: 'Teacher',
    eyebrow: 'TEACHING WORKSPACE',
    title: 'Your teaching space',
    description:
      'Manage your assigned classes, subjects, attendance, students and academic tasks.',
    action: 'Open Teaching'
  },

  COLLEGE_ADMIN: {
    label: 'College Admin',
    eyebrow: 'INSTITUTION ACADEMICS',
    title: 'Manage your institution',
    description:
      'Manage departments, programs, classes, teachers, enrolments and academic operations.',
    action: 'Manage Academics'
  }

};


/* ============================================================
   HELPERS
   ============================================================ */


const getRoleConfig = (role) =>
  ROLE_CONFIG[role] || ROLE_CONFIG.STUDENT;


const getGreeting = () => {

  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';

  if (hour < 17) return 'Good afternoon';

  return 'Good evening';

};


const getCurrentDate = () =>
  new Intl.DateTimeFormat(
    'en-IN',
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }
  ).format(new Date());


const safeArray = (value) =>
  Array.isArray(value) ? value : [];


/* ============================================================
   ROLE-AWARE ACADEMIC CARD
   ============================================================ */


const renderAcademicSpace = (session) => {

  const config =
    getRoleConfig(session.role);


  const quickSection =
    document.querySelector('.quick-grid')
      ?.closest('section');


  if (!quickSection) return;


  document
    .querySelector('.role-academic-card')
    ?.remove();


  quickSection.insertAdjacentHTML(
    'afterend',
    `
      <a
        class="role-academic-card"
        href="academics.html"
        data-role="${escapeHtml(session.role || 'STUDENT')}"
      >

        <div class="role-academic-icon">
          ▣
        </div>

        <div class="role-academic-copy">

          <small>
            ${escapeHtml(config.eyebrow)}
          </small>

          <strong>
            ${escapeHtml(config.title)}
          </strong>

          <p>
            ${escapeHtml(config.description)}
          </p>

        </div>

        <div class="role-academic-action">

          <span class="role-pill">
            ${escapeHtml(config.label)}
          </span>

          <b>
            ${escapeHtml(config.action)} →
          </b>

        </div>

      </a>
    `
  );

};


/* ============================================================
   USER SEARCH
   ============================================================ */


const wireSearch = (session) => {

  const searchInput =
    document.querySelector(
      '#dashboard-user-search'
    );

  const searchResults =
    document.querySelector(
      '#dashboard-user-results'
    );


  if (
    !searchInput ||
    !searchResults
  ) {
    return;
  }


  let timer;

  let version = 0;


  const closeSearch = () => {

    searchResults.hidden = true;

    searchResults.innerHTML = '';

    searchInput.setAttribute(
      'aria-expanded',
      'false'
    );

  };


  const doSearch = async () => {

    const query =
      searchInput.value.trim();


    const request =
      ++version;


    if (query.length < 2) {

      closeSearch();

      return;

    }


    searchResults.hidden = false;

    searchInput.setAttribute(
      'aria-expanded',
      'true'
    );


    searchResults.innerHTML =
      '<span class="empty-search">Searching CampusSphere…</span>';


    try {

      const result =
        await api(
          `/users/search?q=${encodeURIComponent(query)}&limit=5`
        );


      if (request !== version) {
        return;
      }


      const users =
        safeArray(result)
          .filter(
            user =>
              user.id !== session.id
          );


      searchResults.innerHTML =
        users.length

          ? users
              .map(
                user => `

                  <button
                    type="button"
                    role="option"
                    data-user-id="${escapeHtml(user.id)}"
                  >

                    <img
                      src="${avatarUrl(user, 48)}"
                      alt="${escapeHtml(user.fullName)}"
                    >

                    <span>

                      <b>
                        ${escapeHtml(user.fullName)}
                      </b>

                      <small>

                        ${escapeHtml(
                          [
                            user.course,
                            user.college,
                            user.year || ''
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        )}

                      </small>

                    </span>

                  </button>

                `
              )
              .join('')

          : '<span class="empty-search">No users found.</span>';

    }

    catch (error) {

      searchResults.innerHTML =
        `<span class="empty-search">${escapeHtml(
          error?.message ||
          'Unable to search right now.'
        )}</span>`;

    }

  };


  searchInput.addEventListener(
    'input',
    () => {

      clearTimeout(timer);

      timer =
        setTimeout(
          () => void doSearch(),
          300
        );

    }
  );


  searchResults.addEventListener(
    'click',
    event => {

      const result =
        event.target.closest(
          '[data-user-id]'
        );


      if (!result) return;


      window.location.assign(
        `profile.html?id=${encodeURIComponent(
          result.dataset.userId
        )}`
      );

    }
  );


  document.addEventListener(
    'click',
    event => {

      if (
        !event.target.closest('.search')
      ) {

        closeSearch();

      }

    }
  );

};


/* ============================================================
   NAVIGATION / APP SHELL
   ============================================================ */


const wireNavigation = () => {

  const logoutButton =
    document.querySelector(
      '.sidebar-user a[aria-label="Log out"]'
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


  document
    .querySelector('.mobile-menu')
    ?.addEventListener(
      'click',
      () => {

        document
          .querySelector('.sidebar')
          ?.classList.toggle(
            'mobile-open'
          );

      }
    );


  document
    .querySelector('.bell')
    ?.addEventListener(
      'click',
      () => {

        window.location.assign(
          'notifications.html'
        );

      }
    );


  document
    .querySelectorAll(
      '.tabs button'
    )
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            const label =
              button.textContent
                .trim();


            if (
              label === 'Communities'
            ) {

              window.location.assign(
                'communities.html'
              );

            }


            if (
              label === 'Projects'
            ) {

              window.location.assign(
                'projects.html'
              );

            }

          }
        );

      }
    );

};


/* ============================================================
   HELP DIALOG
   ============================================================ */


const wireHelp = () => {

  const helpButton =
    document.querySelector(
      '.help-button'
    );


  if (!helpButton) return;


  const modal =
    document.createElement('div');


  modal.className =
    'help-modal';


  modal.hidden = true;


  modal.innerHTML = `

    <section
      class="help-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >

      <button
        class="help-close"
        type="button"
        aria-label="Close help"
      >
        ×
      </button>

      <h2 id="help-title">
        CampusSphere Help
      </h2>

      <p>
        Quick guidance for navigating your campus network.
      </p>

      <a href="about.html">
        About CampusSphere
        <small>
          Learn what CampusSphere is building.
        </small>
      </a>

      <a href="discover.html">
        Discover CampusSphere
        <small>
          Find students and people across campus.
        </small>
      </a>

      <a href="connections.html">
        Connections
        <small>
          Build and manage your campus network.
        </small>
      </a>

      <a href="projects.html">
        Projects
        <small>
          Discover teams, ideas and open roles.
        </small>
      </a>

      <a href="events.html">
        Events
        <small>
          Find things happening around campus.
        </small>
      </a>

      <a
        href="mailto:support@campussphere.dev?subject=CampusSphere%20Help"
      >
        Report a problem
        <small>
          Contact the CampusSphere support team.
        </small>
      </a>

    </section>

  `;


  document.body.append(modal);


  const closeHelp = () => {

    modal.hidden = true;

    helpButton.setAttribute(
      'aria-expanded',
      'false'
    );

  };


  helpButton.addEventListener(
    'click',
    () => {

      modal.hidden = false;

      helpButton.setAttribute(
        'aria-expanded',
        'true'
      );


      modal
        .querySelector('.help-close')
        ?.focus();

    }
  );


  modal.addEventListener(
    'click',
    event => {

      if (
        event.target === modal ||
        event.target.closest(
          '.help-close'
        )
      ) {

        closeHelp();

      }

    }
  );


  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape'
      ) {

        closeHelp();

      }

    }
  );

};


/* ============================================================
   DASHBOARD HEADER
   ============================================================ */


const renderIdentity = (
  session,
  dashboardUser
) => {

  const user =
    dashboardUser ||
    session;


  const greeting =
    document.querySelector(
      '.greeting h1'
    );


  const date =
    document.querySelector(
      '.greeting p'
    );


  if (date) {

    date.textContent =
      getCurrentDate();

  }


  if (greeting) {

    greeting.innerHTML = `

      ${escapeHtml(getGreeting())},
      ${escapeHtml(
        user.fullName ||
        'CampusSphere member'
      )}

      <span>👋</span>

    `;

  }


  document
    .querySelectorAll(
      '.sidebar-user img, .top-actions img'
    )
    .forEach(
      image => {

        image.src =
          avatarUrl(user, 64);


        image.alt =
          user.fullName ||
          'CampusSphere user';

      }
    );


  const sidebarName =
    document.querySelector(
      '[data-current-user-name]'
    );


  const sidebarDetail =
    document.querySelector(
      '[data-current-user-detail]'
    );


  if (sidebarName) {

    sidebarName.textContent =
      user.fullName ||
      'CampusSphere member';

  }


  if (sidebarDetail) {

    const config =
      getRoleConfig(session.role);


    sidebarDetail.textContent =
      [
        config.label,
        user.college
      ]
        .filter(Boolean)
        .join(' · ');

  }


  document.body.dataset.role =
    session.role ||
    'STUDENT';

};


/* ============================================================
   RECOMMENDED PEOPLE
   ============================================================ */


const renderStudents =
  async session => {

    const studentList =
      document.querySelector(
        '.student-list'
      );


    if (!studentList) return;


    try {

      const result =
        await api(
          '/users?limit=4'
        );


      const users =
        safeArray(result)
          .filter(
            user =>
              user.id !== session.id
          )
          .slice(0, 3);


      studentList.innerHTML =
        users.length

          ? users
              .map(
                user => `

                  <article
                    data-user-id="${escapeHtml(user.id)}"
                  >

                    <img
                      src="${avatarUrl(user, 80)}"
                      alt="${escapeHtml(user.fullName)}"
                    >

                    <div>

                      <h3>
                        ${escapeHtml(user.fullName)}
                      </h3>

                      <p>
                        ${escapeHtml(
                          [
                            user.course,
                            user.year
                          ]
                            .filter(Boolean)
                            .join(' · ') ||
                          'CampusSphere member'
                        )}
                      </p>

                      <div class="chips">

                        ${safeArray(
                          user.skills
                        )
                          .slice(0, 3)
                          .map(
                            skill =>
                              `<b>${escapeHtml(skill)}</b>`
                          )
                          .join('')}

                      </div>

                      <small>
                        ${user.college
                          ? escapeHtml(user.college)
                          : ''}
                      </small>

                    </div>

                    <button
                      class="connect"
                      type="button"
                    >
                      View profile
                    </button>

                  </article>

                `
              )
              .join('')

          : '<p class="dashboard-empty">No recommendations yet.</p>';


      studentList.addEventListener(
        'click',
        event => {

          const item =
            event.target.closest(
              '[data-user-id]'
            );


          if (!item) return;


          window.location.assign(
            `profile.html?id=${encodeURIComponent(
              item.dataset.userId
            )}`
          );

        }
      );

    }

    catch (error) {

      studentList.innerHTML =
        `<p class="dashboard-empty">${escapeHtml(
          error?.message ||
          'Unable to load recommendations.'
        )}</p>`;

    }

  };


/* ============================================================
   EVENTS
   ============================================================ */


const renderEvents =
  dashboard => {

    const eventList =
      document.querySelector(
        '.upcoming'
      );


    if (!eventList) return;


    eventList
      .querySelector('.section-title a')
      ?.setAttribute(
        'href',
        'events.html'
      );


    eventList
      .querySelectorAll(
        'article, .dashboard-empty'
      )
      .forEach(
        item => item.remove()
      );


    const events =
      safeArray(
        dashboard.upcomingEvents
      );


    if (!events.length) {

      eventList.insertAdjacentHTML(
        'beforeend',
        `

          <div class="dashboard-empty-state">

            <span>◷</span>

            <b>
              Your calendar is clear
            </b>

            <small>
              Explore campus events and find something worth joining.
            </small>

            <a href="events.html">
              Explore events →
            </a>

          </div>

        `
      );


      return;

    }


    events.forEach(
      item => {

        const start =
          new Date(
            item.startDate
          );


        const article =
          document.createElement(
            'article'
          );


        article.tabIndex = 0;


        article.innerHTML = `

          <time>

            <b>
              ${start.getDate()}
            </b>

            ${new Intl.DateTimeFormat(
              'en',
              {
                month: 'short'
              }
            ).format(start)}

          </time>

          <div>

            <h3>
              ${escapeHtml(item.title)}
            </h3>

            <p>
              ${escapeHtml(
                item.venue || 'Campus'
              )}
              ·
              ${formatDate(item.startDate)}
            </p>

            <span>
              ${item._count?.participants || 0}
              going
            </span>

          </div>

        `;


        const openEvent = () =>
          window.location.assign(
            `event-details.html?id=${encodeURIComponent(
              item.id
            )}`
          );


        article.addEventListener(
          'click',
          openEvent
        );


        article.addEventListener(
          'keydown',
          event => {

            if (
              event.key === 'Enter'
            ) {

              openEvent();

            }

          }
        );


        eventList.append(article);

      }
    );

  };


/* ============================================================
   PROJECTS
   ============================================================ */


const renderProjects =
  dashboard => {

    const projectList =
      document.querySelector(
        '.projects'
      );


    if (!projectList) return;


    projectList
      .querySelector('.section-title a')
      ?.setAttribute(
        'href',
        'projects.html'
      );


    projectList
      .querySelectorAll(
        'article, .dashboard-empty'
      )
      .forEach(
        item => item.remove()
      );


    const projects =
      safeArray(
        dashboard.recommendedProjects
      );


    if (!projects.length) {

      projectList.insertAdjacentHTML(
        'beforeend',
        '<p class="dashboard-empty">No projects looking for teammates yet.</p>'
      );


      return;

    }


    projects.forEach(
      item => {

        const article =
          document.createElement(
            'article'
          );


        article.tabIndex = 0;


        const roles =
          safeArray(item.roles);


        const openings =
          roles.reduce(
            (
              total,
              role
            ) =>
              total +
              Number(
                role.openPositions || 0
              ),
            0
          );


        article.innerHTML = `

          <div class="project-logo">

            ${escapeHtml(
              (item.title || 'CS')
                .slice(0, 2)
                .toUpperCase()
            )}

          </div>

          <div class="project-body">

            <div>

              <h3>
                ${escapeHtml(item.title)}
              </h3>

              <span class="open">
                ${openings} open roles
              </span>

            </div>

            <p>
              ${escapeHtml(
                item.description || ''
              )}
            </p>

          </div>

        `;


        const openProject = () =>
          window.location.assign(
            `project-details.html?id=${encodeURIComponent(
              item.id
            )}`
          );


        article.addEventListener(
          'click',
          openProject
        );


        article.addEventListener(
          'keydown',
          event => {

            if (
              event.key === 'Enter'
            ) {

              openProject();

            }

          }
        );


        projectList.append(article);

      }
    );

  };


/* ============================================================
   CAMPUS ACTIVITY
   ============================================================ */


const renderActivity =
  dashboard => {

    const activityList =
      document.querySelector(
        '.activity'
      );


    if (!activityList) return;


    activityList
      .querySelector('.section-title a')
      ?.remove();


    activityList
      .querySelectorAll(
        'article, .dashboard-empty'
      )
      .forEach(
        item => item.remove()
      );


    const activities =
      safeArray(
        dashboard.recentActivity
      );


    if (!activities.length) {

      activityList.insertAdjacentHTML(
        'beforeend',
        '<p class="dashboard-empty">No recent campus activity yet.</p>'
      );


      return;

    }


    activities.forEach(
      post => {

        const article =
          document.createElement(
            'article'
          );


        article.tabIndex = 0;


        article.innerHTML = `

          <img
            src="${avatarUrl(post.author, 64)}"
            alt="${escapeHtml(
              post.author?.fullName ||
              'CampusSphere member'
            )}"
          >

          <p>

            <b>
              ${escapeHtml(
                post.author?.fullName ||
                'CampusSphere member'
              )}
            </b>

            shared an update

            <small>
              ${formatDate(post.createdAt)}
            </small>

          </p>

        `;


        article.addEventListener(
          'click',
          () => {

            if (post.communityId) {

              window.location.assign(
                `community-details.html?id=${encodeURIComponent(
                  post.communityId
                )}`
              );

            }

            else if (
              post.author?.id
            ) {

              window.location.assign(
                `profile.html?id=${encodeURIComponent(
                  post.author.id
                )}`
              );

            }

          }
        );


        activityList.append(article);

      }
    );

  };


/* ============================================================
   STUDENT ATTENDANCE ONLY
   Teacher/Admin must NOT call student-only attendance UI.
   ============================================================ */


const renderStudentAttendance =
  async session => {

    if (
      session.role !==
      'STUDENT'
    ) {
      return;
    }


    try {

      const attendance =
        await api(
          '/academic/attendance/summary'
        );


      if (
        !attendance?.overall?.total
      ) {

        return;

      }


      const academicCard =
        document.querySelector(
          '.role-academic-card'
        );


      academicCard
        ?.querySelector(
          '.role-academic-copy p'
        )
        ?.insertAdjacentHTML(
          'afterend',
          `

            <div class="role-academic-stat">

              Attendance

              <strong>
                ${escapeHtml(
                  String(
                    attendance.overall
                      .percentage
                  )
                )}%
              </strong>

            </div>

          `
        );

    }

    catch {

      /*
       Student may not yet have
       academic configuration.
       Dashboard should still work.
      */

    }

  };


/* ============================================================
   RANGE MENU
   ============================================================ */


const wireRangeMenu =
  dashboard => {

    const rangeButton =
      document.querySelector(
        '.range-wrap .outline-btn'
      );


    const rangeMenu =
      document.querySelector(
        '.range-menu'
      );


    if (
      !rangeButton ||
      !rangeMenu
    ) {

      return;

    }


    const applyRange =
      range => {

        const now =
          new Date();


        const end =
          new Date(now);


        if (
          range === 'today'
        ) {

          end.setHours(
            23,
            59,
            59,
            999
          );

        }

        else {

          end.setDate(
            end.getDate() +
            (
              range === 'week'
                ? 7
                : 30
            )
          );

        }


        document
          .querySelectorAll(
            '.upcoming article'
          )
          .forEach(
            (
              item,
              index
            ) => {

              const entry =
                safeArray(
                  dashboard.upcomingEvents
                )[index];


              item.hidden =
                !entry ||
                new Date(
                  entry.startDate
                ) > end;

            }
          );


        const age =

          range === 'today'
            ? 86400000

            : range === 'week'
              ? 604800000

              : 2592000000;


        document
          .querySelectorAll(
            '.activity article'
          )
          .forEach(
            (
              item,
              index
            ) => {

              const entry =
                safeArray(
                  dashboard.recentActivity
                )[index];


              item.hidden =
                !entry ||
                new Date(
                  entry.createdAt
                ) <
                new Date(
                  now.getTime() -
                  age
                );

            }
          );

      };


    rangeButton.addEventListener(
      'click',
      event => {

        event.stopPropagation();


        rangeMenu.hidden =
          !rangeMenu.hidden;


        rangeButton.setAttribute(
          'aria-expanded',
          String(
            !rangeMenu.hidden
          )
        );

      }
    );


    rangeMenu.addEventListener(
      'click',
      event => {

        const option =
          event.target.closest(
            '[data-range]'
          );


        if (!option) return;


        rangeMenu
          .querySelectorAll(
            'button'
          )
          .forEach(
            button =>
              button.setAttribute(
                'aria-selected',
                String(
                  button === option
                )
              )
          );


        rangeButton
          .querySelector('span')
          .textContent =
          option.textContent;


        applyRange(
          option.dataset.range
        );


        rangeMenu.hidden = true;


        rangeButton.setAttribute(
          'aria-expanded',
          'false'
        );

      }
    );


    document.addEventListener(
      'click',
      event => {

        if (
          !event.target.closest(
            '.range-wrap'
          )
        ) {

          rangeMenu.hidden = true;


          rangeButton.setAttribute(
            'aria-expanded',
            'false'
          );

        }

      }
    );


    applyRange('week');

  };


/* ============================================================
   MAIN
   ============================================================ */


const wireDashboard =
  async () => {

    const session =
      await restoreSession();


    if (!session) {

      window.location.assign(
        'login.html'
      );

      return;

    }


    /*
     * Platform-level admin remains
     * separate from College Admin.
     */

    if (
      session.role === 'ADMIN'
    ) {

      window.location.assign(
        'admin.html'
      );

      return;

    }


    /*
     * STUDENT
     * TEACHER
     * COLLEGE_ADMIN
     *
     * all remain on dashboard.html.
     */


  renderAcademicSpace(
  session
);

wireRoleAwareAcademics(
  session
);

wireSearch(
  session
);



    wireNavigation();


    wireHelp();


    /*
     * Dashboard API is treated as
     * enhancement data.
     *
     * If something optional fails,
     * the entire dashboard should
     * NOT crash.
     */

    let dashboard = {

      user: session,

      upcomingEvents: [],

      recommendedProjects: [],

      recentActivity: [],

      unreadNotifications: 0

    };


    try {

      const response =
        await api(
          '/dashboard'
        );


      dashboard = {

        ...dashboard,

        ...(response || {}),

        user:
          response?.user ||
          session

      };

    }

    catch (error) {

      console.warn(
        'Dashboard API:',
        error?.message
      );

    }


    renderIdentity(
      session,
      dashboard.user
    );


    const badge =
      document.querySelector(
        '.bell i'
      );


    if (badge) {

      badge.textContent =
        dashboard.unreadNotifications
          ? String(
              dashboard.unreadNotifications
            )
          : '';

    }


    await renderStudents(
      session
    );


    renderEvents(
      dashboard
    );


    renderProjects(
      dashboard
    );


    renderActivity(
      dashboard
    );


    await renderStudentAttendance(
      session
    );


    wireRangeMenu(
      dashboard
    );

  };
const wireRoleAwareAcademics = (session) => {

  const sidebarLink =
    document.querySelector(
      '.sidebar a[href="academics.html"]'
    );

  const academicCard =
    document.querySelector(
      '.role-academic-card'
    );


  let target =
    'academics.html';


  let title =
    'Open Academics';


  if (session.role === 'TEACHER') {

    target =
      'teacher-dashboard.html';

    title =
      'Open Teacher Academics';

  }


  else if (
    session.role === 'COLLEGE_ADMIN'
  ) {

    target =
      'college-admin.html';

    title =
      'Manage Institution Academics';

  }


  /*
   * Sidebar Academics button
   */

  if (sidebarLink) {

    sidebarLink.href =
      target;

    sidebarLink.title =
      title;

  }


  /*
   * Big center academic card
   */

  if (academicCard) {

    academicCard.href =
      target;

    academicCard.title =
      title;

  }

};
wireDashboard()
  .catch(
    error => {

      console.error(
        'CampusSphere dashboard error:',
        error
      );

    }
  );