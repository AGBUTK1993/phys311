// Game rules belong outside the physics engine.
export class DeliveryGoal {
    constructor() {
        this.zone = {
            xMin: 1.2,
            xMax: 2.8,
            yMin: -1.6,
            yMax: -0.4,
        };

        this.speedLimit = 0.2;
        this.requiredTime = 1;
        this.heldTime = 0;
        this.inside = false;
        this.speed = 0;
        this.won = false;
    }

    update(body, dt) {
        if (this.won) return;

        const z = this.zone;
        const r = body.radius;

        this.inside =
            body.pos.x - r >= z.xMin &&
            body.pos.x + r <= z.xMax &&
            body.pos.y - r >= z.yMin &&
            body.pos.y + r <= z.yMax;

        this.speed = Math.hypot(body.vel.x, body.vel.y);

        if (this.inside && this.speed < this.speedLimit) {
            this.heldTime = Math.min(
                this.requiredTime,
                this.heldTime + dt
            );
        } else {
            this.heldTime = 0;
        }

        this.won =
            this.heldTime >= this.requiredTime - 1e-12;
    }
}