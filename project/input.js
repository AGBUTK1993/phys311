import { MouseSpring } from "./engine/forces.js";

export function eventToWorld(event, canvas, camera) {
    const rect = canvas.getBoundingClientRect();

    const px =
        (event.clientX - rect.left) * canvas.logicalWidth / rect.width;

    const py =
        (event.clientY - rect.top) * canvas.logicalHeight / rect.height;

    return camera.toWorld({ x: px, y: py });
}

export class PointerInput {
    constructor(canvas, camera, {
        getWorld,
        canDrag,
        onDragStart,
    }) {
        this.position = null;
        this.lastClick = null;
        // Temporary B1 comparison. Restore to false after testing.
        const teleportDemo = false;

        this.spring = new MouseSpring(
            teleportDemo ? 0 : 20,
            teleportDemo ? 0 : 4
        );

        let activePointerId = null;

        const updatePosition = (event) => {
            this.position = eventToWorld(event, canvas, camera);
        };

        const release = () => {
            const pointerId = activePointerId;
            activePointerId = null;

            this.spring.release();

            if (
                pointerId !== null &&
                canvas.hasPointerCapture(pointerId)
            ) {
                canvas.releasePointerCapture(pointerId);
            }
        };

        canvas.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || activePointerId !== null) return;

            updatePosition(event);
            this.lastClick = { ...this.position };

            console.log(
                `Clicked world position: x = ${this.position.x.toFixed(3)} m, ` +
                `y = ${this.position.y.toFixed(3)} m`
            );

            if (!canDrag()) return;

            const world = getWorld();
            if (!world) return;

            // Pick the nearest movable body beneath the pointer.
            let selectedBody = null;
            let nearestDistance = Infinity;

            // Convert 12 displayed pixels to world-coordinate padding.
            const rect = canvas.getBoundingClientRect();
            const paddingWorld =
                12 * canvas.logicalWidth / rect.width / camera.scale;

            for (const body of world.bodies) {
                if (body.isStatic) continue;

                const distance = Math.hypot(
                    this.position.x - body.pos.x,
                    this.position.y - body.pos.y
                );

                if (
                    distance <= body.radius + paddingWorld &&
                    distance < nearestDistance
                ) {
                    selectedBody = body;
                    nearestDistance = distance;
                }
            }

            if (!selectedBody) return;

            event.preventDefault();

            // Register this force once in each newly created world.
            if (!world.forces.includes(this.spring)) {
                world.addForce(this.spring);
            }

            this.spring.attach(selectedBody, this.position);

            activePointerId = event.pointerId;
            canvas.setPointerCapture(event.pointerId);

            onDragStart();
        });

        canvas.addEventListener("pointermove", (event) => {
            if (
                activePointerId !== null &&
                event.pointerId !== activePointerId
            ) {
                return;
            }

            updatePosition(event);

            if (activePointerId !== null) {
                if (!canDrag()) {
                    release();
                    return;
                }

                this.spring.setTarget(this.position);

                if (teleportDemo && this.spring.body) {
                    const body = this.spring.body;

                    // Deliberately incorrect: move without integrating motion.
                    body.pos.x = this.position.x;
                    body.pos.y = this.position.y;
                }
            }
        });

        canvas.addEventListener("pointerup", (event) => {
            if (event.pointerId === activePointerId) release();
        });

        canvas.addEventListener("pointercancel", (event) => {
            if (event.pointerId === activePointerId) release();
        });

        canvas.addEventListener("lostpointercapture", () => {
            release();
        });

        canvas.addEventListener("pointerleave", () => {
            if (activePointerId === null) this.position = null;
        });

        window.addEventListener("blur", release);

        let keyboardBodyIndex = -1;

        canvas.addEventListener("keydown", (event) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            const key = event.key.toLowerCase();

            if (key === "escape" || key === "g") {
                event.preventDefault();
                release();
                return;
            }

            if (!canDrag()) return;

            if (key === "n") {
                event.preventDefault();
                if (event.repeat) return;

                const world = getWorld();
                const movable = world.bodies.filter(
                    (body) => !body.isStatic
                );

                if (movable.length === 0) return;

                release();

                keyboardBodyIndex =
                    (keyboardBodyIndex + 1) % movable.length;

                const body = movable[keyboardBodyIndex];

                if (!world.forces.includes(this.spring)) {
                    world.addForce(this.spring);
                }

                this.position = { x: body.pos.x, y: body.pos.y };
                this.spring.attach(body, this.position);

                onDragStart();
                return;
            }

            const directions = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, 1],
                ArrowDown: [0, -1],
            };

            const direction = directions[event.key];
            if (!direction) return;

            event.preventDefault();

            if (!this.spring.body) return;

            const step = event.shiftKey ? 0.5 : 0.1;

            this.position = {
                x: this.spring.target.x + direction[0] * step,
                y: this.spring.target.y + direction[1] * step,
            };

            this.spring.setTarget(this.position);
        });

        // Leaving the canvas releases a keyboard or mouse grab.
        canvas.addEventListener("blur", release);

        // Lets the main program release a grab before resetting.
        this.cancelDrag = release;
    }
}

