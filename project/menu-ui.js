// =========================================================
// THE BURIAL SHAFT — Splash Screen and Main Menu
// =========================================================

(function () {
    const overlayRoot = document.getElementById("ui-overlay-root");
    const splashScreen = document.getElementById("splash-screen");
    const mainMenu = document.getElementById("main-menu");
    const playButton = document.getElementById("play-button");

    if (!overlayRoot || !splashScreen || !mainMenu || !playButton) {
        console.error("Menu UI: Required HTML elements were not found.");
        return;
    }

    let hasLeftSplash = false;

    // Display one screen while hiding the other.
    function showScreen(screenToShow) {
        [splashScreen, mainMenu].forEach((screen) => {
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

    // Reopen the main menu from gameplay.
    window.addEventListener("burial:show-main-menu", () => {
        hasLeftSplash = true;

        overlayRoot.classList.remove("ui-hidden");
        showScreen(mainMenu);

        // Move keyboard focus into the menu.
        playButton.focus({ preventScroll: true });
    });

    // Start gameplay when Play is clicked.
    playButton.addEventListener("click", startGame);
})();