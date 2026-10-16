import {createNegotiation,getNegotiation,retryNegotiation,openNegotiationStream} from './api';
import {displayBundle,displaySnapshot,summarizeEvent,buildFrontendRequest} from './backend-adapter';
import {registerBackendItems} from './catalog';
import {update,event,type Session,type Status} from './store';
import type {BackendEvent,BackendSnapshot} from './backend-contracts';

export function applySnapshot(snapshot:BackendSnapshot){
 const display=displaySnapshot(snapshot);
 update(s=>{
  if(s.backendId!==snapshot.negotiation.id)return s;
  const backendStatus=snapshot.negotiation.status;
  const status:Status=backendStatus==='failed'?'failed':backendStatus==='done'?(snapshot.decision?.decision==='reject'?'rejected':'completed'):snapshot.final_offer?'finalizing':display.bundles.length?'bundles':'negotiating';
  return {...s,backendStatus,backendStep:snapshot.negotiation.step,backendError:snapshot.negotiation.error,context:snapshot.negotiation.brief,bundles:display.bundles.map(bundle=>{const existing=s.bundles.find(item=>item.id===bundle.id);return existing?{...bundle,images:existing.images,items_total:existing.items_total??bundle.items_total}:bundle}),ratings:display.ratings,analysis:display.analysis||s.analysis,decision:display.decision||s.decision,finalOffer:display.finalOffer?{...display.finalOffer,images:s.finalOffer?.id===display.finalOffer.id?s.finalOffer.images:display.finalOffer.images,items_total:s.finalOffer?.id===display.finalOffer.id?s.finalOffer.items_total:display.finalOffer.items_total}:s.finalOffer,status};
 });
}
export function applyBackendEvent(message:BackendEvent,negotiationId?:string){
 update(s=>{
  if((negotiationId&&s.backendId!==negotiationId)||message.id<=s.lastEventId)return s;
  let next:Session={...s,lastEventId:message.id,backendStatus:'running',backendError:null,backendMessages:[...s.backendMessages,message].slice(-100)};
  switch(message.type){
   case 'brief':next={...next,context:message.payload,backendStep:'PROPOSE'};break;
   case 'check':next={...next,checks:[...s.checks,message.payload]};break;
   case 'bundles_proposed':next={...next,bundles:message.payload.bundles.map(bundle=>displayBundle(bundle)),status:'bundles',backendStep:'JUDGE'};break;
   case 'ratings':{const ratings=message.payload.ratings;next={...next,ratings,backendStep:'ANALYZE',bundles:s.bundles.map(bundle=>{const rating=ratings.find(r=>r.id===bundle.id);return rating?{...bundle,probability:rating.probability,reason:rating.reason,scores:{price:rating.price_score==null?null:Math.round(rating.price_score*100),fit:rating.fit_score==null?null:Math.round(rating.fit_score*100),style:rating.style_score==null?null:Math.round(rating.style_score*100)}}:bundle})};break;}
   case 'heat':break;
   case 'analysis':next={...next,analysis:message.payload,backendStep:'FINAL'};break;
   case 'final_offer':{registerBackendItems(message.payload.items);const final=message.payload.final;next={...next,backendItems:message.payload.items,finalOffer:displayBundle({...final,pitch:final.why}),status:'finalizing',backendStep:'DECIDE'};break;}
   case 'decision':next={...next,decision:message.payload,status:message.payload.decision==='accept'?'completed':'rejected',finalOffer:s.finalOffer?{...s.finalOffer,probability:message.payload.probability}:null,backendStep:'DONE'};break;
   case 'done':next={...next,backendStatus:'done',backendStep:'DONE',status:s.decision?.decision==='reject'?'rejected':'completed',connection:'closed'};break;
   case 'error':next={...next,backendStatus:'failed',backendStep:message.payload.step,backendError:message.payload.message,status:'failed',connection:'error'};break;
  }
  return event(next,summarizeEvent(message),Date.parse(message.ts));
 });
}
export async function connectBackend(s:Session){
 update(cur=>cur.id!==s.id||cur.status!=='setup'?cur:{...cur,status:'connecting',backendError:null,startedAt:Date.now()});
 try{
  const response=await createNegotiation(buildFrontendRequest(s.profile));
  update(cur=>cur.id!==s.id?cur:event({...cur,backendId:response.id,backendStatus:'pending',backendStep:'BRIEF',lastEventId:0,status:'negotiating',connection:'idle'},'Negotiation created'));
 }catch(error){update(cur=>cur.id!==s.id?cur:{...cur,status:'failed',backendError:error instanceof Error?error.message:'Unable to connect to the backend.',connection:'error'});}
}
export async function retryBackend(s:Session){
 if(!s.backendId){update(cur=>({...cur,status:'setup',backendError:null}));await connectBackend({...s,status:'setup'});return;}
 try{
  const snapshot=await getNegotiation(s.backendId);
  if(snapshot.negotiation.status==='failed')await retryNegotiation(s.backendId);
  applySnapshot(snapshot);
  update(cur=>cur.backendId!==s.backendId?cur:{...cur,status:'negotiating',backendStatus:'running',backendError:null,connection:'idle',streamGeneration:cur.streamGeneration+1});
 }catch(error){update(cur=>({...cur,backendError:error instanceof Error?error.message:'Unable to resume the negotiation.',status:'failed'}));}
}
export function followBackend(s:Session):()=>void {
 if(!s.backendId)return ()=>{};
 const id=s.backendId;
 let cancelled=false;
 let stop=()=>{};
 // A snapshot gives recovery state; replay carries the full image/total payloads.
 getNegotiation(id).then(snapshot=>{
  if(cancelled)return;
  applySnapshot(snapshot);
  if(snapshot.negotiation.status==='failed')return;
  if(snapshot.negotiation.status==='done'&&s.lastEventId>0){update(cur=>cur.backendId!==id?cur:{...cur,connection:'closed'});return;}
  stop=openNegotiationStream(id,{after:s.lastEventId,onEvent:message=>{
   if(cancelled)return;
   applyBackendEvent(message,id);
   if(message.type==='done')getNegotiation(id).then(snapshot=>{if(!cancelled)applySnapshot(snapshot)}).catch(()=>{});
  },onConnection:(connection,message)=>{if(cancelled)return;update(cur=>cur.backendId!==id?cur:{...cur,connection,backendError:connection==='error'?(message||'Stream connection failed.'):cur.backendError,status:connection==='error'?'failed':cur.status})}});
 }).catch(error=>{if(!cancelled)update(cur=>cur.backendId!==id?cur:{...cur,status:'failed',backendError:error instanceof Error?error.message:'Unable to read negotiation state.',connection:'error'})});
 return()=>{cancelled=true;stop()};
}
