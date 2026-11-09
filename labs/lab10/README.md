# PHYS 311 — Lab 10: Interactive Physics
Alex Bebb

## 1. What it is

An interactive physics sandbox for exploring projectile motion, collisions,
gravitational orbits, and coupled springs.

The main activity is “Launch, Fall, and Bounce”: launch a ball, observe how
gravity curves its trajectory, and investigate how restitution changes its
bounces.

Three scenes are available:
- Ball box: collisions, adjustable gravity, grabbing, and launching.
- Gravitational orbits: three bodies interacting through mutual gravity.
- Spring chain: four moving masses connected to a fixed anchor.

Open labs/lab10/index.html using VS Code Live Server, or visit its published
GitHub Pages URL. The project uses JavaScript modules and requires an HTTP
server; there is no build step.

## 2. What physics it implements

The primary activity combines projectile motion under uniform gravity with
momentum, impulse, and restitution in collisions. Supporting scenes demonstrate
Hooke’s law and mutual gravitation.

- Uniform gravity: downward force F_y = -mg.
- Springs: Hooke’s law, with potential energy U = (1/2)k(extension)^2.
- Mutual gravity: softened gravitational attraction between bodies.
- Collisions: normal impulses with restitution between 0 and 1.
- Grabbing: a damped spring applies F = k(target - position) - c velocity.
  Releasing removes the grabbing force while preserving the body's velocity.
- Launching: backward pull sets launch velocity, capped at 12 m/s.
- Launch preview: analytic free flight for up to three seconds. It does not
  predict collisions with other balls.

Physics uses a fixed time step of 1/240 s. Available integrators are Velocity
Verlet, Euler–Cromer, and forward Euler. Playback speed changes how quickly
steps accumulate, not the physics time step.

The spring-stiffness slider is limited to 1–40 N/m. For unit masses in the
linear nearest-neighbor chain, omega_max <= 2 sqrt(k/m). The condition
omega_max dt < 2 gives dt < sqrt(m/k). At k = 40 N/m, this is approximately
0.158 s, well above the chosen 1/240 s. This supports Verlet/Euler–Cromer
in the linear regime; it does not make forward Euler stable.

The engine contains no rendering or DOM code. Input and UI modules provide
parameters and forces; rendering modules display the resulting state.

## 3. How to use it

Choose a scene. For the main activity, select the ball box and “Launch a ball.”
Set downward gravity to 2 m/s², press empty space inside the box, pull backward,
and release. Compare the motion with the preview, then try lower restitution.

Circled question marks provide contextual help through hover, keyboard focus,
or click/tap. Escape dismisses help.

| Control | Function |
|---|---|
| Scene | Select a scene and start a fresh run. |
| Integrator | Change the numerical method; restart for a clean comparison. |
| Restitution | Set collision elasticity from 0 to 1 in the ball box. |
| Balls | Choose 20, 50, 100, or 200 initial balls. |
| Mouse action | Choose spring grabbing or launching; launching is box-only. |
| Run duration | Choose 30, 60, 120 simulated seconds, or Unlimited. Apply with Restart or a scene change. |
| Restart | Reset the scene, clock, and energy comparison. |
| Pause/Resume | Stop or resume physics while keeping rendering active. |
| Single step | Pause and advance exactly one physics step. |
| Speed | Set playback speed from 0.25× to 2×. |
| Downward gravity | Adjust box gravity from 0 to 10 m/s². |
| Spring stiffness | Adjust chain stiffness from 1 to 40 N/m. |
| Velocity arrows | Show velocity direction and relative speed. |
| Force arrows | Show continuous net force; collision impulses are excluded. |
| Energy graph | Show recent mechanical energy on a separate canvas. |
| View zoom / Reset view | Magnify the view or restore its original framing. |
| Arrow size | Magnify arrows without changing the physics. |
| Seeded run | Run a reproducible 60-second box simulation and save its final state. |
| Replay | Repeat the reference run and compare final states byte-for-byte. |
| Run Part C validation | Run independent physics checks without changing the visible scene. Pause first. |

