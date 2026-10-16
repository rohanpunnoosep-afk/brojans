import type {BackendCreateRequest,BackendCreateResponse,BackendEvent,BackendEventType,BackendRetryResponse,BackendSnapshot} from './backend-contracts';

export class ApiError extends Error {
 readonly status:number;
 constructor(message:string,status:number){super(message);this.name='ApiError';this.status=status;}
}

const object=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const text=(value:unknown):value is string=>typeof value==='string'&&value.length>0;
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);

function errorMessage(value:unknown,fallback:string):string {
 if(text(value))return value;
 if(Array.isArray(value))return value.map(entry=>object(entry)&&text(entry.msg)?entry.msg:typeof entry==='string'?entry:'Invalid request').join('; ');
 if(object(value)&&'detail' in value)return errorMessage(value.detail,fallback);
 if(object(value)&&text(value.message))return value.message;
 return fallback;
}

async function request(path:string,options:RequestInit={}):Promise<unknown>{
 const response=await fetch(path,{...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 const raw=await response.text();
 let value:unknown;
 try{value=raw?JSON.parse(raw):null;}catch{throw new ApiError(response.ok?'The API returned invalid JSON.':`API request failed (${response.status}).`,response.status);}
 if(!response.ok)throw new ApiError(errorMessage(value,`API request failed (${response.status}).`),response.status);
 return value;
}

function createResponse(value:unknown):BackendCreateResponse{
 if(!object(value)||!text(value.id)||!text(value.stream_url)||!value.stream_url.startsWith('/api/'))throw new ApiError('The API returned an invalid negotiation response.',200);
 return {id:value.id,stream_url:value.stream_url};
}
const route=(id:string)=>`/api/negotiations/${encodeURIComponent(id)}`;

export async function checkHealth(signal?:AbortSignal):Promise<{ok:boolean}>{
 const value=await request('/api/health',{signal});
 if(!object(value)||typeof value.ok!=='boolean')throw new ApiError('The API returned an invalid health response.',200);
 return {ok:value.ok};
}
export async function createNegotiation(body:BackendCreateRequest,signal?:AbortSignal):Promise<BackendCreateResponse>{
 return createResponse(await request('/api/negotiations',{method:'POST',body:JSON.stringify(body),signal}));
}
export async function getNegotiation(id:string,signal?:AbortSignal):Promise<BackendSnapshot>{
 const value=await request(route(id),{signal});
 if(!object(value)||!object(value.negotiation)||!text(value.negotiation.id)||!text(value.negotiation.status)||!text(value.negotiation.step)||!Array.isArray(value.rounds)||!('final_offer' in value)||!('decision' in value))throw new ApiError('The API returned an invalid negotiation snapshot.',200);
 return value as BackendSnapshot;
}
export async function retryNegotiation(id:string,signal?:AbortSignal):Promise<BackendRetryResponse>{
 const value=await request(route(id)+'/retry',{method:'POST',signal});
 const created=createResponse(value);
 if(!object(value)||!text(value.step))throw new ApiError('The API returned an invalid retry response.',200);
 return {...created,step:value.step as BackendRetryResponse['step']};
}

export type ConnectionState='open'|'reconnecting'|'closed'|'error';
export type StreamOptions={after?:number;onEvent:(event:BackendEvent)=>void;onConnection?:(state:ConnectionState,message?:string)=>void};
const eventTypes:BackendEventType[]=['brief','check','bundles_proposed','ratings','heat','analysis','final_offer','decision','done','error'];

function parseEvent(data:string,type:BackendEventType):BackendEvent{
 let value:unknown;
 try{value=JSON.parse(data);}catch{throw new Error('The negotiation stream returned invalid JSON.');}
 if(!object(value)||!finite(value.id)||!Number.isInteger(value.id)||value.id<1||value.type!==type||!object(value.payload)||!text(value.ts))throw new Error('The negotiation stream returned an invalid event envelope.');
 const payload=value.payload;
 const valid=type==='brief'?Array.isArray(payload.style)&&object(payload.sizes)
  :type==='check'?typeof payload.valid==='boolean'&&Array.isArray(payload.errors)
  :type==='bundles_proposed'?Array.isArray(payload.bundles)
  :type==='ratings'?Array.isArray(payload.ratings)
  :type==='heat'?Array.isArray(payload.items)
  :type==='analysis'?finite(payload.avg)&&Array.isArray(payload.item_checks)
  :type==='final_offer'?object(payload.final)&&Array.isArray(payload.items)
  :type==='decision'?['accept','reject'].includes(String(payload.decision))&&finite(payload.probability)
  :type==='error'?text(payload.message)
  :true;
 if(!valid)throw new Error(`The negotiation stream returned an invalid ${type} payload.`);
 return value as BackendEvent;
}

/** Same-origin EventSource; the backend starts/resumes work when this opens.
 * Custom SSE error messages are terminal; native network errors reconnect automatically. */
export function openNegotiationStream(id:string,options:StreamOptions):()=>void{
 let last=Number.isInteger(options.after)&&options.after!>=0?options.after!:0;
 const source=new EventSource(route(id)+`/stream?after=${last}`);
 let stopped=false;
 const close=(state:ConnectionState='closed',message?:string)=>{
  if(stopped)return;
  stopped=true;source.close();options.onConnection?.(state,message);
 };
 source.onopen=()=>{if(!stopped)options.onConnection?.('open');};
 for(const type of eventTypes){
  source.addEventListener(type,(raw:Event)=>{
   if(stopped)return;
   if(!('data' in raw)||typeof raw.data!=='string'){
    if(type==='error')options.onConnection?.(source.readyState===EventSource.CLOSED?'error':'reconnecting','Connection interrupted. Reconnecting to the negotiation stream.');
    return;
   }
   let event:BackendEvent;
   try{event=parseEvent(raw.data,type);}catch(error){close('error',error instanceof Error?error.message:'Unable to read negotiation event.');return;}
   if(event.id<=last)return;
   last=event.id;
   options.onEvent(event);
   if(event.type==='done')close();
   else if(event.type==='error')close('error',event.payload.message);
  });
 }
 return ()=>close();
}
