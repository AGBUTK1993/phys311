/* Phase 5E.6-A: read-only automated regression and physical-invariant checks. */
import { runExperimentalChecks } from './experimental-chamber-checks.js';
import { Body } from './engine/body.js';
import { applyAttachmentSpring } from './engine/attachment-spring.js';
import { stepRigidBody } from './engine/rigid-body-integrator.js';
import { createPedestal } from './engine/pedestals.js';
import { sampleRectanglePedestalContacts } from './engine/rectangle-contact-geometry.js';
import { resolveRectangleActiveContacts } from './engine/rectangle-contact-active-set.js';
import { correctRectanglePedestalPenetration } from './engine/rectangle-support-correction.js';

const close=(a,b,tol=1e-8)=>Number.isFinite(a)&&Math.abs(a-b)<=tol;
function bodyRectangle(m=2,x=0,y=1.1,angle=0,vy=0){
  const b=new Body({m});b.configureGeometry({type:'rectangle',width:1.2,height:.25});
  b.pos.set(x,y);b.angle=angle;b.vel.set(0,vy);return b;
}
function contactTest(width, restitution){
  const p=createPedestal({id:'suite-support',x:0,topY:1,width,height:.35});
  const b=bodyRectangle(2,0,1.1,0,-3);
  const contacts=sampleRectanglePedestalContacts(b,p);
  const before=b.kineticEnergy()+b.rotationalKineticEnergy();
  const result=resolveRectangleActiveContacts(b,contacts,{restitution});
  const after=b.kineticEnergy()+b.rotationalKineticEnergy();
  const correction=correctRectanglePedestalPenetration(b,p);
  return {body:b,result,contacts,before,after,correction};
}
function coupledSupport(width){
  const b=bodyRectangle(2,0,2);
  const p=createPedestal({id:'suite-coupled',x:0,topY:1,width,height:.35});
  const points=[-.4,.4],dt=1/240;
  let last=[0,0],impulse=0,count=0, maxAngle=0,maxPen=0;
  for(let i=0;i<720;i++){
    b.force.y-=b.m*9.81;
    last=points.map(x=>applyAttachmentSpring(b,{x,y:0},{x,y:3},{stiffness:15,restLength:1.5}).tension);
    stepRigidBody(b,dt);
    const contacts=sampleRectanglePedestalContacts(b,p);
    if(contacts.length){
      count++;
      impulse=resolveRectangleActiveContacts(b,contacts,{restitution:0}).totalNormalImpulse;
      maxPen=Math.max(maxPen,correctRectanglePedestalPenetration(b,p).remainingMaximumPenetration);
    }
    maxAngle=Math.max(maxAngle,Math.abs(b.angle));
  }
  return {b,last,normal:impulse/dt,count,maxAngle,maxPen};
}

