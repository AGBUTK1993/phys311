# Suspension Prototype Findings

I tested a suspended load with a fixed-length rope represented by an angular coordinate. The prototype uses velocity Verlet and compares a stationary support with a horizontally moving support. The load has mass 2 kg, rope length 3 m, and gravitational acceleration 9.81 m/s².

With the support fixed, the measured small-angle period was 3.47514418 s, compared with the theoretical 3.47460941 s: approximately 0.0154% error. Maximum relative energy error over 60 simulated seconds was approximately 0.00142%, below the 0.1% tolerance.

For gentle support motion, A = 0.25 m and angular frequency 1.2 rad/s, all tests passed. Minimum tension was 18.782274 N. Halving the timestep from 1/240 s to 1/480 s changed the final position by approximately 0.000142 m and velocity by 0.000109 m/s.

Increasing A to 2 m and angular frequency to 3 rad/s exposed a limitation. Calculated tension became negative, reaching −33.507044 N. A real rope cannot push, so the taut-rope model becomes physically invalid. The timestep comparison also failed, with differences of approximately 0.254 m and 22.695 m/s. Tiny rope-length error did not establish accuracy because the angular representation enforces length automatically.

These results narrow the first playable chamber to controlled support motion with tension monitoring. Player controls still require testing. If moving-support gameplay cannot remain reliable, the fallback is a fixed-support pendulum challenge. Slack-rope dynamics, collisions, springs, and additional chambers remain future extensions.