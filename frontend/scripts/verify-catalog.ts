/** Fast, offline smoke of the actual backend adapter. No agent/model invocation. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {inventory,defaultProfile,imageUrl} from '../src/catalog.ts';
import {buildFrontendRequest,displayBundle,displaySnapshot} from '../src/backend-adapter.ts';
import {createNegotiation,getNegotiation} from '../src/api.ts';
import type {BackendBundleProposal,BackendRating,BackendSnapshot,RawBundle} from '../src/backend-contracts.ts';

const exactKeys=(value:object,keys:string[])=>assert.deepEqual(Object.keys(value).sort(),[...keys].sort());
const seed=JSON.parse(readFileSync(new URL('../../db/seed_items.json',import.meta.url),'utf8'));
assert.deepEqual(inventory,seed,'Displayed inventory must exactly match the backend seed, including stock');
assert.equal(inventory.length,52);
assert.equal(new Set(inventory.map(item=>item.sku)).size,52);
let mapped=0,placeholders=0;
for(const item of inventory){
 exactKeys(item,['sku','name','category','color','material','size','price','stock','image']);
 assert.ok(!/[\\/]/.test(item.image),'Backend images are filenames');
 const url=imageUrl(item.image);
 if(url===null)placeholders++;
 else{mapped++;assert.ok(existsSync(new URL('../public'+url,import.meta.url)),`Missing mapped image ${url}`);}
}
assert.ok(mapped>0&&placeholders>0,'Use real mapped images and explicit placeholders');

const request=buildFrontendRequest({...defaultProfile,styles:['Casual','Athletic'],looks:['l1','l2','l3']});
exactKeys(request,['buyer_input']);
const context=JSON.parse(request.buyer_input.slice(request.buyer_input.indexOf('{')));
assert.deepEqual(context.sizes,{top:'M',bottom:'32',shoe:'10'});
assert.equal(context.budget_dollars,200);
assert.equal(context.location,'Los Angeles');
assert.equal(context.selected_looks.length,3);

const selected=[
 inventory.find(item=>item.category==='hoodie'&&item.size==='M'&&item.stock>0)!,
 inventory.find(item=>item.category==='joggers'&&item.size==='32'&&item.stock>0)!,
 inventory.find(item=>item.category==='tee'&&item.size==='M'&&item.stock>0)!,
];
assert.ok(selected.every(Boolean));
const total=selected.reduce((sum,item)=>sum+item.price,0);
const proposal:BackendBundleProposal={id:'actual-bundle-id',name:'Server bundle',skus:selected.map(item=>item.sku),images:selected.map(item=>item.image),items_total:total,price:Math.round(total*.9),pitch:'The seller pitch from the API.'};
const rating:BackendRating={id:proposal.id,probability:.71,reason:'The actual buyer judgment.',price_score:.8,fit_score:.9,style_score:.7};
const unjudged=displayBundle(proposal);
assert.deepEqual(unjudged.scores,{price:null,fit:null,style:null});
assert.equal(unjudged.probability,null);
const judged=displayBundle(proposal,rating);
assert.deepEqual(judged.scores,{price:80,fit:90,style:70});
assert.equal(judged.probability,.71);
assert.equal(judged.reason,rating.reason);
assert.equal(judged.price,proposal.price);

const raw:RawBundle={id:proposal.id,negotiation_id:'actual-negotiation-id',round:1,name:proposal.name,skus:proposal.skus,price:proposal.price,pitch:proposal.pitch};
const snapshot:BackendSnapshot={
 negotiation:{id:raw.negotiation_id,status:'done',step:'DONE',brief:null,error:null},
 rounds:[{round:1,bundles:[{...raw,judgment:{bundle_id:raw.id,negotiation_id:raw.negotiation_id,round:1,probability:.71,reason:rating.reason,price_score:.8,fit_score:.9,style_score:.7}}],heat:[],analysis:null}],
 final_offer:{...raw,id:'actual-final-id',round:2},
 decision:{decision:'accept',probability:.82,reason:'The final buyer-agent decision.'},
};
const recovered=displaySnapshot(snapshot);
assert.deepEqual(recovered.bundles[0].images,proposal.images);
assert.equal(recovered.bundles[0].items_total,total);
assert.deepEqual(recovered.bundles[0].scores,judged.scores);
assert.equal(recovered.ratings[0].id,raw.id);
assert.equal(recovered.finalOffer!.reason,raw.pitch);
assert.equal(recovered.finalOffer!.probability,.82);
assert.deepEqual(recovered.finalOffer!.scores,{price:null,fit:null,style:null});
assert.equal(recovered.decision!.decision,'accept');
const unknown=displaySnapshot({...snapshot,final_offer:{...raw,id:'unknown-final',round:2,skus:['UNKNOWN-SKU']}});
assert.equal(unknown.finalOffer!.items_total,null,'Unknown SKU totals must remain unavailable');
assert.deepEqual(unknown.finalOffer!.images,['']);

const originalFetch=globalThis.fetch;
const calls:{url:string;method:string}[]=[];
globalThis.fetch=async(input,options)=>{
 const url=String(input);calls.push({url,method:options?.method||'GET'});
 assert.ok(url.startsWith('/api/'));
 if(options?.method==='POST'){
  assert.equal(JSON.parse(String(options.body)).buyer_input,request.buyer_input);
  return new Response(JSON.stringify({id:raw.negotiation_id,stream_url:`/api/negotiations/${raw.negotiation_id}/stream`}),{status:201});
 }
 return new Response(JSON.stringify(snapshot),{status:200});
};
try{
 assert.equal((await createNegotiation(request)).id,raw.negotiation_id);
 assert.equal((await getNegotiation(raw.negotiation_id)).final_offer!.id,'actual-final-id');
 assert.deepEqual(calls.map(call=>call.method),['POST','GET']);
}finally{globalThis.fetch=originalFetch;}

console.log(`Backend contract smoke passed: ${inventory.length} real seed SKUs (${mapped} mapped images, ${placeholders} placeholders), actual M/32/10 buyer request, nullable/display scores, snapshot judgments, unknown-SKU handling, and mocked API POST/GET.`);
