import {createExperimentalState,stepExperimentalState,experimentalSnapshot,EXP_DT,EXP_ATTACHMENTS,EXP_GEARS} from './experimental-chamber-physics.js';
import {runExperimentalChecks} from './experimental-chamber-checks.js';
const $=id=>document.getElementById(id);
const canvas=$('expCanvas'),ctx=canvas.getContext('2d');
let state=createExperimentalState();let accumulator=0,last=0;
let notice='Ready for testing.';
const gearLabel=()=>EXP_GEARS.find(g=>g.id===state.gear)?.label||'Normal';
const cycleGear=()=>{const i=EXP_GEARS.findIndex(g=>g.id===state.gear);state.gear=EXP_GEARS[(i+1)%EXP_GEARS.length].id;notice=`${gearLabel()} gear selected.`};
const scale=130;
const sx=x=>canvas.width/2+x*scale;
const sy=y=>canvas.height-78-y*scale;
function line(ax,ay,bx,by,color,width=3){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(sx(ax),sy(ay));ctx.lineTo(sx(bx),sy(by));ctx.stroke()}
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#ddc395';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='#c5aa7b';ctx.lineWidth=1;
  for(let y=0;y<canvas.height;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
  const p=state.pedestal,b=state.body;
  ctx.fillStyle='#917449';ctx.fillRect(sx(p.xMin),sy(p.topY),p.width*scale,p.height*scale);
  ctx.fillStyle='#5c5c54';ctx.fillRect(sx(p.xMin),sy(p.topY)-6,p.width*scale,8);
  const anchors=EXP_ATTACHMENTS.map((v,i)=>({x:state.railX+v.x,y:state.railY+(i===1?state.rightOffset:0)}));
  line(anchors[0].x,anchors[0].y,anchors[1].x,anchors[1].y,'#354b4f',8);
  EXP_ATTACHMENTS.forEach((a,i)=>{const w=b.localPointToWorld(a);line(anchors[i].x,anchors[i].y,w.x,w.y,state.tensions[i]>0?'#77502c':'#a69a85',3)});
  ctx.save();ctx.translate(sx(b.pos.x),sy(b.pos.y));ctx.rotate(-b.angle);
  ctx.fillStyle='#b68b50';ctx.strokeStyle='#644322';ctx.lineWidth=3;
  ctx.fillRect(-.6*scale,-.125*scale,1.2*scale,.25*scale);
  ctx.strokeRect(-.6*scale,-.125*scale,1.2*scale,.25*scale);
  ctx.strokeStyle='#e4c997';ctx.strokeRect(-.53*scale,-.09*scale,1.06*scale,.18*scale);
  ctx.restore();
  // Draw tension as both line color and a small live label.
  EXP_ATTACHMENTS.forEach((a,i)=>{const w=b.localPointToWorld(a),t=state.tensions[i];const anchor=anchors[i];ctx.fillStyle=t>32?'#a33c32':t>22?'#985a19':'#274c4b';ctx.font='bold 13px system-ui';ctx.fillText(`${i===0?'L':'R'}: ${t.toFixed(1)} N`,sx((w.x+anchor.x)/2)+(i===0?-72:10),sy((w.y+anchor.y)/2))});
  ctx.fillStyle='#2d4d48';ctx.font='bold 17px system-ui';ctx.fillText('EXPERIMENTAL — original chambers untouched',18,30);
  ctx.font='14px system-ui';ctx.fillText(`Pedestal: ${state.narrow?'narrow':'wide'}  •  ${state.paused?'PAUSED':'RUNNING'}`,18,55);
}
function updateUI(){const s=experimentalSnapshot(state);
  const p=s.preservation;
  $('expCondition').textContent=`Condition: ${p.condition.toUpperCase()}`;
  $('expPreservationValue').textContent=`${p.preservation.toFixed(1)}%`;
  $('expPreservationBar').value=p.preservation;
  document.querySelector('.preservation-box').className='preservation-box'+(p.failed?' critical':p.condition==='critical'?' critical':p.condition==='caution'?' caution':'');
  $('expImpactInfo').textContent=`Recorded landings: ${p.recordedImpacts} | Filtered: ${p.filteredImpacts} | Exposure: ${p.totalExposure.toFixed(3)}${p.lastImpact?` | Last: ${p.lastImpact.speed.toFixed(2)} m/s (${p.lastImpact.severity}, ${p.lastImpact.reason})`:''}`;
  $('expReadout').textContent=`Gear ${gearLabel()} | Offset ${s.rightOffset.toFixed(2)} m\nTime ${s.time.toFixed(2)} s\nCrate x ${s.x.toFixed(3)} m, y ${s.y.toFixed(3)} m\nAngle ${(s.angle*180/Math.PI).toFixed(2)}°\nVertical speed ${s.vy.toFixed(3)} m/s\nRail x ${s.railX.toFixed(2)} m, y ${s.railY.toFixed(2)} m\nLeft rope ${s.tensionLeft.toFixed(2)} N\nRight rope ${s.tensionRight.toFixed(2)} N\nPedestal force ${s.reaction.toFixed(2)} N\nContact steps ${s.contactSteps}\nDetected impacts ${s.impacts}`;
  $('expToggle').textContent=state.paused?'Start / resume':'Pause';
  $('expWidth').textContent=state.narrow?'Use wide pedestal':'Use narrow pedestal';
  $('expOffset').textContent=state.rightOffset?'Level right anchor':'Raise right anchor';
  $('expGear').textContent=`Gear: ${gearLabel()}`;
  $('expLeftMeter').value=Math.min(45,s.tensionLeft);$('expRightMeter').value=Math.min(45,s.tensionRight);
  const warn=Math.max(s.tensionLeft,s.tensionRight);const alert=$('expAlert');
  alert.className='exp-alert'+(state.error?' danger':warn>=32?' danger':warn>=22?' warning':'');
  alert.textContent=state.error?`PAUSED: ${state.error}`:warn>=32?'HIGH TENSION — experimental spring model; no rope breaking enabled':warn>=22?'Elevated rope tension — use Fine gear':s.rightOffset?'Asymmetric anchors: tilt and contact are experimental':notice;
}
function clearControls(){for(const key of Object.keys(state.controls))state.controls[key]=false}
function fail(err){state.paused=true;clearControls();state.error=String(err?.message||err);$('expStatus').textContent=`Simulation paused: ${state.error}. Reset the scene.`;console.error(err)}
function frame(t){if(!last)last=t;const delta=Math.min((t-last)/1000,0.05);last=t;
  if(!state.paused){accumulator+=delta;let n=0;while(accumulator>=EXP_DT&&n<12){try{stepExperimentalState(state)}catch(e){fail(e);break}accumulator-=EXP_DT;n++}if(n===12)accumulator=0}
  draw();updateUI();requestAnimationFrame(frame)}
