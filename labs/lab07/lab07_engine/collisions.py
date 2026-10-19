import numpy as np


def resolve_pair(body_a, body_b, restitution=1.0):
    """Separate overlapping circles and apply a normal collision impulse."""
    displacement = body_b.position - body_a.position
    distance = np.linalg.norm(displacement)
    contact_distance = body_a.radius + body_b.radius

    if distance > contact_distance:
        return False

    if distance == 0.0:
        raise ValueError("Collision normal is undefined for coincident centers.")

    normal = displacement / distance
    inverse_mass_a = 0.0 if body_a.fixed else 1.0 / body_a.mass
    inverse_mass_b = 0.0 if body_b.fixed else 1.0 / body_b.mass
    inverse_mass_sum = inverse_mass_a + inverse_mass_b

    if inverse_mass_sum == 0.0:
        return False

    # Correct overlap, including when the bodies are already separating.
    overlap = contact_distance - distance
    body_a.position -= normal * overlap * inverse_mass_a / inverse_mass_sum
    body_b.position += normal * overlap * inverse_mass_b / inverse_mass_sum

    relative_velocity = body_b.velocity - body_a.velocity
    normal_speed = np.dot(relative_velocity, normal)

    if normal_speed >= 0.0:
        return False

    impulse = -(1.0 + restitution) * normal_speed / inverse_mass_sum
    body_a.velocity -= impulse * inverse_mass_a * normal
    body_b.velocity += impulse * inverse_mass_b * normal

    return True


class CircleCollisions:
    """Check each pair of circular bodies for a collision."""

    def __init__(self, restitution=1.0):
        self.restitution = float(restitution)
        self.count = 0

    def resolve(self, world):
        bodies = world.bodies

        for i in range(len(bodies)):
            for j in range(i + 1, len(bodies)):
                body_a = bodies[i]
                body_b = bodies[j]

                if body_a.radius <= 0.0 or body_b.radius <= 0.0:
                    continue

                if resolve_pair(body_a, body_b, self.restitution):
                    self.count += 1


class BoxWalls:
    """Keep circular bodies inside a stationary rectangular box."""

    def __init__(self, xmin, xmax, ymin, ymax, restitution=1.0):
        self.lower = np.array([xmin, ymin], dtype=float)
        self.upper = np.array([xmax, ymax], dtype=float)
        self.restitution = float(restitution)
        self.count = 0

    def resolve(self, world):
        for body in world.bodies:
            if body.fixed:
                continue

            for axis in range(2):
                minimum = self.lower[axis] + body.radius
                maximum = self.upper[axis] - body.radius

                if minimum >= maximum:
                    raise ValueError("The body must fit inside the box.")

                if body.position[axis] < minimum:
                    body.position[axis] = minimum
                    if body.velocity[axis] < 0.0:
                        body.velocity[axis] *= -self.restitution
                        self.count += 1

                elif body.position[axis] > maximum:
                    body.position[axis] = maximum
                    if body.velocity[axis] > 0.0:
                        body.velocity[axis] *= -self.restitution
                        self.count += 1