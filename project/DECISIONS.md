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