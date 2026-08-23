document.addEventListener("DOMContentLoaded", () => {

    gsap.registerPlugin(ScrollTrigger);


    /* ========================================================
       REDUCED MOTION
       ======================================================== */

    const reducedMotion =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

    if (reducedMotion) {
        return;
    }


    /* ========================================================
       LENIS
       ======================================================== */

    const lenis = new Lenis({
        autoRaf: false,
        smoothWheel: true
    });


    lenis.on("scroll", ScrollTrigger.update);


    gsap.ticker.add((time) => {

        lenis.raf(time * 1000);

    });


    gsap.ticker.lagSmoothing(0);


    /* ========================================================
       INITIAL STATES
       ======================================================== */

    gsap.set(".csx-arrival", {
    opacity: 1,
    scale: 1.04
});

gsap.set(".csx-approach", {
    opacity: 0,
    scale: 1.02
});

gsap.set(".csx-entrance", {
    opacity: 0,
    scale: 1.03
});s

    gsap.set(".csx-intro", {
        opacity: 1,
        y: 0
    });


    gsap.set(".csx-approach-copy", {
        opacity: 0,
        y: 30
    });


    gsap.set(".csx-portal", {
        opacity: 0
    });


    gsap.set(".csx-portal-core", {
        scaleX: 0.08
    });


    gsap.set(".csx-portal-halo", {
        opacity: 0,
        scale: 0.5
    });


    gsap.set(".csx-digital-world", {
        opacity: 0
    });


    gsap.set(".csx-core", {
        scale: 0.62,
        opacity: 0
    });


    gsap.set(".csx-feature", {
        opacity: 0,
        scale: 0.84
    });


    gsap.set(".csx-person", {
        opacity: 0,
        y: 60
    });


    gsap.set(".csx-beyond", {
        opacity: 0
    });


    /* ========================================================
       PROGRESS NAVIGATION
       ======================================================== */

    const steps =
        [...document.querySelectorAll(".csx-step")];

    const progressFill =
        document.querySelector(".csx-progress-fill");


    function setActiveStep(progress) {

        const index =
            Math.min(
                4,
                Math.floor(progress * 5)
            );


        steps.forEach((step, i) => {

            step.classList.toggle(
                "is-active",
                i === index
            );

        });


        if (progressFill) {

            progressFill.style.height =
                `${progress * 100}%`;

        }

    }


    /* ========================================================
       MASTER TIMELINE
       ======================================================== */

    const tl =
        gsap.timeline({

            scrollTrigger: {

                trigger:
                    ".csx-story",

                start:
                    "top top",

                end:
                    "bottom bottom",

                scrub:
                    1.15,

                onUpdate:
                    (self) =>
                        setActiveStep(
                            self.progress
                        )

            }

        });


    /* ========================================================
       01 — ARRIVAL
       ======================================================== */

    tl.to(
        ".csx-arrival",
        {
            scale: 1.10,
            duration: 1.2,
            ease: "none"
        }
    );


    tl.to(
        ".csx-intro",
        {
            opacity: 0,
            y: -45,
            duration: 0.65
        },
        "-=0.35"
    );


    /* ========================================================
   02 — APPROACH
   ======================================================== */

tl.to(
    ".csx-approach-copy",
    {
        opacity: 1,
        y: 0,
        duration: 0.55
    }
);

tl.to(
    ".csx-arrival",
    {
        scale: 1.14,
        duration: 1,
        ease: "none"
    },
    "<"
);

tl.to(
    ".csx-scroll",
    {
        opacity: 0,
        duration: 0.3
    },
    "<"
);

/* FADE TO MIDDLE CAMPUS IMAGE */

tl.to(
    ".csx-approach",
    {
        opacity: 1,
        scale: 1.05,
        duration: 0.9
    },
    "-=0.2"
);

tl.to(
    ".csx-arrival",
    {
        opacity: 0,
        duration: 0.7
    },
    "<"
);

tl.to(
    ".csx-approach",
    {
        scale: 1.14,
        duration: 1.15,
        ease: "none"
    }
);

tl.to(
    ".csx-approach-copy",
    {
        opacity: 0,
        y: -30,
        duration: 0.45
    }
);


/* ========================================================
   03 — ENTER
   ======================================================== */

tl.to(
    ".csx-entrance",
    {
        opacity: 1,
        scale: 1.05,
        duration: 0.85
    },
    "-=0.1"
);

tl.to(
    ".csx-approach",
    {
        opacity: 0,
        duration: 0.65
    },
    "<"
);

tl.to(
    ".csx-entrance",
    {
        scale: 1.16,
        duration: 1.1,
        ease: "none"
    }
);


    /* PORTAL STARTS */

    tl.to(
        ".csx-portal",
        {
            opacity: 1,
            duration: 0.25
        }
    );


    tl.to(
        ".csx-portal-core",
        {
            scaleX: 1,
            scaleY: 1.12,
            duration: 0.85,
            ease: "power2.inOut"
        }
    );


    tl.to(
        ".csx-portal-halo",
        {
            opacity: 1,
            scale: 1.5,
            duration: 0.85
        },
        "<"
    );


    /* CAMERA ENTERS PORTAL */

    tl.to(
        ".csx-entrance",
        {
            scale: 1.62,
            opacity: 0,
            duration: 1,
            ease: "power2.in"
        }
    );


    tl.to(
        ".csx-portal",
        {
            scale: 3.2,
            opacity: 0,
            duration: 0.9,
            ease: "power3.in"
        },
        "<"
    );


    /* ========================================================
       04 — CONNECT
       ======================================================== */

    tl.to(
        ".csx-digital-world",
        {
            opacity: 1,
            duration: 0.45
        },
        "-=0.15"
    );


    tl.to(
        ".csx-core",
        {
            opacity: 1,
            scale: 1,
            duration: 0.8,
            ease: "back.out(1.4)"
        }
    );


    tl.to(
        ".csx-person",
        {
            opacity: 1,
            y: 0,
            stagger: 0.08,
            duration: 0.55
        },
        "-=0.35"
    );


    tl.to(
        ".csx-feature",
        {
            opacity: 1,
            scale: 1,
            stagger: 0.12,
            duration: 0.65,
            ease: "back.out(1.3)"
        },
        "-=0.20"
    );


    /* DIGITAL WORLD BREATHES */

    tl.to(
        ".csx-core",
        {
            scale: 1.07,
            duration: 1
        }
    );


    tl.to(
        ".csx-feature",
        {
            y: -8,
            duration: 1
        },
        "<"
    );


    /* ========================================================
       05 — BEYOND
       ======================================================== */

    tl.to(
        ".csx-feature",
        {
            opacity: 0,
            scale: 0.82,
            duration: 0.55
        }
    );


    tl.to(
        ".csx-person",
        {
            opacity: 0,
            duration: 0.4
        },
        "<"
    );


    tl.to(
        ".csx-core",
        {
            scale: 2.5,
            opacity: 0,
            duration: 0.8,
            ease: "power2.in"
        },
        "<"
    );


    tl.to(
        ".csx-digital-world",
        {
            opacity: 0,
            duration: 0.35
        }
    );


    tl.to(
        ".csx-beyond",
        {
            opacity: 1,
            duration: 0.8
        }
    );


    tl.from(
        ".csx-beyond > span",
        {
            opacity: 0,
            y: 20,
            duration: 0.5
        },
        "-=0.45"
    );


    tl.from(
        ".csx-beyond h2",
        {
            opacity: 0,
            y: 55,
            scale: 0.94,
            duration: 0.85,
            ease: "power3.out"
        },
        "-=0.25"
    );


    tl.from(
        ".csx-final-rings",
        {
            opacity: 0,
            scale: 0.55,
            duration: 0.9
        },
        "-=0.7"
    );
/* ========================================================
   NAVIGATION THEME
   ======================================================== */

const navShell =
    document.querySelector(".cs-nav-shell");

const cinematic =
    document.querySelector(".csx-story");

if (navShell && cinematic) {

    ScrollTrigger.create({

        trigger: cinematic,

        start: "top top",

        end: "bottom top",

        onEnter: () => {
            navShell.classList.add("is-dark");
        },

        onEnterBack: () => {
            navShell.classList.add("is-dark");
        },

        onLeave: () => {
            navShell.classList.remove("is-dark");
        },

        onLeaveBack: () => {
            navShell.classList.remove("is-dark");
        }

    });

}

});s