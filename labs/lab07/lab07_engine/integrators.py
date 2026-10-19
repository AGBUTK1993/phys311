class EulerCromer:
    """Advance motion using velocity-first Euler-Cromer."""
    name = "Euler-Cromer"

    def step(self, world, dt):
        world.compute_forces()

        for body in world.bodies:
            if body.fixed:
                continue

            acceleration = body.force / body.mass
            body.velocity += acceleration * dt
            body.position += body.velocity * dt

            if body.moment_of_inertia is not None:
                angular_acceleration = body.torque / body.moment_of_inertia
                body.angular_velocity += angular_acceleration * dt
                body.angle += body.angular_velocity * dt


class VelocityVerlet:
    """Velocity Verlet for position-dependent forces and angle-dependent torques."""
    name = "Velocity Verlet"

    def step(self, world, dt):
        world.compute_forces()

        for body in world.bodies:
            if body.fixed:
                continue

            acceleration = body.force / body.mass
            body.velocity += 0.5 * acceleration * dt
            body.position += body.velocity * dt

            if body.moment_of_inertia is not None:
                angular_acceleration = body.torque / body.moment_of_inertia
                body.angular_velocity += 0.5 * angular_acceleration * dt
                body.angle += body.angular_velocity * dt

        world.compute_forces()

        for body in world.bodies:
            if body.fixed:
                continue

            acceleration = body.force / body.mass
            body.velocity += 0.5 * acceleration * dt

            if body.moment_of_inertia is not None:
                angular_acceleration = body.torque / body.moment_of_inertia
                body.angular_velocity += 0.5 * angular_acceleration * dt