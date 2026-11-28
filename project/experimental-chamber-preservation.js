/* 5E.5-C: gameplay exposure from discrete rectangular normal impacts.
 * This is a proxy index, NOT fracture or physical damage prediction.
 */
import {createContactEventTracker,updateContactEventTracker} from './engine/contact-events.js';
import {classifyImpactSeverity} from './engine/impact-severity.js';
import {DEMO_ARTIFACT_PROFILES,evaluateArtifactImpactExposure} from './engine/artifact-vulnerability.js';
import {createArtifactImpactTracker,recordArtifactImpact,getArtifactImpactSummary} from './engine/artifact-impact-tracker.js';
import {evaluateArtifactCondition} from './engine/artifact-condition.js';

export const EXP_ARTIFACT_CHOICES=Object.freeze(['ceramic','stone','metal']);
export function createPreservationState(profileKey='stone') {
  if(!EXP_ARTIFACT_CHOICES.includes(profileKey))throw new Error('Unknown experimental artifact profile');
  const profile=DEMO_ARTIFACT_PROFILES[profileKey];
  return {
    profileKey,profile,
    contact:createContactEventTracker({bodyId:'experimental-crate',surfaceId:'experiment-pedestal',minimumImpactSpeed:0.1,releaseDistance:0.01}),
    tracker:createArtifactImpactTracker({artifactId:profile.id,minimumExposure:0.1}),
    lastImpact:null,processedContacts:0
  };
}
export function updatePreservationState(state,{time,separation,normalSpeed,normalImpulse=0,mass=2}) {
  const tracked=updateContactEventTracker(state.contact,{time,separation,normalSpeed});
  if(!tracked.event)return Object.freeze({state:tracked.state,recorded:false});
  const incomingSpeed=tracked.event.incomingNormalSpeed;
  // For rotational contacts this is a translational-equivalent GAMEPLAY proxy,
  // not the kinetic energy dissipated by the full rigid-body collision.
  const analysis=Object.freeze({incomingNormalSpeed:incomingSpeed,normalEnergyBefore:0.5*mass*incomingSpeed**2,normalImpulse});
  const severity=classifyImpactSeverity(analysis);
  const exposure=evaluateArtifactImpactExposure(analysis,state.profile);
  const result=recordArtifactImpact(state.tracker,{eventId:tracked.event.eventId,time,severity,exposure});
  state.lastImpact=Object.freeze({time,speed:incomingSpeed,impulse:normalImpulse,severity:severity.intensity,exposure:exposure.exposureScore,accepted:result.accepted,reason:result.reason});
  return Object.freeze({state:tracked.state,recorded:result.accepted,reason:result.reason});
}
export function preservationSnapshot(s){
  const summary=getArtifactImpactSummary(s.tracker);
  const condition=evaluateArtifactCondition(summary);
  return Object.freeze({profileKey:s.profileKey,profileName:s.profile.label,condition:condition.condition,preservation:condition.preservationScore,failed:condition.failed,totalExposure:summary.totalExposure,recordedImpacts:summary.recordedImpacts,filteredImpacts:summary.filteredImpacts,lastImpact:s.lastImpact,contactActive:s.contact.inContact});
}
export function evaluateExperimentalDelivery(s,{body,pedestal,ropeTensions}){
  const p=preservationSnapshot(s);
  const geometry=body.geometry;
  const half=geometry.height/2;
  const bottom=body.pos.y-half;
  const centered=body.pos.x>=pedestal.xMin-1e-6&&body.pos.x<=pedestal.xMax+1e-6;
  const stable=Math.abs(body.vel.x)<0.06&&Math.abs(body.vel.y)<0.06&&Math.abs(body.angularVelocity)<0.08&&Math.abs(body.angle)<0.08;
  const supported=Math.abs(bottom-pedestal.topY)<0.012&&centered;
  return Object.freeze({eligible:stable&&supported&&!p.failed,stable,supported,condition:p.condition,preservation:p.preservation,recordedImpacts:p.recordedImpacts,reason:p.failed?'Preservation threshold exceeded':!supported?'Position artifact over the pedestal':!stable?'Allow artifact motion to settle':'Delivered and evaluated'});
}
