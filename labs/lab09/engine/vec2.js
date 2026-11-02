"use strict";

// A two-dimensional vector with x and y components.
class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  // Return an independent copy.
  clone() {
    return new Vec2(this.x, this.y);
  }

  // These operations return new vectors.
  add(v) {
    return new Vec2(this.x + v.x, this.y + v.y);
  }

  sub(v) {
    return new Vec2(this.x - v.x, this.y - v.y);
  }

  mul(s) {
    return new Vec2(this.x * s, this.y * s);
  }

  // The dot product returns a number.
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  normalized() {
    const magnitude = this.length();
    if (magnitude === 0) {
      return new Vec2(0, 0);
    }
    return this.mul(1 / magnitude);
  }

  // These operations change the existing vector.
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  addTo(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  addScaled(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    return this;
  }
}

export { Vec2 };