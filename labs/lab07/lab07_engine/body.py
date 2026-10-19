import numpy as np


class Body:
    """Store the physical properties and current state of one body."""

    def __init__(
        self,
        mass,
        position,
        velocity,
        radius=0.0,
        moment_of_inertia=None,
        angle=0.0,
        angular_velocity=0.0,
        fixed=False,
        name="body"
    ):
        self.mass = float(mass)
        self.position = np.array(position, dtype=float)
        self.velocity = np.array(velocity, dtype=float)

        self.radius = float(radius)
        self.moment_of_inertia = moment_of_inertia
        self.angle = float(angle)
        self.angular_velocity = float(angular_velocity)

        self.fixed = bool(fixed)
        self.name = name

        # Accumulators: forces and torques will add their contributions here.
        self.force = np.zeros(2)
        self.torque = 0.0

    def clear_accumulators(self):
        """Reset accumulated force and torque before a force evaluation."""
        self.force[:] = 0.0
        self.torque = 0.0

    def kinetic_energy(self):
        """Return translational plus rotational kinetic energy."""
        energy = 0.5 * self.mass * np.dot(self.velocity, self.velocity)

        if self.moment_of_inertia is not None:
            energy += (
                0.5
                * self.moment_of_inertia
                * self.angular_velocity**2
            )

        return energy

    def momentum(self):
        """Return the body's linear momentum vector."""
        return self.mass * self.velocity

    def angular_momentum(self, origin=(0.0, 0.0)):
        """Return orbital plus spin angular momentum perpendicular to the plane."""
        displacement = self.position - np.asarray(origin, dtype=float)

        orbital = self.mass * (
            displacement[0] * self.velocity[1]
            - displacement[1] * self.velocity[0]
        )

        spin = 0.0
        if self.moment_of_inertia is not None:
            spin = self.moment_of_inertia * self.angular_velocity

        return orbital + spin