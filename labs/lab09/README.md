# PHYS 311 — Lab 9
Alex Bebb

## Overview

This project uses a reusable JavaScript physics engine to display three
interactive scenes on an HTML canvas:

- Balls with elastic or inelastic collisions inside a box.
- Three bodies interacting through softened gravitational attraction.
- Four moving masses connected by springs to a fixed anchor.

The engine supports Euler–Cromer and Velocity Verlet integration.
The browser animation uses a fixed physics time step of 1/240 s.
Each visible run ends after 60 simulated seconds.

## Running locally

Open the phys311 repository in VS Code.

Open labs/lab09/index.html using Live Server. Keep the complete lab09
folder together so that the JavaScript imports resolve correctly.

The project uses browser JavaScript modules and requires no build step.

## Controls

- Scene selects a system and starts a fresh run.
- Integrator switches between Euler–Cromer and Velocity Verlet.
- Restitution changes collision elasticity in the box scene.
- Balls selects 20, 50, 100, or 200 bodies in the box scene.
- Restart rebuilds the selected ordinary scene.
- Pause and Resume stop and continue physics stepping.
- Seeded run starts a reproducible box simulation.
- Replay repeats a completed seeded run using its saved settings.

Restitution and ball count are disabled for the orbit and spring scenes.
Physics settings are locked during a seeded run or replay.
Restart can interrupt a bonus run.

## File organization

| File or folder | Purpose |
|---|---|
| index.html | Page structure and controls |
| style.css | Page styling |
| main.js | Animation loop, controls, and experiment coordination |
| scenes.js | Initial bodies, forces, and settings for each scene |
| engine/vec2.js | Two-dimensional vector operations |
| engine/body.js | Physical properties and state of a body |
| engine/forces.js | Gravity, springs, and softened mutual gravity |
| engine/integrators.js | Euler–Cromer and Velocity Verlet |
| engine/collisions.js | Wall and circle collision handling |
| engine/world.js | Coordinates physics stepping and diagnostics |
| render/camera.js | Converts physical coordinates to canvas coordinates |
| render/renderer.js | Draws bodies, boundaries, springs, and trails |
| render/hud.js | Displays physical quantities and timing information |
| checks.js | Component and collision checks |
| validation.js | Longer collision-conservation tests |
| performance.js | Collects performance averages |
| random.js | Seeded pseudo-random number generator |
| replay.js | Encodes and compares final physical states |
| lab09_notes.md | Interpretations and recorded results |

## Architecture

The engine performs physics calculations without accessing the canvas
or page elements. Rendering reads the physical state without changing
positions or velocities.

World.step clears accumulated forces, applies forces, advances the
bodies with the selected integrator, resolves enabled collisions,
and advances simulation time. Velocity Verlet also recalculates forces
at the updated positions before completing its velocity update.

The renderer stores its own trail history. Changing scenes or
restarting creates a fresh world.

## Validation

Opening the page runs component checks and four 60-second collision
tests in the browser console.

Elastic collision tests check kinetic-energy conservation.
Inelastic tests check that kinetic energy does not increase.
Walls-off tests check conservation of the total momentum vector.

The balls' total momentum is not expected to remain constant when
they collide with fixed walls. Similarly, the fixed spring anchor
can change the momentum of the moving chain.

The visible simulations also track the largest relative energy error
and momentum-vector change during each run.

## Performance measurements

Use the box scene with Velocity Verlet and restitution 1.
Close the developer console and keep the browser tab visible.

For each ball count, click Restart or change the count.
The recorder allows two seconds of warm-up, then averages ten seconds
of frame measurements. Results appear below the canvas.

Changing the integrator or restitution, or pressing Pause, stops the
current measurement. Restart begins another measurement.

Measurements remain available until the page is refreshed.
Physics timing includes conservation diagnostics. Render timing covers
drawing calls and HUD work rather than separately timing GPU execution.

## Reproducing the bonus test

1. Select the box scene with 20 balls, Velocity Verlet, and restitution 1.
2. Click Seeded run.
3. Wait until the reference is saved after 60 simulated seconds.
4. Click Replay and wait for another 60 simulated seconds.
5. Check for "Bit-identical final physical states: true."

The tested seed was 31109. Both runs completed 14,400 steps, and all
1,960 compared bytes matched. This demonstrates reproducibility in
the tested browser, not a guarantee of identical results across all
browsers or platforms.

## Limitations

Collisions are detected at discrete time steps. Very fast bodies could
pass through one another between checks. Collision resolution processes
pairs sequentially, so crowded simultaneous contacts are approximate.

The model does not include collision friction or collision-induced
rotation. Gravity is softened at short distances. The spring chain
has no damping, bending resistance, gravity, or collisions.

The HUD marks energy changes above 1% in red. With inelastic collisions,
energy loss is expected and does not by itself indicate an error.

Long browser pauses can make simulated time advance more slowly than
real time because the animation loop limits catch-up time.