import {
  api,
  escapeHtml,
  mediaUrl,
  restoreSession
} from './frontend-api.js';


const root =
  document.querySelector(
    '#profile-posts'
  );


const dateLabel =
  value =>
    new Intl.DateTimeFormat(
      'en-IN',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }
    ).format(
      new Date(value)
    );


const boot =
  async () => {

    if (!root) return;


    const session =
      await restoreSession();


    if (!session) return;


    const params =
      new URLSearchParams(
        window.location.search
      );


    const userId =
      params.get('id') ||
      session.id;


    try {

      const posts =
        await api(
          `/posts/user/${encodeURIComponent(
            userId
          )}`
        );


      if (!posts.length) {

        root.innerHTML = `

          <div class="profile-post-empty">

            No CampusSphere posts shared yet.

          </div>

        `;

        return;

      }


      root.innerHTML =
        posts.map(
          post => {

            const image =
              mediaUrl(
                post.image
              );


            return `

              <article class="profile-social-post">

                <p>
                  ${escapeHtml(
                    post.content || ''
                  )}
                </p>

                ${image
                  ? `
                      <img
                        src="${image}"
                        alt="Post attachment"
                      >
                    `
                  : ''
                }

                <footer>

                  <span>
                    ${escapeHtml(
                      dateLabel(
                        post.createdAt
                      )
                    )}
                  </span>

                  <span>
                    ${post._count.likes}
                    likes
                  </span>

                  <span>
                    ${post._count.comments}
                    comments
                  </span>

                </footer>

              </article>

            `;

          }
        ).join('');

    }

    catch (error) {

      root.innerHTML = `

        <div class="profile-post-empty">

          ${escapeHtml(
            error.message ||
            'Unable to load posts.'
          )}

        </div>

      `;

    }

  };


boot();