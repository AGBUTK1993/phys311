// Convert between physical coordinates and drawing coordinates.
export class Camera {
  constructor(scale = 40, originX = 100, originY = 580) {
    this.scale = scale;
    this.originX = originX;
    this.originY = originY;
  }

  follow(target, bounds, width, height, dt, snap = false) {
    const halfWidth = width / (2 * this.scale);
    const halfHeight = height / (2 * this.scale);

    const clampCenter = (value, min, max, half) =>
      max - min <= 2 * half
        ? (min + max) / 2
        : Math.max(min + half, Math.min(max - half, value));

    const desiredX = clampCenter(
      target.x, bounds.xMin, bounds.xMax, halfWidth
    );
    const desiredY = clampCenter(
      target.y, bounds.yMin, bounds.yMax, halfHeight
    );

    if (snap || !this.followCenter) {
      this.followCenter = { x: desiredX, y: desiredY };
    } else {
      // Small swings can happen without moving the entire view.
      const deadZoneX = Math.min(0.6, halfWidth * 0.15);
      const deadZoneY = Math.min(0.35, halfHeight * 0.12);
      const alpha = 1 - Math.exp(
        -5 * Math.max(0, Math.min(dt, 0.1))
      );

      const advance = (current, desired, deadZone) => {
        const delta = desired - current;
        return current + Math.sign(delta) *
          Math.max(0, Math.abs(delta) - deadZone) * alpha;
      };

      this.followCenter.x = advance(
        this.followCenter.x, desiredX, deadZoneX
      );
      this.followCenter.y = advance(
        this.followCenter.y, desiredY, deadZoneY
      );
    }

    this.followCenter.x = clampCenter(
      this.followCenter.x, bounds.xMin, bounds.xMax, halfWidth
    );
    this.followCenter.y = clampCenter(
      this.followCenter.y, bounds.yMin, bounds.yMax, halfHeight
    );

    this.originX = width / 2 - this.followCenter.x * this.scale;
    this.originY = height / 2 + this.followCenter.y * this.scale;
  }

  toScreen(position) {
    return {
      x: this.originX + position.x * this.scale,
      y: this.originY - position.y * this.scale
    };
  }

  toWorld(point) {
    return {
      x: (point.x - this.originX) / this.scale,
      y: (this.originY - point.y) / this.scale
    };
  }
}