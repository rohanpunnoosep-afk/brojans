import {useEffect,useState} from 'react';
import {defaultProfile,registerBackendItems,type Profile,type Rules,type Bundle} from './catalog';
import type {BackendBrief,BackendRating,BackendAnalysis,BackendDecision,BackendCheck,BackendStatus,BackendStep,BackendItem,BackendEvent} from './backend-contracts';
import type {ConnectionState} from './api';

export type Status='setup'|'connecting'|'negotiating'|'bundles'|'finalizing'|'completed'|'rejected'|'failed';
export type Session={
 id:string;profile:Profile;profileReady:boolean;rules:Rules;sellerReady:boolean;
 status:Status;startedAt:number;bundles:Bundle[];finalOffer:Bundle|null;
 humanDecision:{bundleId:string;decision:'accept'|'decline'}|null;backendMessages:BackendEvent[];
 context:BackendBrief|null;ratings:BackendRating[];analysis:BackendAnalysis|null;decision:BackendDecision|null;checks:BackendCheck[];
 backendId:string|null;backendStatus:BackendStatus|null;backendStep:BackendStep;lastEventId:number;backendError:string|null;connection:ConnectionState|'idle';streamGeneration:number;backendItems:BackendItem[];
 revision:number;events:{id:string;text:string;time:number}[];
};
const key='tandem.backend.v1';
export function fresh():Session{return {id:crypto.randomUUID(),profile:{...defaultProfile},profileReady:false,rules:{maxItems:5,maxDiscount:40},sellerReady:false,status:'setup',startedAt:0,bundles:[],finalOffer:null,humanDecision:null,backendMessages:[],context:null,ratings:[],analysis:null,decision:null,checks:[],backendId:null,backendStatus:null,backendStep:'BRIEF',lastEventId:0,backendError:null,connection:'idle',streamGeneration:0,backendItems:[],revision:0,events:[]};}
function read():Session{try{const s=JSON.parse(localStorage.getItem(key)||'null');if(s?.id&&Array.isArray(s.bundles)&&'backendId' in s){registerBackendItems(s.backendItems||[]);return {...s,humanDecision:s.humanDecision??null,backendMessages:s.backendMessages??[]}}}catch{}return fresh();}
let current=read();
try{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(current));}catch{}
const listeners=new Set<()=>void>();
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('tandem.backend'):null;
function refresh(){current=read();listeners.forEach(fn=>fn());}
window.addEventListener('storage',e=>{if(e.key===key)refresh();});
channel?.addEventListener('message',refresh);
export function update(change:(s:Session)=>Session){const previous=read();const next=change(previous);if(next===previous)return;next.revision++;localStorage.setItem(key,JSON.stringify(next));current=next;listeners.forEach(fn=>fn());channel?.postMessage('update');}
export function event(s:Session,text:string,time=Date.now()):Session{return {...s,events:[...s.events,{id:crypto.randomUUID(),text,time}].slice(-50)};}
export function reset(){const next=fresh();localStorage.setItem(key,JSON.stringify(next));current=next;listeners.forEach(fn=>fn());channel?.postMessage('reset');}
export function useSession(){const [session,set]=useState(current);useEffect(()=>{const fn=()=>set(current);listeners.add(fn);return ()=>{listeners.delete(fn)}},[]);return session;}
