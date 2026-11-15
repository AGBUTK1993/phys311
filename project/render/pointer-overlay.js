// Display pointer coordinates and mark their location on the canvas.
export function drawPointerOverlay(ctx, camera, pointer) {
    if (pointer.position === null) return;

    const position = pointer.position;
    const screen = camera.toScreen(position);

    ctx.save();

    // Show the spring connecting the grabbed body to its target.
    const grabbedBody = pointer.spring?.body;

    if (grabbedBody) {
        const bodyScreen = camera.toScreen(grabbedBody.pos);
        const targetScreen = camera.toScreen(pointer.spring.target);

        // Dashed connection makes the active interaction visible.
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);

        ctx.beginPath();
        ctx.moveTo(bodyScreen.x, bodyScreen.y);
        ctx.lineTo(targetScreen.x, targetScreen.y);
        ctx.stroke();

        ctx.setLineDash([]);

        // Ring around the selected body's physical outline.
        ctx.beginPath();
        ctx.arc(
            bodyScreen.x,
            bodyScreen.y,
            grabbedBody.radius * camera.scale + 5,
            0,
            2 * Math.PI
        );
        ctx.stroke();

        ctx.fillStyle = "#222";
        ctx.font = "14px sans-serif";
        ctx.fillText(
            "Spring drag",
            targetScreen.x + 14,
            targetScreen.y - 14
        );
    }

    // Crosshair at the converted physics position.
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screen.x - 10, screen.y);
    ctx.lineTo(screen.x + 10, screen.y);
    ctx.moveTo(screen.x, screen.y - 10);
    ctx.lineTo(screen.x, screen.y + 10);
    ctx.stroke();

    // Coordinate readout, separate from the existing diagnostics.
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(12, 12, 420, 42);

    ctx.fillStyle = "#111";
    ctx.font = "16px monospace";
    ctx.fillText(
        `Pointer: x = ${position.x.toFixed(3)} m, ` +
        `y = ${position.y.toFixed(3)} m`,
        22,
        39
    );

    ctx.restore();
}