/* Isolated PHYS 311 / Phase 5E.5 prototype. SI units, y positive upward.
 * This module deliberately does NOT import the playable suspension world.
 * Rope model: ideal, massless, tension-only linear springs.
 * Surface model: immovable, horizontal, frictionless, discrete contacts.
 */
import { Body } from './engine/body.js';
import { createPedestal } from './engine/pedestals.js';
import { applyAttachmentSpring } from './engine/attachment-spring.js';
import { stepRigidBody } from './engine/rigid-body-integrator.js';
import { sampleRectanglePedestalContacts } from './engine/rectangle-contact-geometry.js';
import { resolveRectangleActiveContacts } from './engine/rectangle-contact-active-set.js';
import { correctRectanglePedestalPenetration } from './engine/rectangle-support-correction.js';

export const EXP_DT = 1 / 240;
export const EXP_G = 9.81;
export const EXP_GEARS = Object.freeze([
  Object.freeze({id:'fine',label:'Fine',horizontal:0.28,vertical:0.22,accel:1.1}),
  Object.freeze({id:'normal',label:'Normal',horizontal:0.65,vertical:0.50,accel:2.8}),
  Object.freeze({id:'fast',label:'Fast',horizontal:1.00,vertical:0.78,accel:4.8})
]);
export const EXP_ATTACHMENTS = Object.freeze([{x: -0.4, y: 0}, {x: 0.4, y: 0}]);
const bounded = (v,a,b) => Math.max(a, Math.min(b,v));

export function createExperimentalState({narrow=false}={}) {
  const body = new Body({m:2, name:'Experimental stone crate'});
  body.configureGeometry({type:'rectangle',width:1.2,height:0.25});
  body.pos.set(0,2);
  const pedestal = createPedestal({id:'experiment-pedestal',x:0,topY:0.6,width:narrow?0.6:2,height:0.4});
  return {
    body,pedestal,narrow, time:0,steps:0, paused:true,error:null,
    railX:0, railY:3, railVx:0, railVy:0, gear:'normal', rightOffset:0, tensions:[0,0], contactSteps:0,
    lastReaction:0, impacts:0, wasInContact:false, maxPenetration:0,
    controls:{left:false,right:false,up:false,down:false}
  };
}

export function stepExperimentalState(s,dt=EXP_DT) {
  if (!Number.isFinite(dt)||dt<=0) throw new Error('Invalid experimental timestep');
  const b=s.body;
  const gear=EXP_GEARS.find(g=>g.id===s.gear) || EXP_GEARS[1];
  const targetVx=(Number(s.controls.right)-Number(s.controls.left))*gear.horizontal;
  const targetVy=(Number(s.controls.up)-Number(s.controls.down))*gear.vertical;
  const approach=(current,target,limit)=>current+bounded(target-current,-limit,limit);
  s.railVx=approach(s.railVx,targetVx,gear.accel*dt);
  s.railVy=approach(s.railVy,targetVy,gear.accel*dt);
  const oldX=s.railX, oldY=s.railY;
  s.railX=bounded(s.railX+s.railVx*dt,-2.2,2.2);
  s.railY=bounded(s.railY+s.railVy*dt,2.35,3.5);
  if(s.railX===oldX && Math.abs(s.railX)>=2.2-1e-10)s.railVx=0;
  if(s.railY===oldY && (s.railY<=2.35+1e-10 || s.railY>=3.5-1e-10))s.railVy=0;
  b.force.y-=b.m*EXP_G;
  // Mild viscous air damping; prevents endless spring oscillation.
  b.force.x-=2.5*b.vel.x;
  b.force.y-=2.5*b.vel.y;
  b.applyTorque(-0.7*b.angularVelocity);
  const anchors=EXP_ATTACHMENTS.map((p,i)=>({x:s.railX+p.x,y:s.railY+(i===1?s.rightOffset:0)}));
  s.tensions=EXP_ATTACHMENTS.map((p,i)=>applyAttachmentSpring(b,p,anchors[i],{
    stiffness:24,restLength:1.55
  }).tension);
  stepRigidBody(b,dt);
  const contacts=sampleRectanglePedestalContacts(b,s.pedestal);
  const touching=contacts.length>0;
  s.lastReaction=0;
  if(touching){
    const collision=resolveRectangleActiveContacts(b,contacts,{restitution:0});
    s.lastReaction=collision.totalNormalImpulse/dt;
    const correction=correctRectanglePedestalPenetration(b,s.pedestal);
    s.maxPenetration=Math.max(s.maxPenetration,correction.remainingMaximumPenetration);
    s.contactSteps++;
    if(!s.wasInContact && contacts.some(c=>c.normalSpeed< -0.1)) s.impacts++;
  }
  s.wasInContact=touching;
  s.time+=dt;s.steps++;
  if(![b.pos.x,b.pos.y,b.vel.x,b.vel.y,b.angle,b.angularVelocity,s.lastReaction,...s.tensions].every(Number.isFinite)){
    throw new Error('Non-finite experimental dynamics');
  }
  return s;
}

export function experimentalSnapshot(s){
  const b=s.body;
  return Object.freeze({time:s.time,x:b.pos.x,y:b.pos.y,vx:b.vel.x,vy:b.vel.y,
    angle:b.angle,omega:b.angularVelocity,railX:s.railX,railY:s.railY,
    railVx:s.railVx,railVy:s.railVy,gear:s.gear,rightOffset:s.rightOffset,
    tensionLeft:s.tensions[0],tensionRight:s.tensions[1],
    contactSteps:s.contactSteps,impacts:s.impacts,reaction:s.lastReaction,
    maxPenetration:s.maxPenetration,narrow:s.narrow,error:s.error});
}
