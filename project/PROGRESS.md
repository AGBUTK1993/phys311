# Week 12 — Build Sprint Progress Log
**Project:** The Burial Shaft  
**Course:** PHYS 311 — Classical Mechanics I  
**Date:** November 22, 2026

## 1. MUST Tier Status

| Requirement | Status | Notes |
|---|---|---|
| Reuse Lab 10 engine, renderer, and controls | Done | The project retains the modular physics engine and rendering structure. |
| Implement suspension physics | Done | The suspended artifact responds to gravity and moving-support acceleration. Rope tension is calculated and monitored. |
| Playable first chamber | Done | The player can move the support horizontally and guide the artifact toward a delivery zone. |
| Keyboard-accessible interaction | Done | Keyboard shortcuts and HTML controls provide support movement, pause, restart, and other interactions. |
| Restart and pause | Done | Restart restores the chamber's initial conditions and resets the energy baseline. |
| Delivery goal | Done | The artifact must remain fully inside the zone below 0.2 m/s for one continuous simulated second. Successful delivery was demonstrated after introducing damping. |
| Tension monitoring | Done | Tension is displayed, and the suspension model handles rope-state limitations. |
| GitHub Pages deployment | Done | A public playable version has been deployed. |
| Instructions | Done | Instructions and gameplay controls are available through the interface. |
| Validation | Done | Conservative-energy and small-angle-period tests passed their stated tolerances. |
| Fixed timestep | Done | Physics uses an accumulator with a timestep of 1/240 s. CPU-throttling behavior was checked. |
| Debug instrumentation | Implemented; final audit pending | The HUD displays energy, drift, momentum, body count, contacts, maximum speed, and FPS. Final live-site verification remains. |

The playable MUST tier is implemented. Additional chambers and mechanics have also been developed, but they are not necessary to satisfy the original first-chamber scope.

## 2. Validation Results

### Test 1 — Small-Angle Suspension Period

A separate validation world was initialized with a fixed support, no damping, an initial angle of 0.05 rad, and a timestep of 1/240 s.

| Measurement | Value |
|---|---:|
| Expected period | 3.474609414 s |
| Measured period | 3.475144182 s |
| Completed periods measured | 17 |
| Relative error | 0.015390734% |
| Required tolerance | Below 1% |
| Result | PASS |

The measured period agrees closely with the small-angle prediction

\[
T = 2\pi\sqrt{\frac{L}{g}}.
\]

The remaining difference is consistent with the finite initial amplitude and numerical approximation.

### Test 2 — Conservative Energy

The support was held fixed, damping was disabled, and the simulation was run for 60 simulated seconds at a timestep of 1/240 s.

| Measurement | Value |
|---|---:|
| Initial energy | 1.173281 J |
| Final energy | 1.173265 J |
| Maximum relative energy error | 0.001414556% |
| Required tolerance | Below 0.1% |
| Result | PASS |

Mechanical energy was calculated using

\[
E=\frac12 mL^2\dot{\theta}^2+mgL(1-\cos\theta).
\]

The maximum measured error was well below the required tolerance.

### CPU-Throttling Check

With Chrome CPU throttling set to 4×, the conservative simulation completed 60 simulated seconds in approximately 60.53 seconds, measured manually with a stopwatch.

The displayed FPS stayed between 60.0 and 60.1 during the run. No noticeable lag or stuttering occurred.

The maximum relative energy error remained 0.001414556%, matching the earlier unthrottled result. This supports stable, approximately real-time operation under the tested conditions. It does not establish identical performance on every device or under every workload.

## 3. Scope Decisions

### Suspension Damping

**Planned:** Use an undamped suspended load and require it to remain fully inside the delivery zone below 0.2 m/s for one continuous simulated second.

**Did:** Added suspension damping at a rate of 0.35 s⁻¹, disabled in conservative mode. The delivery thresholds were unchanged.

**Why:** The undamped load continued swinging. Near the turning points, it slowed but overlapped the zone boundary; inside the zone, it moved too quickly. Damping allowed the normal gameplay test to reach successful delivery.

