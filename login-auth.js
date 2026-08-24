import {
    api,
    restoreSession,
    workspaceUrl
} from "./frontend-api.js";


/* ============================================================
   ELEMENTS
   ============================================================ */

const signInTab =
    document.getElementById("signInTab");

const signUpTab =
    document.getElementById("signUpTab");

const signInPanel =
    document.getElementById("signInPanel");

const signUpPanel =
    document.getElementById("signUpPanel");

const openSignupButton =
    document.getElementById("openSignupButton");

const openSigninButton =
    document.getElementById("openSigninButton");

const authHeading =
    document.getElementById("authHeading");

const authSubheading =
    document.getElementById("authSubheading");

const authMessage =
    document.getElementById("authMessage");

const loginForm =
    document.getElementById("loginForm");

const signupForm =
    document.getElementById("signupForm");

const loginSubmitButton =
    document.getElementById("loginSubmitButton");

const signupSubmitButton =
    document.getElementById("signupSubmitButton");

const googleLoginButton =
    document.getElementById("googleLoginButton");

const googleButtonText =
    document.getElementById("googleButtonText");

const passwordInput =
    document.getElementById("password");

const togglePassword =
    document.getElementById("togglePassword");


/* ============================================================
   AUTH MODE
   ============================================================ */

let authMode = "signin";


function setAuthMode(mode) {

    authMode = mode;
document.body.classList.toggle(
    "signup-mode",
    mode === "signup"
);
    const signup =
        mode === "signup";


    signInTab?.classList.toggle(
        "switch-btn--active",
        !signup
    );

    signUpTab?.classList.toggle(
        "switch-btn--active",
        signup
    );


    signInPanel?.classList.toggle(
        "auth-panel-hidden",
        signup
    );

    signUpPanel?.classList.toggle(
        "auth-panel-hidden",
        !signup
    );


    if (signup) {

        if (authHeading) {

            authHeading.innerHTML =
                `Join <span>CampusSphere.</span>`;

        }

        if (authSubheading) {

            authSubheading.textContent =
                "Create your account and enter your campus network.";

        }

        if (googleButtonText) {

            googleButtonText.textContent =
                "Sign up with Google";

        }

    }

    else {

        if (authHeading) {

            authHeading.innerHTML =
                `Welcome <span>back.</span>`;

        }

        if (authSubheading) {

            authSubheading.textContent =
                "Sign in to see what's happening on your campus.";

        }

        if (googleButtonText) {

            googleButtonText.textContent =
                "Continue with Google";

        }

    }


    clearMessage();

}


/* ============================================================
   MODE EVENTS
   ============================================================ */

signInTab?.addEventListener(
    "click",
    () => setAuthMode("signin")
);

signUpTab?.addEventListener(
    "click",
    () => setAuthMode("signup")
);

openSignupButton?.addEventListener(
    "click",
    () => setAuthMode("signup")
);

openSigninButton?.addEventListener(
    "click",
    () => setAuthMode("signin")
);


/* ============================================================
   ERROR HANDLING
   ============================================================ */

function getErrorMessage(error) {

    if (!error) {

        return "Something went wrong.";

    }


    if (typeof error === "string") {

        return error;

    }


    if (
        typeof error.message === "string"
    ) {

        return error.message;

    }


    if (
        typeof error.error === "string"
    ) {

        return error.error;

    }


    if (
        typeof error.error?.message ===
        "string"
    ) {

        return error.error.message;

    }


    return "Something went wrong. Please try again.";

}


function showMessage(
    message,
    type = "error"
) {

    if (!authMessage) return;


    authMessage.textContent =
        getErrorMessage(message);


    authMessage.classList.remove(
        "hidden",
        "error",
        "success"
    );


    authMessage.classList.add(type);

}


function clearMessage() {

    if (!authMessage) return;


    authMessage.textContent = "";


    authMessage.classList.add(
        "hidden"
    );


    authMessage.classList.remove(
        "error",
        "success"
    );

}


/* ============================================================
   PASSWORD SHOW/HIDE
   ============================================================ */

togglePassword?.addEventListener(
    "click",
    () => {

        if (!passwordInput) return;


        const hidden =
            passwordInput.type ===
            "password";


        passwordInput.type =
            hidden
                ? "text"
                : "password";


        togglePassword.textContent =
            hidden
                ? "Hide"
                : "Show";

    }
);


/* ============================================================
   BUTTON LOADING
   ============================================================ */

