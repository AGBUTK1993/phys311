// =========================================================
// THE BURIAL SHAFT — Splash Screen and Main Menu
// =========================================================

(function () {
    const overlayRoot = document.getElementById("ui-overlay-root");
    const splashScreen = document.getElementById("splash-screen");
    const mainMenu = document.getElementById("main-menu");
    const playButton = document.getElementById("play-button");

    const levelSelectButton =
        document.getElementById("level-select-button");

    const chamberSelect =
        document.getElementById("chamber-select");

    const chamberBackButton =
        document.getElementById("chamber-back-button");

    // Preview images are optional until the chambers are finalized.
    function initializeChamberPreviews() {
        chamberSelect.querySelectorAll(".chamber-card").forEach(
            (card) => {
                const path = card.dataset.preview?.trim();
                if (!path) return;

                const preview = card.querySelector(".chamber-preview");
                if (!preview) return;

                const image = document.createElement("img");
                image.alt = `Preview of ${card.querySelector("h2")?.textContent || "chamber"}`;
                image.loading = "lazy";

                image.addEventListener("load", () => {
                    preview.replaceChildren(image);
                });

                image.addEventListener("error", () => {
                    console.warn("Chamber preview unavailable:", path);
                });

                image.src = path;
            }
        );
    }

    initializeChamberPreviews();

    if (!overlayRoot || !splashScreen || !mainMenu || !playButton) {
        console.error("Menu UI: Required HTML elements were not found.");
        return;
    }

    let hasLeftSplash = false;

    // Display one screen while hiding the other.
    function showScreen(screenToShow) {
        [splashScreen, mainMenu, chamberSelect].forEach((screen) => {
            screen.classList.remove("active");
        });

        screenToShow.classList.add("active");
    }

    // Transition from the developer splash to the main menu.
    function leaveSplash() {
        if (hasLeftSplash) return;

        hasLeftSplash = true;
        showScreen(mainMenu);
    }

    // Hide the menu overlay and reveal the existing game.
    function startGame() {
        // Hide the splash/main-menu interface.
        overlayRoot.classList.add("ui-hidden");

        // Tell the simulation to resume its current chamber.
        window.dispatchEvent(new Event("burial:resume-game"));

        // Immediately return keyboard focus to gameplay.
        const canvas = document.getElementById("sim");

        if (canvas) {
            canvas.focus({ preventScroll: true });
        }
    }

    // Automatically advance after 6 seconds.
    //setTimeout(leaveSplash, 6000);

    // Let players skip the splash by clicking.
    splashScreen.addEventListener("click", leaveSplash);

    // Handle menu keyboard input before gameplay shortcuts.
    window.addEventListener("keydown", (event) => {
        // Once gameplay starts, let the existing controls work.
        if (overlayRoot.classList.contains("ui-hidden")) {
            return;
        }

        // Preserve browser shortcuts such as Ctrl+R.
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        // Prevent the underlying game from receiving this key.
        event.stopImmediatePropagation();

        // Allow normal keyboard focus navigation.
        if (event.key === "Tab") {
            return;
        }

        // Any ordinary key can dismiss the splash.
        if (!hasLeftSplash) {
            event.preventDefault();
            leaveSplash();
            return;
        }

        // Escape returns from chamber selection to the main menu.
        if (
            chamberSelect.classList.contains("active") &&
            event.key === "Escape"
        ) {
            event.preventDefault();
            returnToMainMenu();
            return;
        }

        // Let focused chamber cards and Back respond to Enter/Space.
        if (chamberSelect.classList.contains("active")) {
            return;
        }

        // Enter or Space starts gameplay from the main menu.
        if (
            mainMenu.classList.contains("active") &&
            (event.key === "Enter" || event.key === " ") &&
            !event.repeat
        ) {
            event.preventDefault();
            startGame();
        }
    }, { capture: true });

    // Open the full-window chamber-selection screen.
    window.addEventListener("burial:show-level-select", () => {
        hasLeftSplash = true;

        overlayRoot.classList.remove("ui-hidden");
        showScreen(chamberSelect);

        // Give keyboard focus to the first chamber card.
        const firstCard = chamberSelect.querySelector(".chamber-card");

        if (firstCard) {
            firstCard.focus({ preventScroll: true });
        }
    });
    window.dispatchEvent(
        new Event("burial:request-progress")
    );

    // Development feature flags.
    // Keep locking disabled so every chamber remains testable.
    const GAME_FEATURES = Object.freeze({
        enforceLevelUnlocks: false // true = only unlock next chamber after completing the previous one
    });

    // Keep completion indicators synchronized with the simulation.
    const completedChamberIds = new Set();

    window.addEventListener("burial:progress-updated", (event) => {
        completedChamberIds.clear();

        for (const id of event.detail?.completedIds || []) {
            completedChamberIds.add(id);
        }

        updateChamberCards();
    });

    function updateChamberCards() {
        const cards = [
            ...chamberSelect.querySelectorAll(".chamber-card")
        ];

        cards.forEach((card, index) => {
            const completed =
                completedChamberIds.has(card.dataset.levelId);

            // Chamber 1 is always available.
            // Later chambers unlock when the previous one is completed.
            const previousId =
                index > 0 ? cards[index - 1].dataset.levelId : null;

            const unlocked =
                !GAME_FEATURES.enforceLevelUnlocks ||
                index === 0 ||
                completed ||
                completedChamberIds.has(previousId);

            card.disabled = !unlocked;

            const status =
                card.querySelector(".chamber-card-info span");

            if (status) {
                status.textContent = completed
                    ? "Completed ✓"
                    : unlocked
                        ? "Available"
                        : "Locked";
            }

            card.classList.toggle(
                "chamber-completed",
                completed
            );

            card.classList.toggle(
                "chamber-locked",
                !unlocked
            );
        });
    }

    // Initialize the cards before progress has been reported.
    updateChamberCards();

    // Reopen the main menu from gameplay.
    window.addEventListener("burial:show-main-menu", () => {
        hasLeftSplash = true;

        overlayRoot.classList.remove("ui-hidden");
        showScreen(mainMenu);

        // Move keyboard focus into the menu.
        playButton.focus({ preventScroll: true });
    });

    // Open the chamber-selection screen.
    levelSelectButton.addEventListener("click", () => {
        showScreen(chamberSelect);
        chamberBackButton.focus({ preventScroll: true });

        window.dispatchEvent(
            new Event("burial:request-progress")
        );
    });

    // Return from chamber selection to the main menu.
    function returnToMainMenu() {
        showScreen(mainMenu);
        levelSelectButton.focus({ preventScroll: true });
    }

    chamberBackButton.addEventListener(
        "click",
        returnToMainMenu
    );

    // Start a selected chamber from its initial conditions.
    chamberSelect.querySelectorAll(".chamber-card").forEach(
        (card) => {
            card.addEventListener("click", () => {
                const index = Number(card.dataset.chamber);

                // Ignore missing or invalid chamber identifiers.
                if (!Number.isInteger(index) || index < 0) {
                    console.warn("Invalid chamber selection:", index);
                    return;
                }

                // Ask the simulation to initialize this chamber.
                window.dispatchEvent(
                    new CustomEvent("burial:start-chamber", {
                        detail: { index }
                    })
                );

                // Enter gameplay and restore keyboard focus.
                startGame();
            });
        }
    );

    // Start gameplay when Play is clicked.
    playButton.addEventListener("click", startGame);
})();