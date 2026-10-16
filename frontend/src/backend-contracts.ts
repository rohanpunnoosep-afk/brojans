/** Actual FastAPI/persisted/SSE shapes; separate from the illustrative JSON document. */
export type BackendItem = {sku:string; name:string; category:string; color:string; material:string; size:string; price:number; stock:number; image:string};
export type BackendBrief = {
 style:string[]; colors_liked:string[]; colors_avoid:string[];
 sizes:{top?:string|null; bottom?:string|null; shoe?:string|null};
 budget?:number|null; occasion?:string|null; notes:string[];
};
export type BackendStatus = 'pending'|'running'|'done'|'failed';
export type BackendStep = 'BRIEF'|'PROPOSE'|'JUDGE'|'ANALYZE'|'FINAL'|'DECIDE'|'DONE';
export type BackendNegotiation = {id:string; brief:BackendBrief|null; status:BackendStatus; step:BackendStep; error:string|null};
export type RawBundle = {id:string; negotiation_id:string; round:number; name:string; skus:string[]; price:number; pitch:string};
export type BackendBundleProposal = {id:string; name:string; skus:string[]; images:string[]; items_total:number; price:number; pitch:string};
export type BackendRating = {
 id:string; probability:number; reason:string;
 price_score?:number|null; fit_score?:number|null; style_score?:number|null;
 decision?:'accept'|'reject'|null;
};
export type BackendJudgment = Omit<BackendRating,'id'> & {bundle_id:string; negotiation_id:string; round:number};
export type BackendHeat = {sku:string; score:number; label:'hot'|'neutral'|'cold'; bundle_count:number};
export type BackendSignal = {type:string; value:string; avg_prob:number|null; votes:number; confirmed:boolean};
export type BackendAnalysis = {
 round:number; avg:number; subscore_avgs:Partial<Record<'price'|'fit'|'style',number>>;
 attribute_avgs:Record<string,Record<string,number>>;
 item_checks:{bundle_id:string; sku:string; verdict:string; dimension:string; note:string}[];
 works:BackendSignal[]; fails:BackendSignal[]; keep_skus:string[]; drop_skus:string[]; main_issue:string;
};
export type BackendDecision = {decision:'accept'|'reject'; probability:number; reason:string};
export type BackendFinalOffer = {final:Omit<BackendBundleProposal,'pitch'> & {savings:number; why:string}; items:BackendItem[]};
export type BackendCheck = {stage:'bundles'|'final'; valid:boolean; errors:string[]; rejected_attempts?:string[][]};
export type BackendSnapshot = {
 negotiation:BackendNegotiation;
 rounds:{round:number; bundles:(RawBundle & {judgment:BackendJudgment|null})[]; heat:BackendHeat[]; analysis:BackendAnalysis|null}[];
 final_offer:RawBundle|null;
 decision:BackendDecision|null;
};
export type BackendCreateRequest = {buyer_input:string; brief?:BackendBrief|null};
export type BackendCreateResponse = {id:string; stream_url:string};
export type BackendRetryResponse = BackendCreateResponse & {step:BackendStep};
export type BackendEventPayloads = {
 brief:BackendBrief;
 check:BackendCheck;
 bundles_proposed:{round:number; bundles:BackendBundleProposal[]};
 ratings:{round:number; ratings:BackendRating[]};
 heat:{round:number; items:BackendHeat[]};
 analysis:BackendAnalysis;
 final_offer:BackendFinalOffer;
 decision:BackendDecision & {id:string};
 done:Record<string,never>;
 error:{message:string; step:BackendStep};
};
export type BackendEventType = keyof BackendEventPayloads;
export type BackendEvent = {[Type in BackendEventType]:{id:number; type:Type; payload:BackendEventPayloads[Type]; ts:string}}[BackendEventType];
