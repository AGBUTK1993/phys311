// Draw an analytical free-flight prediction.
// This overlay never changes the simulated world.
export function drawLaunchOverlay(
    ctx,
    camera,
    launcher,
    world,
    gravity
) {
    if (!launcher.start || !launcher.end || !world.bounds) return;

    const start = launcher.start;
    const velocity = launcher.getVelocity();
    const radius = 0.2;
    const bounds = world.bounds;

    const insideBox = (position) =>
        position.x >= bounds.xMin + radius &&
        position.x <= bounds.xMax - radius &&
        position.y >= bounds.yMin + radius &&
        position.y <= bounds.yMax - radius;

    const overlaps = world.bodies.some((body) =>
        Math.hypot(
            start.x - body.pos.x,
            start.y - body.pos.y
        ) < radius + body.radius
    );

    const valid =
        insideBox(start) &&
        !overlaps &&
        world.bodies.length < 250;

    const startScreen = camera.toScreen(start);
    const pullScreen = camera.toScreen(launcher.end);

    ctx.save();
    ctx.lineWidth = 2;

    // The pull line points backward from the launch direction.
    ctx.strokeStyle = "#555";
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(pullScreen.x, pullScreen.y);
    ctx.stroke();

    // Outline the proposed new ball.
    ctx.setLineDash([]);
    ctx.strokeStyle = valid ? "#005a9c" : "#a40000";
    ctx.beginPath();
    ctx.arc(
        startScreen.x,
        startScreen.y,
        radius * camera.scale,
        0,
        2 * Math.PI
    );
    ctx.stroke();

    if (valid) {
        // Up to three simulated seconds, stopping near a wall.
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(startScreen.x, startScreen.y);

        for (let i = 1; i <= 90; i++) {
            const t = i / 30;

            const predicted = {
                x: start.x + velocity.x * t,
                y: start.y + velocity.y * t
                    - 0.5 * gravity * t * t,
            };

            if (!insideBox(predicted)) break;

            const screen = camera.toScreen(predicted);
            ctx.lineTo(screen.x, screen.y);
        }

        ctx.stroke();
    }

    ctx.setLineDash([]);

    // Text also communicates validity, independent of color.
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.fillRect(12, 62, 490, 62);

    ctx.fillStyle = "#111";
    ctx.font = "15px sans-serif";

    ctx.fillText(
        valid
            ? `Launch speed: ${Math.hypot(
                velocity.x, velocity.y
            ).toFixed(2)} m/s — release to launch`
            : "Cannot launch here: use empty space inside the box.",
        22,
        86
    );

    ctx.fillText(
        "Free-flight preview: up to 3 s; ball collisions not predicted.",
        22,
        110
    );

    ctx.restore();
}