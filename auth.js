const initialiseAuthentication = () => {
  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = button.closest('.password-label')?.querySelector('input[type="password"], input[type="text"]');
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      button.textContent = isPassword ? 'Hide' : 'Show';
    });
  });

  document.querySelectorAll('.interest-group button').forEach((button) => {
    button.addEventListener('click', () => button.classList.toggle('selected'));
  });

  const form = document.querySelector('#login-form, #signup-form');
  if (!form) return;

  const isSignup = form.id === 'signup-form';
  const emailInput = form.querySelector(isSignup ? '#signup-email' : '#login-email');
  const passwordInput = form.querySelector(isSignup ? '#signup-password' : '#login-password');
  const submitButton = form.querySelector('.submit');
  const errorArea = form.querySelector('#auth-error');

  if (!emailInput || !passwordInput || !submitButton || !errorArea) {
    console.error('CampusSphere authentication form is missing a required field.');
    return;
  }

  const showError = (message) => {
    errorArea.textContent = message;
    errorArea.hidden = false;
  };
  const clearError = () => {
    errorArea.textContent = '';
    errorArea.hidden = true;
    form.querySelectorAll('.invalid').forEach((label) => label.classList.remove('invalid'));
  };
  const setBusy = (busy) => {
    submitButton.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
    submitButton.textContent = busy ? 'Please wait...' : (isSignup ? 'Create my account →' : 'Log in to CampusSphere →');
  };

  const googleContainer = document.querySelector('[data-google-auth]');
  if (googleContainer) {
    const waitForGoogle = async () => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (window.google?.accounts?.id) return window.google.accounts.id;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error('Google sign-in could not load. Check your connection and try again.');
    };
    (async () => {
      try {
        if (!window.CampusSphereAPI) throw new Error('The authentication service is unavailable.');
        const [{ clientId }, googleIdentity] = await Promise.all([window.CampusSphereAPI.googleConfig(), waitForGoogle()]);
        googleIdentity.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            clearError();
            try {
              googleContainer.setAttribute('aria-busy', 'true');
              const response = await window.CampusSphereAPI.googleLogin(credential);
              if (!response?.accessToken) throw new Error('The server did not return a login token.');
              localStorage.setItem('campussphere_access_token', response.accessToken);
              window.location.assign('dashboard.html');
            } catch (error) {
              showError(error instanceof Error ? error.message : 'Unable to sign in with Google.');
            } finally { googleContainer.setAttribute('aria-busy', 'false'); }
          }
        });
        googleIdentity.renderButton(googleContainer, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: Math.min(410, Math.round(googleContainer.getBoundingClientRect().width || 410)) });
      } catch (error) { showError(error instanceof Error ? error.message : 'Google sign-in is unavailable.'); }
    })();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      showError('Enter both your email address and password.');
      if (!email) emailInput.closest('label')?.classList.add('invalid');
      if (!password) passwordInput.closest('label')?.classList.add('invalid');
      return;
    }
    if (!emailInput.validity.valid) {
      emailInput.closest('label')?.classList.add('invalid');
      showError('Enter a valid email address.');
      return;
    }
    if (isSignup && password.length < 8) {
      passwordInput.closest('label')?.classList.add('invalid');
      showError('Password must contain at least 8 characters.');
      return;
    }

    let payload;
    if (isSignup) {
      const fullNameInput = form.querySelector('#signup-name');
      const collegeInput = form.querySelector('#signup-college');
      const courseInput = form.querySelector('#signup-course');
      const yearInput = form.querySelector('#signup-year');
      const termsInput = form.querySelector('.check input[required]');
      if (!fullNameInput || !collegeInput || !courseInput || !yearInput || !termsInput) {
        console.error('CampusSphere signup form is missing a required field.');
        showError('The signup form is unavailable. Please refresh and try again.');
        return;
      }
      if (!fullNameInput.value.trim() || !collegeInput.value || !courseInput.value.trim() || !yearInput.value || !termsInput.checked) {
        showError('Complete all required profile fields and accept the Terms and Privacy Policy.');
        return;
      }
      const yearValues = { '1st year': 'FIRST', '2nd year': 'SECOND', '3rd year': 'THIRD', '4th year': 'FOURTH', postgraduate: 'POSTGRADUATE' };
      const year = yearValues[yearInput.value.trim().toLowerCase()];
      if (!year) {
        showError('Select a valid year of study.');
        return;
      }
      const interests = [...form.querySelectorAll('.interest-group button.selected')].map((button) => button.textContent.trim());
      payload = {
        fullName: fullNameInput.value.trim(), email, password,
        college: collegeInput.value, course: courseInput.value.trim(),
        year, interests
      };
    }

    if (!window.CampusSphereAPI) {
      showError('The authentication service is unavailable. Please refresh and try again.');
      return;
    }

    try {
      setBusy(true);
      const response = isSignup
        ? await window.CampusSphereAPI.register(payload)
        : await window.CampusSphereAPI.login(email, password);
      if (!response?.accessToken) throw new Error('The server did not return a login token.');
      localStorage.setItem('campussphere_access_token', response.accessToken);
      window.location.assign('dashboard.html');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Unable to reach CampusSphere. Please try again.');
    } finally {
      setBusy(false);
    }
  });
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialiseAuthentication, { once: true });
else initialiseAuthentication();
