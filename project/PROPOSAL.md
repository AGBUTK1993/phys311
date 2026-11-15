# 1. Title & Pitch

**The Burial Shaft:** Guide a suspended archaeological find through an Egyptian-inspired chamber and bring it safely into a delivery zone without excessive swinging.

# 2. The Physics

The one new physics feature is a fixed-length suspension constraint with a horizontally moving support. The first chamber models a point mass on a massless, taut rope under gravity. It excludes air resistance, rope elasticity, and collision response.

With upward-positive y and angle θ measured from downward vertical:

x = xₚ + L sin θ
y = −L cos θ
θ̈ = −(g sin θ + ẍₚ cos θ)/L

Gravity is Fg = (0, −mg). Rope tension acts toward the support, with magnitude:

T = m[Lθ̇² + g cos θ − ẍₚ sin θ]

The model applies only while T > 0. The game will stop and explain the limitation if tension reaches zero, rather than continue pretending the rope remains taut.

Initial scales are m = 2 kg, L = 3 m, and g = 9.81 m/s². Distances, time, and forces use meters, seconds, and newtons. Velocity Verlet at Δt = 1/240 s provides second-order integration and performed well in the conservative prototype tests. Prescribed support motion can add or remove energy; energy conservation is expected only with the support fixed.

# 3. Three-Tier Scope

**MUST — by the end of Week 12:** Reuse the Lab 10 project structure, renderer, and controls; integrate the suspension model; provide one playable chamber with keyboard-controlled support motion, restart/pause, tension monitoring, and a delivery goal. Success requires the load to remain inside the marked zone below 0.2 m/s for one simulated second. Publish a working GitHub Pages version with instructions and validation results.

**SHOULD:** Add clear tension and speed indicators, a motion trail, and adjustable challenge settings. Test the allowed controls and initial conditions before expanding the playable range.

**COULD:** Add additional chambers with different layouts and goals, optional sound, collision challenges, spring mechanisms, and a surveying mechanic inspired by LiDAR or positioning systems. These are future extensions and may be dropped without preventing completion.

# 4. Validation Plan

1. **Small-angle period:** With the support fixed and initial angle 0.05 rad, compare the measured period against 2π√(L/g) = 3.47460941 s. Require relative error below 1%.
2. **Conservative energy:** With the support fixed and damping absent, measure E = ½mL²θ̇² + mgL(1 − cos θ). Require maximum relative energy error below 0.1% over 60 simulated seconds.
3. **Moving-support checks:** Require finite state values and positive tension throughout the tested motion. Compare Δt = 1/240 s and 1/480 s over 60 s; require final position and velocity differences below 0.005 m and 0.005 m/s.
4. **Constraint diagnostic:** Check rope-length error below 10⁻¹⁰ m, recognizing that angular coordinates enforce length and this check alone does not validate the dynamics.

The gentle prescribed-motion prototype passed these tests. Stronger motion produced negative tension and failed the timestep comparison. Arbitrary player controls are not yet validated.

# 5. Biggest Risk + Fallback

The biggest risk is that player-controlled support acceleration drives the load outside the taut-rope model’s valid range. Even bounded acceleration does not guarantee positive tension throughout play.

I will limit support motion, monitor tension, and test representative control sequences. If this does not produce reliable gameplay, the fallback is a fixed-support pendulum challenge: choose an initial release angle and reach a marked target near a turning point at low speed. This retains the suspension physics, validation, and archaeological theme while removing moving-support control.

# 6. Timeline

| Week | Deliverable |
| --- | --- |
| 11 | Complete the suspension risk prototype, findings, proposal, and assigned peer feedback. |
| 12 | Integrate the model and finish one playable chamber; deploy the MUST version on GitHub Pages. |
| 13 | Test controls and robustness, address feedback, and prepare final documentation and presentation materials. Add optional features only if the core is complete. |
| 14 | Complete remaining course peer review and presentation activities; document limitations and possible future chambers. |

# 7. Audience

After two minutes, a general visitor should understand that moving a suspension point changes a load’s swing, and that safe transport requires controlling both position and speed.