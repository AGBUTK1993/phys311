// Convert between physical coordinates and drawing coordinates.
export class Camera {
  constructor(scale = 40, originX = 100, originY = 580) {
    this.scale = scale;
    this.originX = originX;
    this.originY = originY;
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