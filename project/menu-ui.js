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
        overlayRoot.classList.add("ui-hidden");
    }

    // Automatically advance after 6 seconds.
    //setTimeout(leaveSplash, 6000);

    // Let players skip the splash by clicking.
    splashScreen.addEventListener("click", leaveSplash);

    // Keyboard navigation.
    window.addEventListener("keydown", (event) => {
        if (!hasLeftSplash) {
            leaveSplash();
            return;
        }

        if (mainMenu.classList.contains("active")) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                startGame();
            }
        }
    });

    // Start gameplay when Play is clicked.
    playButton.addEventListener("click", startGame);
})();