Changing gravity or spring stiffness starts a new energy comparison.
Grabbing and launching exchange energy with the system.

Keyboard controls when no form control is focused:
- Space: pause/resume.
- Period: single step.
- R: restart.
- Minus/plus: decrease/increase speed.
- I: cycle integrators.

Use Tab and Shift+Tab to navigate controls. Use arrow keys to adjust focused
sliders or selections.

With the simulation canvas focused:
- Grab mode: N selects the next movable body; arrow keys move the spring
  target; Shift increases the movement increment; G or Escape releases.
- Launch mode: Enter begins aiming; arrows adjust the pull; Shift+arrows
  move the launch point; Enter launches; Escape cancels.
- Leaving canvas focus releases or cancels the interaction.

Seeded runs and replay always use 60 simulated seconds and lock physical
controls during the run.

## 4. How you know it is right

Component checks run on page load. Collision validation compares elastic
and inelastic behavior with walls enabled and disabled.

The optional Part C validation panel checks:
- Motion under uniform gravity against analytic position and velocity.
- Mechanical-energy error for collision-free projectile motion.
- Euler–Cromer convergence when the time step is halved.
- Wall reflections and unequal-mass collisions at several restitution values.
- Detection of a deliberately invalid state in a separate test world.

These tests use separate worlds. They supplement tests of the visible scene.

A recorded 60-second test of the visible ball box used 20 balls, Velocity
Verlet, dt = 1/240 s, restitution 1, gravity 0, and no user interaction.

| Quantity | Result |
|---|---:|
| Initial energy | 41.250000 J |
| Final energy at displayed precision | 41.250000 J |
| Maximum relative energy error | 6.890111e-16 |
| Maximum percentage energy error | 6.890111e-14 % |
| Final signed energy change | -7.105427357601002e-15 J |

This demonstrates conservation to floating-point precision for that tested
configuration. Fixed walls exert external impulses, so the balls' total
momentum need not stay constant. A fixed spring anchor also exchanges momentum
with the moving masses.

Velocity arrows reveal motion direction and relative speed. Force arrows
show that force and velocity need not point in the same direction. The energy
graph reveals trends and changes caused by interactions.

The graph shows recent history with an automatically scaled vertical axis.
Maximum energy error is tracked separately at each physics step.

Canvas coordinates are mapped through the camera. The display uses fixed
logical dimensions with a pixel buffer adjusted for screen density. HTML
diagnostics below the canvas provide readable values outside the drawing.

## 5. Known limitations

- Discrete collision detection can miss sufficiently fast crossings.
  Crowded, simultaneous contacts are approximated with sequential corrections.
- Gravity combined with overlap correction can introduce energy error.
  The zero-gravity conservation result does not apply to every configuration.
- Forward Euler can gain substantial energy in oscillators and distort orbits.
- Dragging supplies external work and includes damping. Launching adds a body
  and restarts the energy comparison. Neither is an isolated conservation test.
- Gravitational forces are softened. The spring chain omits downward gravity,
  bending forces, and collisions.
- Force and velocity arrows use different display scales and have capped
  lengths. Force arrows do not depict instantaneous collision impulses.
- The trajectory preview excludes collisions with other bodies.
- Zoom can move bodies outside the visible area; Reset view restores framing.
- Numerical guards reset and pause invalid or extreme states. Recovery is
  not proof that the preceding motion was accurate or that a stress test passed.
- Background tabs can run more slowly than real time.
- Seeded replay tests repeatability in the current runtime, not physical
  accuracy or identical results across every browser.
- Performance measurements depend on hardware, browser, and enabled visuals.

Module organization:
- engine/: vectors, bodies, forces, integrators, collisions, and world.
- render/: camera, renderer, HUD, overlays, and physics visuals.
- input.js: pointer and keyboard manipulation.
- ui.js: playback and physical controls.
- control-help.js: contextual help and validation interface.
- main.js: scene coordination and animation.
- scenes.js: scene construction.
- Other modules support checks, validation, performance, random initialization,
  and replay.