## Suspension damping for playable delivery

Planned: Use an undamped suspended load and require it to remain
fully inside the delivery zone below 0.2 m/s for one continuous
simulated second.

Observed: The load continued swinging. Near the turning points,
it slowed down but overlapped the zone boundary; inside the zone,
it moved too quickly. A separate stationary test successfully
triggered delivery after one second.

Changed: Added suspension damping with a rate of 0.35 s^-1.
The normal gameplay test then reached successful delivery.
The zone, speed limit, and required hold time were unchanged.

Physics consequence: The damper removes mechanical energy.
Conservation tests must disable damping and hold the support fixed.

## 2026-11-21 — Retrospective: interface and input

Decision: Keep gameplay controls as HTML elements over the canvas,
with settings and physics tools inside the menu.

Reason: Support keyboard, mouse, and touch interaction while keeping
the play area visible.

Behavior: Gameplay shortcuts operate when the game has focus.
Settings controls retain normal keyboard input. Opening the menu
pauses play; closing it does not automatically resume.

Validation: Main desktop controls and the menu/fullscreen sequence
were manually checked. Mobile testing found layout problems that
are being corrected incrementally.

## 2026-11-21 — Retrospective: chambers and vertical lifting

Decision: Use selectable chambers that introduce mechanics gradually.
Restart resets the selected chamber rather than the entire game.

Implementation: Added vertical support movement in the Upper Gallery
chamber. Vertical rail movement and rope-length adjustment are
separate controls.

Physics consequence: Moving the support can transfer energy to or
from the suspended artifact. Conservative testing fixes the support
and disables damping.

Validation: Chamber selection after the final chamber was confirmed
available. Vertical movement and chamber restart were manually checked.

## 2026-11-21 — Retrospective: winching and rope failure

Decision: Model a massless rope with adjustable length and distinct
taut, slack, and broken states.

Reason: Add lifting and failure mechanics while keeping the model
manageable for the beta.

Physics: Winching changes angular motion and tension. A slack or
broken rope exerts no tension. Breaking preserves the artifact's
velocity, after which it follows free fall.

Limitations: Slack recapture uses an ideal inelastic catch. The model
does not resolve an elastic catch-force peak. The curved slack-rope
drawing is illustrative, not a simulation of massive rope segments.
Floor and obstacle interactions remain future work.

Validation: Manual checks confirmed winching, deliberate breaking,
restart, chamber navigation, and conservative-mode controls.
Mobile verification follows deployment.

## 2026-11-22 — Current increment: winch gears and strength

Decision: Add Fine, Normal, and Fast winch gears, controlled with
H/K, numpad 4/6, and on-screen buttons. Retain U/J, numpad 8/2,
and the slider for rope-length control.

Reason: Let players trade precision for speed and greater tension.

Decision: Reduce default breaking strength from 35 N to 26 N.
This changes rope strength, not the tension required to support
the artifact.

Evidence: Development numerical checks found ordinary chamber
completion below 22 N peak tension. Combined lifting and fast
reeling exceeded 26 N in a tested case.

Status: Integration checks are pending. Syntax errors in main.js
must be resolved before this increment is committed.

## 2026-11-22 — Presentation and fullscreen

Decision: Group support and rope-length sliders in one panel.
Remove the shortcut strip and provide a Controls button beside Menu.

Decision: Give the ball-box scene the sandstone background.
Fit its existing arena more closely with the camera.

Constraint: Entering fullscreen must not restart the simulation,
move collision walls, or alter physical state. Preserve uniform
scaling so circles remain circular.

## 2026-11-22 — Planned Egyptian astronomy expansion

Decision: Develop the orbit scene as Senenmut's Celestial Chamber,
using documented Egyptian astronomical imagery.

Constraint: Distinguish historical imagery and uncertain star
identifications from the modern physics used for gameplay.

Future possibilities: Sopdet's Return and a decan-based night clock.
These are planned ideas, not implemented features.

## 2026-11-22 — Desktop checkpoint and remaining layout issues

Validation: Desktop checks passed except for the layout issues
listed below. Mobile testing remains pending deployment.

Known issues:
- The ball-arena boundaries do not yet match the sandstone play area
  and currently overlap the upper teal banner.
- The slider and gear panel occupies too much vertical space.
- A lower-left control appears obscured by Menu and Controls.

Next changes: Compact the slider panel, separate overlapping controls,
and align the arena presentation with the sandstone region.
Fullscreen must preserve the running simulation's physical state.

Planned scarab artwork: Approximately 65% deep lapis-ultramarine
and 35% Egyptian blue. Exact colors will follow reference photos.
This artwork is not implemented yet.