function setLoginLoading(loading) {

    if (!loginSubmitButton) return;


    loginSubmitButton.disabled =
        loading;


    loginSubmitButton.innerHTML =
        loading

            ? `<span>Logging in...</span>`

            : `
                <span>
                    Log in to CampusSphere
                </span>

                <span>→</span>
              `;

}


function setSignupLoading(loading) {

    if (!signupSubmitButton) return;


    signupSubmitButton.disabled =
        loading;


    signupSubmitButton.innerHTML =
        loading

            ? `<span>Creating account...</span>`

            : `
                <span>
                    Create CampusSphere account
                </span>

                <span>→</span>
              `;

}


/* ============================================================
   ACCESS TOKEN
   ============================================================ */

function saveAccessToken(accessToken) {

    if (!accessToken) return;


    /*
     * frontend-api.js already reads its
     * access token from localStorage.
     */

localStorage.setItem(
    "campussphere_access_token",
    accessToken
);

}


/* ============================================================
   REDIRECT AFTER AUTH
   ============================================================ */

function redirectUser(user) {

    if (!user) {

        window.location.assign(
            "dashboard.html"
        );

        return;
    }


    /*
     * Use the existing shared
     * workspaceUrl() helper.
     */

    if (
        typeof workspaceUrl ===
        "function"
    ) {

        window.location.assign(
            workspaceUrl(user.role)
        );

        return;

    }


    const role =
        String(
            user.role || ""
        ).toUpperCase();


    if (role === "TEACHER") {

        window.location.assign(
            "teacher-dashboard.html"
        );

    }

    else if (
        role === "COLLEGE_ADMIN"
    ) {

        window.location.assign(
            "college-admin.html"
        );

    }

    else {

        window.location.assign(
            "dashboard.html"
        );

    }

}


/* ============================================================
   LOGIN
   ============================================================ */

loginForm?.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearMessage();


        const email =
            document
                .getElementById("email")
                ?.value
                .trim();


        const password =
            document
                .getElementById("password")
                ?.value;


        if (!email || !password) {

            showMessage(
                "Enter your email and password."
            );

            return;
        }


        setLoginLoading(true);


        try {

            const data =
                await api(
                    "/auth/login",
                    {

                        method: "POST",

                        body:
                            JSON.stringify({
                                email,
                                password
                            })

                    }
                );


            saveAccessToken(
                data?.accessToken
            );


            showMessage(
                "Welcome back. Redirecting...",
                "success"
            );


            setTimeout(
                () => {

                    redirectUser(
                        data?.user
                    );

                },
                350
            );

        }

        catch (error) {

            console.error(
                "CampusSphere login error:",
                error
            );


            showMessage(error);

        }

        finally {

            setLoginLoading(false);

        }

    }
);


/* ============================================================
   REGISTER
   ============================================================ */

signupForm?.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearMessage();


        const fullName =
            document
                .getElementById(
                    "signupName"
                )
                ?.value
                .trim();


        const email =
            document
                .getElementById(
                    "signupEmail"
                )
                ?.value
                .trim();


        const college =
            document
                .getElementById(
                    "signupCollege"
                )
                ?.value
                .trim();


        const course =
            document
                .getElementById(
                    "signupCourse"
                )
                ?.value
                .trim();


        const year =
            document
                .getElementById(
                    "signupYear"
                )
                ?.value;


        const interestsText =
            document
                .getElementById(
                    "signupInterests"
                )
                ?.value
                .trim();


        const password =
            document
                .getElementById(
                    "signupPassword"
                )
                ?.value;


        const confirmPassword =
            document
                .getElementById(
                    "signupConfirmPassword"
                )
                ?.value;


        const termsAccepted =
            document
                .getElementById(
                    "signupTerms"
                )
                ?.checked;


        /* --------------------------------------------
           VALIDATE
           -------------------------------------------- */

        if (
            !fullName ||
            !email ||
            !college ||
            !course ||
            !year ||
            !password
        ) {

            showMessage(
                "Complete all required fields."
            );

            return;
        }


        if (password.length < 8) {

            showMessage(
                "Password must be at least 8 characters."
            );

            return;
        }


        if (
            password !==
            confirmPassword
        ) {

            showMessage(
                "Passwords do not match."
            );

            return;
        }


        if (!termsAccepted) {

            showMessage(
                "Please accept the Terms & Privacy Policy."
            );

            return;
        }


        const interests =
            interestsText

                ? interestsText
                    .split(",")
                    .map(
                        value =>
                            value.trim()
                    )
                    .filter(Boolean)

                : [];


        setSignupLoading(true);


        try {

            /*
             * Exact backend payload confirmed
             * from registerSchema test.
             */

            const data =
                await api(
                    "/auth/register",
                    {

                        method: "POST",

                        body:
                            JSON.stringify({

                                fullName,

                                email,

                                password,

                                college,

                                course,

                                year,

                                interests

                            })

                    }
                );


            saveAccessToken(
                data?.accessToken
            );


            showMessage(
                "Your CampusSphere account is ready. Redirecting...",
                "success"
            );


            setTimeout(
                () => {

                    redirectUser(
                        data?.user
                    );

                },
                400
            );

        }

        catch (error) {

            console.error(
                "CampusSphere registration error:",
                error
            );


            showMessage(error);

        }

        finally {

            setSignupLoading(false);

        }

    }
);


