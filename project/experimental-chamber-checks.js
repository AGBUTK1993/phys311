/* Phase 5E.5-A hotfix regression checks. No changes to playable chambers. */
import {createExperimentalState,stepExperimentalState,experimentalSnapshot,EXP_GEARS,EXP_DT} from './experimental-chamber-physics.js';
import {createPreservationState,updatePreservationState,preservationSnapshot} from './experimental-chamber-preservation.js';
function simulate({narrow=false,steps=720,control=null}={}) {
  const state=createExperimentalState({narrow});
  if(control)state.controls[control]=true;
  for(let i=0;i<steps;i++)stepExperimentalState(state,EXP_DT);
  return experimentalSnapshot(state);
}
export function runExperimentalChecks(){
  const checks=[];const check=(test,pass,actual)=>checks.push({test,pass:!!pass,actual});
  const wide=simulate(),narrow=simulate({narrow:true});
  const lowered=simulate({control:'down'});
  const moved=simulate({control:'right',steps:360});
  const raised=simulate({control:'up',steps:360});
  check('Wide pedestal: numerical state finite',Object.values(wide).filter(v=>typeof v==='number').every(Number.isFinite),wide.y);
  check('Narrow pedestal: numerical state finite',Object.values(narrow).filter(v=>typeof v==='number').every(Number.isFinite),narrow.y);
  check('Crate remains suspended with raised rail',wide.y>.75,wide.y);
  check('Symmetric suspension has no artificial rotation',Math.abs(wide.angle)<1e-8,wide.angle);
  check('Two ropes carry positive tension',wide.tensionLeft>0&&wide.tensionRight>0,`${wide.tensionLeft}, ${wide.tensionRight}`);
  check('Lowering the rail contacts the pedestal',lowered.contactSteps>100,lowered.contactSteps);
  check('Lowered crate rests at y = 0.725 m',Math.abs(lowered.y-.725)<1e-8,lowered.y);
  check('Lowered crate has zero vertical speed',Math.abs(lowered.vy)<1e-8,lowered.vy);
  check('Left/right controls move the rail',moved.railX>0.5,moved.railX);
  check('Rail movement influences crate position',moved.x>0.1,moved.x);
  check('Up control raises the rail',raised.railY>3.1,raised.railY);
  check('Snapshot remains immutable',Object.isFrozen(experimentalSnapshot(createExperimentalState())),null);
  const fine=createExperimentalState();fine.gear='fine';fine.controls.right=true;
  const normal=createExperimentalState();normal.gear='normal';normal.controls.right=true;
  const fast=createExperimentalState();fast.gear='fast';fast.controls.right=true;
  for(let i=0;i<180;i++){stepExperimentalState(fine,EXP_DT);stepExperimentalState(normal,EXP_DT);stepExperimentalState(fast,EXP_DT)}
  check('Three gears are defined',EXP_GEARS.length===3,EXP_GEARS.map(g=>g.label).join(', '));
  check('Gears have ordered rail speeds',fine.railX<normal.railX&&normal.railX<fast.railX,`${fine.railX.toFixed(3)} < ${normal.railX.toFixed(3)} < ${fast.railX.toFixed(3)}`);
  const coast=createExperimentalState();coast.controls.right=true;
  for(let i=0;i<120;i++)stepExperimentalState(coast,EXP_DT);
  coast.controls.right=false;const v0=coast.railVx;
  for(let i=0;i<120;i++)stepExperimentalState(coast,EXP_DT);
  check('Rail coasts to a controlled stop',v0>0&&Math.abs(coast.railVx)<1e-8,coast.railVx);
  const offset=createExperimentalState();offset.rightOffset=.1;
  for(let i=0;i<120;i++)stepExperimentalState(offset,EXP_DT);
  check('Anchor offset induces actual rotation',Math.abs(offset.body.angle)>1e-4,offset.body.angle);
  const gearSnap=experimentalSnapshot(fast);
  check('Snapshot includes selected gear and rail speed',gearSnap.gear==='fast'&&Number.isFinite(gearSnap.railVx),gearSnap.gear);

  // 5E.5-C: genuine impacts versus persistent contact.
  const quiet=createPreservationState('stone');
  for(let i=0;i<240;i++)updatePreservationState(quiet,{time:(i+1)*EXP_DT,separation:-0.0001,normalSpeed:i===0?-0.04:0,normalImpulse:i===0?0.08:0,mass:2});
  const quietSnap=preservationSnapshot(quiet);
  check('Gentle resting contact does not accumulate damage',quietSnap.recordedImpacts===0&&quietSnap.totalExposure===0,quietSnap.totalExposure);
  const rough=createPreservationState('ceramic');
  updatePreservationState(rough,{time:.1,separation:-.01,normalSpeed:-2,normalImpulse:4,mass:2});
  for(let i=1;i<=200;i++)updatePreservationState(rough,{time:.1+i*EXP_DT,separation:-.0001,normalSpeed:0,normalImpulse:0,mass:2});
  const roughSnap=preservationSnapshot(rough);
  check('Rough impact recorded exactly once despite resting contact',roughSnap.recordedImpacts===1&&roughSnap.totalExposure>0,roughSnap.recordedImpacts);
  check('Rough impact reduces preservation',roughSnap.preservation<100,roughSnap.preservation);
  check('Impact state reports distinct contact active',roughSnap.contactActive===true,roughSnap.contactActive);
  updatePreservationState(rough,{time:1.1,separation:.02,normalSpeed:0,mass:2});
  updatePreservationState(rough,{time:1.2,separation:-.01,normalSpeed:-1.2,normalImpulse:2.4,mass:2});
  const rebound=preservationSnapshot(rough);
  check('New landing after separation counts separately',rebound.recordedImpacts===2,rebound.recordedImpacts);
  const stone=createPreservationState('stone');
  updatePreservationState(stone,{time:.1,separation:-.01,normalSpeed:-2,normalImpulse:4,mass:2});
  check('Stone profile has lower demonstration exposure than ceramic',preservationSnapshot(stone).totalExposure<roughSnap.totalExposure,preservationSnapshot(stone).totalExposure);
  const loweredCondition=simulate({control:'down'});
  check('Lowered simulation exposes preservation snapshot',loweredCondition.preservation && Number.isFinite(loweredCondition.preservation.preservation),loweredCondition.preservation?.preservation);
  check('Snapshot provides delivery evaluation',loweredCondition.delivery && typeof loweredCondition.delivery.eligible==='boolean',loweredCondition.delivery?.eligible);
    return {passed:checks.every(x=>x.pass),checks};
}
