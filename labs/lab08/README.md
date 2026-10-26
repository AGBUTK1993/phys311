# PHYS 311 — Lab 8
Alex Bebb

This project ports the vector, body, and integration code from my Python
physics engine to JavaScript and displays projectile motion on an HTML
canvas. To run it locally, open index.html using VS Code's Live Server.
Choose the integration method, fixed or variable time stepping, and
the fixed step size, then click Launch projectile. The optional lag
checkbox adds a 50 ms delay per frame for the timing experiment.
Settings apply to the next launch, and the fixed step size applies
only in fixed mode. The display shows a fading trail and the current
position, speed, and energies. Refreshing restores the static Part A
scene and reruns the console validation tests.