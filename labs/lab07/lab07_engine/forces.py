import numpy as np


class Gravity:
    """Uniform downward gravity."""

    def __init__(self, g=9.81):
        self.g = float(g)

    def apply(self, world):
        for body in world.bodies:
            if body.fixed:
                continue

            body.force += np.array([0.0, -body.mass * self.g])

    def potential_energy(self, world):
        return sum(
            body.mass * self.g * body.position[1]
            for body in world.bodies
            if not body.fixed
        )


class Spring:
    """A Hooke's-law spring connecting two bodies."""

    def __init__(self, index_a, index_b, k, rest_length=0.0):
        self.index_a = index_a
        self.index_b = index_b
        self.k = float(k)
        self.rest_length = float(rest_length)

    def apply(self, world):
        body_a = world.bodies[self.index_a]
        body_b = world.bodies[self.index_b]

        displacement = body_b.position - body_a.position
        distance = np.linalg.norm(displacement)

        if distance == 0.0:
            if self.rest_length == 0.0:
                return
            raise ValueError(
                "A spring with nonzero rest length needs distinct endpoints."
            )

        direction = displacement / distance
        extension = distance - self.rest_length
        force_on_a = self.k * extension * direction

        # Equal and opposite forces on the two endpoints.
        body_a.force += force_on_a
        body_b.force -= force_on_a

    def potential_energy(self, world):
        body_a = world.bodies[self.index_a]
        body_b = world.bodies[self.index_b]

        distance = np.linalg.norm(body_b.position - body_a.position)
        extension = distance - self.rest_length

        return 0.5 * self.k * extension**2


class NewtonGravity:
    """Pairwise gravitational attraction, with optional softening."""

    def __init__(self, G=1.0, softening=0.0):
        self.G = float(G)
        self.softening = float(softening)

    def apply(self, world):
        bodies = world.bodies

        for i in range(len(bodies)):
            for j in range(i + 1, len(bodies)):
                body_a = bodies[i]
                body_b = bodies[j]

                displacement = body_b.position - body_a.position
                distance_squared = (
                    np.dot(displacement, displacement)
                    + self.softening**2
                )

                if distance_squared == 0.0:
                    raise ValueError(
                        "Unsoftened gravity is undefined at zero separation."
                    )

                force_on_a = (
                    self.G
                    * body_a.mass
                    * body_b.mass
                    * displacement
                    / distance_squared**1.5
                )

                body_a.force += force_on_a
                body_b.force -= force_on_a

    def potential_energy(self, world):
        bodies = world.bodies
        energy = 0.0

        for i in range(len(bodies)):
            for j in range(i + 1, len(bodies)):
                body_a = bodies[i]
                body_b = bodies[j]

                displacement = body_b.position - body_a.position
                distance = np.sqrt(
                    np.dot(displacement, displacement)
                    + self.softening**2
                )

                if distance == 0.0:
                    raise ValueError(
                        "Unsoftened gravity is undefined at zero separation."
                    )

                energy -= self.G * body_a.mass * body_b.mass / distance

        return energy