### Rope Mechanics and Controls

**Planned:** Use a fixed-length, taut-rope suspension model for the first chamber.

**Did:** Extended the model with adjustable rope length, slack and broken states, and multiple winch speeds while retaining the original suspension gameplay.

**Why:** These extensions allow the player to explore lifting, tension, and rope failure. They also make it necessary to distinguish ordinary gameplay from the restricted conservative test.

### Interface and Presentation

**Planned:** Provide understandable keyboard controls and a visible playable chamber.

**Did:** Grouped gameplay sliders into a control panel, added menu-based settings and diagnostics, and retained keyboard-accessible controls.

**Why:** These changes make the primary physics and gameplay settings easier to find without permanently covering the scene.

Mobile testing revealed overlapping controls in portrait orientation. This remains a known layout issue, not a completed mobile verification.

## 4. Diagnosed Problems and Fixes

### Problem 1 — Suspension Restart Failure

**Symptom:** The Burial Shaft scene initially failed to restart because `SuspensionWorld.updateBodyState()` referenced an undefined `pointer`.

**Cause:** User-interface logic had been included in the suspension physics update, creating a dependency on a variable not defined inside that model.

**Fix:** Reworked the method to update the physical state—position, velocity, tension, and forces—without depending on the pointer interface.

**Result:** The simulation restarted and the suspension scene became usable.

### Problem 2 — Invalid Negative Rope Tension

**Symptom:** An earlier high-acceleration suspension stress test produced a calculated minimum tension of approximately −33.507 N.

**Cause:** The original taut-rope equations could be evaluated outside their physical domain. A rope can pull but cannot exert a compressive force to keep a load constrained to a circular path.

**Fix:** Added rope-state handling for nonpositive tension rather than continuing to interpret the constraint as a physically valid taut rope. The expanded model also supports slack and broken states.

**Result:** The model now explicitly distinguishes taut suspension from cases in which the taut-rope constraint is invalid. The negative-tension measurement came from the earlier risk spike, not a new integrated-game regression test.

## 5. Week 13 Plan — SHOULD Priorities

1. **Verify and refine tension and speed indicators.** Confirm that gameplay readouts, energy diagnostics, and warnings remain clear during ordinary play and conservative testing.

2. **Add a motion trail if the remaining schedule allows.** This would make oscillation, release behavior, and changes in swing amplitude easier to observe.

3. **Refine adjustable challenge settings.** Test the existing controls and safe operating ranges before expanding gameplay difficulty.

Before adding new features, I will complete the required validation, documentation, presentation, and launch work. Mobile layout problems will be addressed after the required submission is secure.

## 6. Known Limitations

- Strong support acceleration can move the system outside the valid taut-rope regime.
- Support movement and damping exchange or remove energy; conservation should only be expected under the designated conservative conditions.
- Slack-rope recapture uses an idealized inelastic catch rather than modeling the full transient catch force.
- Floor and obstacle interactions are not fully modeled.
- Portrait mobile layouts currently have overlapping interface elements.
- The CPU-throttling result demonstrates performance only under the tested browser and hardware conditions.

The current beta provides a working interactive suspension-physics game, with successful validation of the two original proposal tests. The remaining work is primarily verification, documentation, and presentation rather than development of the core physics model.

### Phase 5A — Experimental rigid-body physics validation

- Implemented rotational inertia, torque integration, body-local attachment points, and combined translation/rotation.
- Added a separate tension-only elastic connector model supporting multiple attachments.
- Verified symmetric and asymmetric load sharing, slack behavior, and independent rope failure.
- Stiffness tests (30, 300, 3000 N/m) remained finite at dt = 0.01, 0.005, and 0.001 s.
- Maximum relative energy deviation increased substantially for stiff connectors; at 3000 N/m, it decreased from approximately 48.54% (dt = 0.01 s) to 2.79% (dt = 0.001 s).
- Conclusion: Stiff-rope dynamics require additional timestep and integrator validation before gameplay integration.
- The original playable suspension engine remains separate and unchanged by these experimental rigid-body modules.