function reset(){const narrow=state.narrow,gear=state.gear,artifactProfile=$('expProfile').value;state=createExperimentalState({narrow,artifactProfile});$('expDelivery').textContent='Set the artifact on the pedestal and allow it to settle.';state.gear=gear;notice='Reset complete.';accumulator=0;$('expStatus').textContent='Reset complete. Press Start, then move the rail with the arrows/W/S or on-screen controls.'}
$('expToggle').onclick=()=>{state.paused=!state.paused;clearControls();accumulator=0;$('expStatus').textContent=state.paused?'Paused. Press Start to resume.':'Running. Hold the direction buttons or use the keyboard; lower the rail to land, raise it to lift.'};
$('expReset').onclick=reset;
$('expWidth').onclick=()=>{state.narrow=!state.narrow;reset()};
$('expOffset').onclick=()=>{state.rightOffset=state.rightOffset?0:0.1;notice=state.rightOffset?'Right anchor raised 0.10 m. Watch for rotation.':'Anchor heights leveled.'};
$('expGear').onclick=cycleGear;
$('expProfile').onchange=reset;
$('expEvaluate').onclick=()=>{const d=experimentalSnapshot(state).delivery;$('expDelivery').textContent=d.eligible?`DELIVERY ACCEPTED — ${d.preservation.toFixed(1)}% preservation (${d.condition}).`:`NOT READY — ${d.reason}.`};
$('expCenter').onclick=()=>{state.railX=0;state.railVx=0;state.controls.left=false;state.controls.right=false;notice='Rail centered; crate motion continues naturally.'};
$('expCheck').onclick=()=>{const report=runExperimentalChecks();console.table(report.checks);$('expChecks').textContent=report.checks.map(x=>`${x.pass?'PASS':'FAIL'}  ${x.test}`).join('\n')+`\n\n${report.passed?'BATCH PASS':'BATCH FAIL'}`};
const keys={ArrowLeft:'left',ArrowRight:'right',KeyA:'left',KeyD:'right',KeyW:'up',KeyS:'down',ArrowUp:'up',ArrowDown:'down'};
window.addEventListener('keydown',e=>{
  if(e.target?.matches('input,textarea,select,[contenteditable="true"]'))return;
  if(keys[e.code]){state.controls[keys[e.code]]=true;e.preventDefault()}
  if(e.code==='KeyG'&&!e.repeat){cycleGear();e.preventDefault()}
  if(e.code==='Space'&&!e.repeat){state.paused=!state.paused;clearControls();accumulator=0;e.preventDefault()}
});
window.addEventListener('keyup',e=>{if(keys[e.code]){state.controls[keys[e.code]]=false;e.preventDefault()}});
window.addEventListener('blur',clearControls);
// Pointer controls also work on touchscreens. Releasing the pointer stops movement.
for(const button of document.querySelectorAll('[data-exp-move]')){
  const direction=button.dataset.expMove;
  const stop=()=>{state.controls[direction]=false;button.classList.remove('held')};
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);state.controls[direction]=true;button.classList.add('held')});
  button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);
  button.addEventListener('lostpointercapture',stop);
}
window.burialExperiment={snapshot:()=>experimentalSnapshot(state),runChecks:runExperimentalChecks};
requestAnimationFrame(frame);
