import {inventory,looks,type Bundle,type Profile} from './catalog.ts';
import type {BackendAnalysis,BackendBundleProposal,BackendCreateRequest,BackendDecision,BackendEvent,BackendHeat,BackendRating,BackendSnapshot,RawBundle} from './backend-contracts';

const score=(value:number|null|undefined):number|null=>typeof value==='number'&&Number.isFinite(value)?Math.round(value*100):null;
const probability=(value:number|null|undefined):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
const dollars=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);

/** Seller data and buyer judgments stay distinct; absent scores remain absent. */
export function displayBundle(proposal:BackendBundleProposal,rating?:BackendRating):Bundle {
 return {
  id:proposal.id,name:proposal.name,subtitle:rating?'Rated by your buyer agent':'Seller proposal',
  skus:[...proposal.skus],images:[...proposal.images],items_total:proposal.items_total,price:proposal.price,
  scores:{price:score(rating?.price_score),fit:score(rating?.fit_score),style:score(rating?.style_score)},
  probability:probability(rating?.probability),reason:rating?.reason||proposal.pitch,tradeoff:'',issue:'none',
 };
}

/** Snapshot records omit product images/totals. Reconstruct only from exact inventory SKUs. */
function displayRawBundle(raw:RawBundle,rating?:BackendRating):Bundle {
 const items=raw.skus.map(sku=>inventory.find(item=>item.sku===sku));
 const known=items.every(item=>item!==undefined&&Number.isFinite(item.price));
 const total=known?Math.round(items.reduce((sum,item)=>sum+item!.price,0)*100)/100:null;
 return {
  id:raw.id,name:raw.name,subtitle:rating?'Rated by your buyer agent':'Seller proposal',
  skus:[...raw.skus],images:items.map(item=>item?.image||''),items_total:total,price:raw.price,
  scores:{price:score(rating?.price_score),fit:score(rating?.fit_score),style:score(rating?.style_score)},
  probability:probability(rating?.probability),reason:rating?.reason||raw.pitch,tradeoff:'',issue:'none',
 };
}

export type DisplaySnapshot={
 bundles:Bundle[];ratings:BackendRating[];finalOffer:Bundle|null;decision:BackendDecision|null;
 analysis:BackendAnalysis|null;heat:BackendHeat[];
};
export function displaySnapshot(snapshot:BackendSnapshot):DisplaySnapshot {
 const rounds=[...snapshot.rounds].sort((left,right)=>left.round-right.round);
 const current=rounds.at(-1);
 const ratings:BackendRating[]=[];
 const bundles=(current?.bundles||[]).map(raw=>{
  let rating:BackendRating|undefined;
  if(raw.judgment){
   const {probability,reason,price_score,fit_score,style_score,decision}=raw.judgment;
   rating={id:raw.id,probability,reason,price_score,fit_score,style_score,decision};
   ratings.push(rating);
  }
  return displayRawBundle(raw,rating);
 });
 const finalOffer=snapshot.final_offer?displayRawBundle(snapshot.final_offer,snapshot.decision?{id:snapshot.final_offer.id,...snapshot.decision}:undefined):null;
 if(finalOffer){finalOffer.subtitle='Final seller offer';finalOffer.reason=snapshot.final_offer!.pitch;}
 return {bundles,ratings,finalOffer,decision:snapshot.decision,analysis:current?.analysis||null,heat:current?.heat||[]};
}

/** Activity summaries describe emitted events, never an invented agent step. */
export function summarizeEvent(event:BackendEvent):string {
 switch(event.type){
  case 'brief':return `Buyer brief prepared${event.payload.style.length?': '+event.payload.style.join(', '):''}.`;
  case 'check':return event.payload.valid?`${event.payload.stage==='final'?'Final offer':'Seller bundles'} passed backend validation.`:`Backend validation failed: ${event.payload.errors.join('; ')}`;
  case 'bundles_proposed':return `Seller proposed ${event.payload.bundles.length} bundles.`;
  case 'ratings':return `Buyer agent rated ${event.payload.ratings.length} bundles.`;
  case 'heat':return `Item feedback updated for ${event.payload.items.length} SKUs.`;
  case 'analysis':return `Seller analysis received: ${event.payload.keep_skus.length} retained SKUs, ${event.payload.drop_skus.length} dropped.`;
  case 'final_offer':return `Seller sent a final ${event.payload.final.skus.length}-piece offer for ${dollars(event.payload.final.price)}.`;
  case 'decision':return `Buyer agent ${event.payload.decision==='accept'?'accepted':'rejected'} the final offer: ${event.payload.reason}`;
  case 'done':return 'Agent negotiation completed.';
  case 'error':return `Negotiation failed at ${event.payload.step}: ${event.payload.message}`;
 }
}

/** Text descriptions of selected looks are sent; no image upload or live context is implied. */
export function buildFrontendUserInput(profile:Profile):string {
 const selected=looks.filter(look=>profile.looks.includes(look.id));
 const shoeSize=(profile as Profile&{shoeSize?:string}).shoeSize;
 const preferences={
  shopping_for:'menswear',
  selected_styles:profile.styles,
  selected_looks:selected.map(look=>({name:look.name,description:look.desc,tags:look.tags})),
  location:profile.location,
  occasion:profile.occasions,
  preferred_fit:profile.fit,
  sizes:{top:profile.topSize,bottom:profile.bottomSize||'32',shoe:shoeSize||'10'},
  budget_dollars:profile.budget,
  target_price_dollars:profile.targetPrice??null,
 };
 return 'Find clothing bundles for this buyer. The stated sizes and maximum budget are hard limits. If a target price is supplied, aim near that target while respecting the maximum budget; the target is a preference, not a required price. Selected look descriptions provide visual-style context; no images are attached. Location is buyer-provided context, without live weather or calendar access.\n\n'+JSON.stringify(preferences,null,2);
}
export function buildFrontendRequest(profile:Profile):BackendCreateRequest {
 return {buyer_input:buildFrontendUserInput(profile)};
}