/* ============================================================
   GOOGLE SIGN-IN
   ============================================================ */

let googleInitialized = false;


/* ------------------------------------------------------------
   SEND GOOGLE CREDENTIAL TO CAMPUSSPHERE BACKEND
   ------------------------------------------------------------ */

async function authenticateGoogle(credential) {

    if (!credential) {

        showMessage(
            "Google did not return a valid credential."
        );

        return;
    }


    clearMessage();


    try {

        const data =
            await api(
                "/auth/google",
                {
                    method: "POST",

                    body:
                        JSON.stringify({
                            credential
                        })
                }
            );


        saveAccessToken(
            data?.accessToken
        );


        showMessage(
            "Google sign-in successful. Redirecting...",
            "success"
        );


        setTimeout(() => {

            redirectUser(
                data?.user
            );

        }, 350);

    }

    catch (error) {

        console.error(
            "CampusSphere Google authentication error:",
            error
        );


        showMessage(error);

    }

}


/* ------------------------------------------------------------
   INITIALIZE GOOGLE IDENTITY SERVICES
   ------------------------------------------------------------ */

async function initializeGoogle() {

    const googleContainer =
        document.getElementById(
            "googleButtonContainer"
        );


    if (!googleContainer) {

        console.error(
            "Google button container not found."
        );

        return;
    }


    try {

        /*
         * Get the real Client ID from CampusSphere backend.
         */

        const config =
            await api(
                "/auth/google/config"
            );


        const clientId =
            config?.clientId;


        console.log(
            "Google config loaded:",
            Boolean(clientId)
        );


        if (!clientId) {

            showMessage(
                "Google Sign-In is not configured on the CampusSphere server."
            );

            return;
        }


        /*
         * Wait until Google's GIS library is loaded.
         */

        let attempts = 0;


        const waitForGoogle =
            setInterval(() => {

                attempts++;


                if (
                    window.google
                        ?.accounts
                        ?.id
                ) {

                    clearInterval(
                        waitForGoogle
                    );


                    window.google
                        .accounts
                        .id
                        .initialize({

                            client_id:
                                clientId,

                            callback:
                                response => {

                                    console.log(
                                        "Google credential received:",
                                        Boolean(
                                            response
                                                ?.credential
                                        )
                                    );


                                    authenticateGoogle(
                                        response
                                            ?.credential
                                    );

                                }

                        });


                    /*
                     * Render Google's real account chooser button.
                     */

                    googleContainer.innerHTML =
                        "";


                    window.google
                        .accounts
                        .id
                        .renderButton(

                            googleContainer,

                            {
                                type:
                                    "standard",

                                theme:
                                    "filled_black",

                                size:
                                    "large",

                                text:
                                    authMode ===
                                    "signup"

                                        ? "signup_with"

                                        : "continue_with",

                                shape:
                                    "pill",

                                logo_alignment:
                                    "left",

                                width:
                                    400
                            }

                        );


                    googleInitialized =
                        true;


                    console.log(
                        "Google Sign-In initialized."
                    );

                }


                if (attempts >= 50) {

                    clearInterval(
                        waitForGoogle
                    );


                    if (!googleInitialized) {

                        showMessage(
                            "Google Sign-In could not load. Please refresh the page."
                        );

                    }

                }

            }, 100);

    }

    catch (error) {

        console.error(
            "Google configuration error:",
            error
        );


        showMessage(
            getErrorMessage(error)
        );

    }

}
/* ============================================================
   RESTORE EXISTING SESSION
   ============================================================ */

async function checkExistingSession() {

    try {

        const user =
            await restoreSession();


        if (user) {

            redirectUser(user);

        }

    }

    catch {

        /*
         * Not logged in.
         * Remain on this page.
         */

    }

}


/* ============================================================
   START
   ============================================================ */

setAuthMode("signin");

initializeGoogle();

checkExistingSession();