export class SlingshotInput {
    constructor(canvas, camera, {
        canLaunch,
        onLaunch,
    }) {
        this.start = null;
        this.end = null;

        let activePointerId = null;

        this.getVelocity = () => {
            if (!this.start || !this.end) return { x: 0, y: 0 };

            // Launch opposite the pull direction.
            let x = 2 * (this.start.x - this.end.x);
            let y = 2 * (this.start.y - this.end.y);

            // Bound launch speed to reduce collision tunneling.
            const speed = Math.hypot(x, y);
            const maximumSpeed = 12;

            if (speed > maximumSpeed) {
                x *= maximumSpeed / speed;
                y *= maximumSpeed / speed;
            }

            return { x, y };
        };

        this.cancel = () => {
            const pointerId = activePointerId;
            activePointerId = null;

            this.start = null;
            this.end = null;

            if (
                pointerId !== null &&
                canvas.hasPointerCapture(pointerId)
            ) {
                canvas.releasePointerCapture(pointerId);
            }
        };

        canvas.addEventListener("pointerdown", (event) => {
            if (
                event.button !== 0 ||
                activePointerId !== null ||
                !canLaunch()
            ) {
                return;
            }

            event.preventDefault();

            this.start = eventToWorld(event, canvas, camera);
            this.end = { ...this.start };

            activePointerId = event.pointerId;
            canvas.setPointerCapture(event.pointerId);
        });

        canvas.addEventListener("pointermove", (event) => {
            if (event.pointerId !== activePointerId) return;

            if (!canLaunch()) {
                this.cancel();
                return;
            }

            this.end = eventToWorld(event, canvas, camera);
        });

        canvas.addEventListener("pointerup", (event) => {
            if (event.pointerId !== activePointerId) return;

            this.end = eventToWorld(event, canvas, camera);

            const position = { ...this.start };
            const velocity = this.getVelocity();
            const allowed = canLaunch();

            this.cancel();

            if (allowed) onLaunch(position, velocity);
        });

        canvas.addEventListener("pointercancel", (event) => {
            if (event.pointerId === activePointerId) this.cancel();
        });

        canvas.addEventListener("lostpointercapture", () => {
            this.cancel();
        });

        canvas.addEventListener("keydown", (event) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            if (event.key === "Escape") {
                event.preventDefault();
                this.cancel();
                return;
            }

            if (!canLaunch()) return;

            if (event.key === "Enter") {
                event.preventDefault();
                if (event.repeat) return;

                if (!this.start) {
                    // Begin at the center of the currently visible world.
                    this.start = camera.toWorld({
                        x: canvas.logicalWidth / 2,
                        y: canvas.logicalHeight / 2,
                    });

                    this.end = { ...this.start };
                } else {
                    const position = { ...this.start };
                    const velocity = this.getVelocity();

                    this.cancel();
                    onLaunch(position, velocity);
                }

                return;
            }

            const directions = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, 1],
                ArrowDown: [0, -1],
            };

            const direction = directions[event.key];
            if (!direction) return;

            event.preventDefault();
            if (!this.start || !this.end) return;

            const dx = direction[0] * 0.1;
            const dy = direction[1] * 0.1;

            // Shift moves the launch position while preserving the pull.
            if (event.shiftKey) {
                this.start.x += dx;
                this.start.y += dy;
            }

            this.end.x += dx;
            this.end.y += dy;
        });

        canvas.addEventListener("blur", () => this.cancel());
        window.addEventListener("blur", () => this.cancel());
    }
}