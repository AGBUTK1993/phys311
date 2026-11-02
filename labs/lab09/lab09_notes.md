# Lab 9 Notes
Alex Bebb — PHYS 311

## Part B: Collisions and Validation

I tested 20 balls over 60 seconds of simulated motion, using both
elastic collisions (e = 1) and inelastic collisions (e = 0.8).
With elastic collisions, kinetic energy stayed constant within the
numerical tolerance. With inelastic collisions, kinetic energy
decreased and did not increase beyond the rounding tolerance.

The walls mattered when checking momentum. A wall exerts an external
force on the balls during a collision, so the balls' total momentum
does not have to stay constant inside the box. I also ran the tests
without walls or other external forces. In those tests, total momentum
stayed constant for both values of e, even when kinetic energy decreased.

I also tested the separating guard by temporarily disabling it.
Without the guard, two overlapping balls that were already moving
apart received an impulse that reversed their velocities. Restoring
the guard prevented this unnecessary impulse while still allowing
the overlap correction.

These checks support the collision model's conservation behavior,
but they do not prove that every collision will be detected.
Collisions are checked at discrete time steps, so sufficiently fast
bodies could pass through each other between checks.


## Part C: Scenes and Performance

I used the same physics engine for three different scenes: colliding
balls in a box, three bodies interacting through gravity, and four
moving masses connected by springs to a fixed anchor. Each scene
provided its own bodies, forces, and boundary settings. The scene
selector switched between them without changing the engine code.

The gravitational scene used softened gravity and Velocity Verlet.
Over 60 simulated seconds, its maximum relative energy error was
8.979103e-8, or approximately 0.00000898%. Its maximum change in total
momentum was approximately 1.59e-14 kg m/s. The orbital trails remained
approximately circular during the run. These results support stable,
accurate behavior over the tested interval, although they do not prove
that every possible starting configuration would behave equally well.

The spring chain also used Velocity Verlet. Its maximum relative
energy error over 60 seconds was 3.581261e-5, or approximately 0.00358%.
The fixed anchor allowed the moving masses' momentum to change.
Because the anchor did not move, it did no work, so conservation of
kinetic plus spring potential energy was still an appropriate check.

### Performance measurements

I measured the elastic box scene with Velocity Verlet and a fixed
time step of 1/240 s. Each measurement used a two-second warm-up
followed by a ten-second average.

| Balls | Physics (ms/frame) | Render (ms/frame) | FPS | Simulation rate (s/s) |
|----:|------:|------:|-----:|------:|
|  20 | 0.066 | 0.389 | 60.1 | 1.000 |
|  50 | 0.300 | 0.494 | 60.1 | 1.000 |
| 100 | 1.122 | 0.673 | 60.1 | 1.000 |
| 200 | 3.134 | 0.713 | 60.1 | 1.000 |

All four tested counts maintained approximately 60 FPS and kept up
with real time. The largest tested count was 200 balls; this does
not establish the engine's actual maximum capacity.

Physics became the larger measured cost at higher body counts.
The collision routine checked every pair, requiring N(N-1)/2 pair
checks per physics step. This increased from 190 pairs with 20 balls
to 19,900 pairs with 200 balls. The pair-checking work therefore grows
approximately as N squared, making it a likely scaling bottleneck.

The physics timing included the conservation diagnostics. Render
timing measured the drawing calls and HUD work, rather than separately
measuring GPU execution.

An initial 200-ball measurement showed a much lower frame rate.
I repeated that measurement with the tab kept visible and the
controls unchanged, obtaining the result reported above. The exact
cause of the earlier slowdown was not established.


## Bonus: Deterministic Replay

I added a seeded pseudo-random number generator to create reproducible
starting velocities for the box scene. The Seeded run button used seed
31109 and saved the settings and final physical state. The Replay button
rebuilt the scene using those same starting settings.

I tested 20 balls with Velocity Verlet, restitution 1, and a fixed time
step of 1/240 s. Each run completed 14,400 physics steps, representing
60 simulated seconds. The comparison checked 1,960 bytes encoding the
final physical state and simulation metadata. All compared bytes matched.

The comparison used the binary representations of the numbers instead
of rounded values from the HUD. Bodies were matched by their creation
order within the scene. Their automatically assigned IDs were excluded
because the ID counter continued increasing when new bodies were created.

This result demonstrated reproducibility for the tested configuration
in the same browser. It did not establish physical accuracy by itself:
a simulation could repeat the same mistake consistently. The separate
energy, momentum, and collision checks were still necessary.