export function runPhysicsTestSuite(){
  const suites=[];
  const add=(group,name,fn)=>{
    try{
      const {pass,actual,expected}=fn();
      suites.push(Object.freeze({group,name,pass:pass===true,actual:String(actual??''),expected:String(expected??'')}));
    }catch(error){suites.push(Object.freeze({group,name,pass:false,actual:`EXCEPTION: ${error.message}`,expected:'No exception'}));}
  };
  // The existing 32-item batch suite is retained verbatim as the canonical gameplay regression.
  try{
    const prior=runExperimentalChecks();
    for(const c of prior.checks){
      suites.push(Object.freeze({group:'Experimental gameplay (existing)',name:c.test,pass:c.pass===true,actual:String(c.actual??''),expected:'PASS'}));
    }
  }catch(error){add('Experimental gameplay (existing)','Existing suite executes',()=>({pass:false,actual:error.message,expected:'Runs without exception'}));}
  add('Rigid bodies','Disk moment of inertia',()=>{const b=new Body({m:2,radius:.22});return {pass:close(b.inertia,.0484),actual:b.inertia,expected:.0484};});
  add('Rigid bodies','Rectangular moment of inertia',()=>{const b=bodyRectangle();return {pass:close(b.inertia,2*(1.2**2+.25**2)/12),actual:b.inertia,expected:2*(1.2**2+.25**2)/12};});
  add('Rigid bodies','Force at offset generates torque',()=>{const b=new Body({m:2,radius:.22});b.applyForceAtPoint({x:0,y:10},{x:.2,y:0});return {pass:close(b.torque,2)&&close(b.force.y,10),actual:`torque=${b.torque}, Fy=${b.force.y}`,expected:'2 N m and 10 N'};});
  add('Rigid bodies','Free translation preserves velocity',()=>{const b=new Body({m:2});b.vel.set(1,-2);for(let i=0;i<1000;i++)stepRigidBody(b,.001);return {pass:close(b.vel.x,1)&&close(b.vel.y,-2)&&close(b.pos.x,1,1e-10)&&close(b.pos.y,-2,1e-10),actual:`pos=(${b.pos.x},${b.pos.y})`,expected:'(1,-2)'};});
  add('Ropes','Tension-only spring slack',()=>{const b=new Body({m:2});const r=applyAttachmentSpring(b,{x:0,y:0},{x:0,y:.5},{stiffness:20,restLength:1});return {pass:r.tension===0&&b.force.y===0,actual:r.tension,expected:0};});
  add('Ropes','Spring tension and elastic energy',()=>{const b=new Body({m:2});const r=applyAttachmentSpring(b,{x:0,y:0},{x:0,y:2},{stiffness:10,restLength:1});return {pass:close(r.tension,10)&&close(r.elasticEnergy,5),actual:`T=${r.tension} E=${r.elasticEnergy}`,expected:'10 N, 5 J'};});
  add('Ropes','Symmetric attachments cancel torque',()=>{const b=bodyRectangle(2,0,0);for(const x of [-.4,.4])applyAttachmentSpring(b,{x,y:0},{x,y:2},{stiffness:10,restLength:1});return {pass:close(b.torque,0)&&close(b.force.y,20),actual:`torque=${b.torque}, Fy=${b.force.y}`,expected:'0 N m and 20 N'};});
  add('Contacts','Wide pedestal flat inelastic contact',()=>{const r=contactTest(2,0);return {pass:r.contacts.length===2&&r.result.contacts.every(c=>close(c.normalImpulse,3))&&close(r.body.vel.y,0),actual:`contacts=${r.contacts.length}, J=${r.result.totalNormalImpulse}`,expected:'2 contacts, 6 N s'};});
  add('Contacts','Narrow pedestal edge contact',()=>{const r=contactTest(.4,0);return {pass:r.contacts.length===2&&r.contacts.every(c=>c.vertexId.startsWith('bottom-edge'))&&close(r.body.angularVelocity,0,1e-10),actual:`contacts=${r.contacts.map(c=>c.vertexId).join(', ')}`,expected:'2 bottom-edge contacts'};});
  add('Contacts','Elastic flat collision preserves kinetic energy',()=>{const r=contactTest(.4,1);return {pass:close(r.before,r.after,1e-10)&&close(r.body.vel.y,3),actual:`energy delta=${r.after-r.before}`,expected:'0 J, rebound +3 m/s'};});
  add('Contacts','Penetration correction preserves velocity',()=>{const p=createPedestal({id:'suite-correction',x:0,topY:1,width:.4,height:.35});const b=bodyRectangle(2,0,1.1,0,-2);const r=correctRectanglePedestalPenetration(b,p);return {pass:close(r.correction,.025)&&close(b.pos.y,1.125)&&close(b.vel.y,-2),actual:`correction=${r.correction} vy=${b.vel.y}`,expected:'0.025 m and unchanged -2 m/s'};});
  add('Coupled dynamics','Wide support shares weight with two ropes',()=>{const r=coupledSupport(2);return {pass:r.count>100&&close(r.last[0],5.625,.02)&&close(r.last[1],5.625,.02)&&close(r.normal,8.37,.1)&&r.maxPen<1e-8,actual:`T=${r.last.join('/')}; N=${r.normal.toFixed(4)}; contacts=${r.count}`,expected:'5.625+5.625+8.37=19.62 N'};});
  add('Coupled dynamics','Narrow support shares weight with two ropes',()=>{const r=coupledSupport(.4);return {pass:r.count>100&&close(r.last[0],5.625,.02)&&close(r.normal,8.37,.1)&&r.maxAngle<1e-8&&r.maxPen<1e-8,actual:`N=${r.normal.toFixed(4)}; angle=${r.maxAngle}`,expected:'8.37 N; no rotation'};});
  const counts={total:suites.length,passed:suites.filter(t=>t.pass).length};counts.failed=counts.total-counts.passed;
  return Object.freeze({pass:counts.failed===0,counts:Object.freeze(counts),tests:Object.freeze(suites)});
}
