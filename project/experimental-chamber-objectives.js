/* Phase 5E.5-D: read-only gameplay objective / evaluation display.
 * Uses the existing delivery decision; never replaces the physics solver.
 * Preservation is a gameplay exposure score, not a fracture prediction.
 */
export function summarizeDeliveryAttempt(snapshot, {attemptNumber=1}={}) {
  const d=snapshot?.delivery, p=snapshot?.preservation;
  if(!d || !p || !Number.isFinite(snapshot?.time) || !Number.isFinite(p.preservation) ||
     !Number.isInteger(attemptNumber) || attemptNumber<1) throw new Error('Invalid delivery snapshot');
  const reasons=[];
  if(!d.supported) reasons.push('Place the artifact on the pedestal');
  if(!d.stable) reasons.push('Allow motion to settle');
  if(p.failed) reasons.push('Preservation threshold exceeded');
  const result=p.failed?'failed':d.eligible?'accepted':'not-ready';
  const grade=result==='accepted' ? (
    p.preservation>=95?'Exceptional':
    p.preservation>=85?'Excellent':
    p.preservation>=70?'Careful':'Recovered'
  ):null;
  const summary=Object.freeze({
    result,grade,attemptNumber,
    time: snapshot.time,
    preservation:p.preservation,
    condition:p.condition,
    impacts:p.recordedImpacts,
    filtered:p.filteredImpacts,
    stable:Boolean(d.stable),supported:Boolean(d.supported),
    reasons:Object.freeze(reasons),
    message:result==='accepted' ? `DELIVERY ACCEPTED — ${grade} recovery (${p.preservation.toFixed(1)}% preservation).` :
      result==='failed'?`DELIVERY FAILED — ${reasons.join('; ')}. Select Retry attempt.` :
      `NOT READY — ${reasons.join('; ')}.`
  });
  return summary;
}
export function objectiveStatus(snapshot) {
  const d=snapshot?.delivery, p=snapshot?.preservation;
  if(!d || !p) throw new Error('Invalid objective snapshot');
  return Object.freeze({
    positioned: Boolean(d.supported),
    settled: Boolean(d.stable),
    preserved: !Boolean(p.failed),
    ready: Boolean(d.eligible),
  });
}
