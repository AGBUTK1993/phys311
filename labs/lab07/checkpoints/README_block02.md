# Block 2 Checkpoint: Colliding Spring-Connected Masses

## Overview
Four equal-mass circular bodies interact through three springs and
frictionless elastic collisions while falling under uniform gravity.
The scene uses the reusable Lab 7 physics engine.

## Required software
Python 3, Jupyter Notebook or JupyterLab, NumPy, and Matplotlib.

## File layout
Keep block02_checkpoint.ipynb beside the lab07_engine folder.
The checkpoints folder contains this README and the exported figures.

## How to run
Open block02_checkpoint.ipynb in Jupyter.
Choose Restart Kernel and Run All Cells.
Run from the folder containing the notebook and lab07_engine.
The final code cell regenerates the figures and this README.

## Engine architecture
- Body stores each body's physical properties and current state.
- Force objects calculate forces and potential energy.
- VelocityVerlet advances positions and velocities.
- CircleCollisions handles contact impulses and overlap correction.
- World combines the components, advances time, and records results.

The notebook configures the scene and analyzes recorded data.
Time stepping takes place inside the engine.

## Physical model
- Four bodies, each with mass 1 kg and radius 0.2 m.
- Three springs, each with stiffness 2 N/m and rest length 1 m.
- Uniform gravitational acceleration of 1 m/s^2 downward.
- Elastic collisions with coefficient of restitution 1.
- Simulation duration of 2 s and main time step of 0.001 s.
- No walls, ground, air resistance, or contact friction.

## Validation
Horizontal momentum should remain constant.
Vertical momentum should follow Py(t) = -M*g*t because initial
vertical momentum is zero.
Total mechanical energy includes kinetic, gravitational potential,
and spring potential energy.

The notebook checks these quantities and compares energy errors
at time steps of 0.002, 0.001, and 0.0005 s.
The collision overlap corrections can introduce numerical energy error.

## Visual walkthrough
block02_sequence.png shows six snapshots of the motion.
Colors and numbers identify the bodies, connecting lines represent
springs, and arrows indicate horizontal velocity.
block02_validation.png shows the energy and momentum checks.

## Limitations
Collisions are detected at discrete time steps, so choosing a sufficiently
small time step matters. The model uses ideal springs and frictionless
contacts and does not model collision-induced rotation.
