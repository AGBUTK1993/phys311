import numpy as np
from .integrators import EulerCromer


class World:
    """Manage a scene, advance its motion, and record its history."""

    def __init__(self, integrator=None):
        self.bodies = []
        self.forces = []
        self.collisions = []
        self.integrator = integrator if integrator is not None else EulerCromer()
        self.time = 0.0
        self.history = {}

    def add_body(self, body):
        self.bodies.append(body)
        return body

    def add_force(self, force):
        self.forces.append(force)
        return force

    def add_collision(self, collision):
        self.collisions.append(collision)
        return collision

    def compute_forces(self):
        for body in self.bodies:
            body.clear_accumulators()

        for force in self.forces:
            force.apply(self)

    def step(self, dt):
        self.integrator.step(self, dt)

        for collision in self.collisions:
            collision.resolve(self)

        self.time += dt

    def kinetic_energy(self):
        return sum(body.kinetic_energy() for body in self.bodies)

    def potential_energy(self):
        return sum(force.potential_energy(self) for force in self.forces)

    def total_energy(self):
        return self.kinetic_energy() + self.potential_energy()

    def momentum(self):
        total = np.zeros(2)
        for body in self.bodies:
            total += body.momentum()
        return total

    def angular_momentum(self):
        return sum(body.angular_momentum() for body in self.bodies)

    def capture(self):
        self.history["time"].append(self.time)
        self.history["position"].append(
            np.array([body.position.copy() for body in self.bodies])
        )
        self.history["velocity"].append(
            np.array([body.velocity.copy() for body in self.bodies])
        )
        self.history["angle"].append(
            np.array([body.angle for body in self.bodies])
        )
        self.history["angular_velocity"].append(
            np.array([body.angular_velocity for body in self.bodies])
        )
        self.history["energy"].append(self.total_energy())
        self.history["momentum"].append(self.momentum())
        self.history["angular_momentum"].append(self.angular_momentum())

    def run(self, dt, duration):
        if dt <= 0.0 or duration < 0.0:
            raise ValueError("Use a positive time step and a nonnegative duration.")

        steps = int(round(duration / dt))
        if not np.isclose(steps * dt, duration, rtol=1e-10, atol=1e-12):
            raise ValueError("Choose a duration that is a whole number of steps.")

        keys = [
            "time", "position", "velocity", "angle",
            "angular_velocity", "energy", "momentum", "angular_momentum"
        ]
        self.history = {key: [] for key in keys}
        self.capture()

        for _ in range(steps):
            self.step(dt)
            self.capture()

        return {
            key: np.array(values)
            for key, values in self.history.items()
        }