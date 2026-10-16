import inventoryData from './data/backend-inventory.json' with {type:'json'};
import productMetaData from './data/backend-product-meta.json' with {type:'json'};
import backendImageMap from './data/backend-image-map.json' with {type:'json'};
import type {InventoryItem,WireBundle} from './contracts';

export const inventory:InventoryItem[]=inventoryData;
export type ProductMeta={skus:string[];fit:string;styles:string[];gender:string;group:'top'|'bottom'|'shoe'|'accessory';displayCategory:string;sourceAsset:string|null};
export const productMeta=productMetaData as Record<string,ProductMeta>;
export type Product=InventoryItem & {id:string;fabric:string;fit:string;styles:string[];sizes:string[];gender:string;group:string};
const metadataFor=(sku:string)=>Object.values(productMeta).find(meta=>meta.skus.includes(sku))!;
export const skuCatalog:Product[]=inventory.map(item=>{
 const meta=metadataFor(item.sku);
 return {...item,id:item.sku,fabric:item.material,fit:meta.fit,styles:meta.styles,sizes:[item.size],gender:meta.gender,group:meta.group};
});
export const catalog:Product[]=Object.entries(productMeta).map(([id,meta])=>{
 const records=inventory.filter(item=>meta.skus.includes(item.sku));
 const representative=records.find(item=>item.size==='M')||records[0];
 return {...representative,id,fabric:representative.material,fit:meta.fit,styles:meta.styles,sizes:records.filter(item=>item.stock>0).map(item=>item.size),stock:records.reduce((sum,item)=>sum+item.stock,0),gender:meta.gender,group:meta.group};
});
export const findProduct=(id:string):Product=>skuCatalog.find(item=>item.sku===id)||catalog.find(item=>item.id===id)||{id,sku:id,name:id,category:'unknown',color:'',material:'',fabric:'',size:id.split('-').at(-1)||'',price:NaN,stock:0,image:id+'.jpg',fit:'Not supplied',styles:[],sizes:[],gender:'Menswear',group:'unknown'};
export function registerBackendItems(items:InventoryItem[]){for(const item of items){const meta=metadataFor(item.sku);const normalized={...item,id:item.sku,fabric:item.material,fit:meta?.fit||'Not supplied',styles:meta?.styles||[],sizes:[item.size],gender:meta?.gender||'Menswear',group:meta?.group||'unknown'};const index=skuCatalog.findIndex(p=>p.sku===item.sku);if(index<0)skuCatalog.push(normalized);else skuCatalog[index]=normalized;}}
export const imageUrl=(filename:string):string|null=>{if(filename.startsWith('/'))return filename;const map=backendImageMap as Record<string,string|null>;if(filename in map)return map[filename]?'/images/'+map[filename]:null;return '/images/'+filename;};
export const availableSizes=(group:ProductMeta['group'])=>[...new Set(Object.values(productMeta).filter(meta=>meta.group===group).flatMap(meta=>meta.skus).map(sku=>inventory.find(item=>item.sku===sku)!).filter(item=>item.stock>0).map(item=>item.size))];
export const styles = [
 {name:'Casual',desc:'Easy, everyday staples',image:'look-grey'},
 {name:'Athletic',desc:'Comfort that moves with you',image:'athletic'},
 {name:'Streetwear',desc:'Bolder shapes. A little edge.',image:'street'},
 {name:'Coastal',desc:'Light layers, slower days',image:'look-shorts'},
 {name:'Business casual',desc:'A little more put-together',image:'casual'},
 {name:'Formal',desc:'For the occasion',image:'formal'},
];
export const looks = [
 {id:'l1',name:'The soft set',desc:'Tonal layers · relaxed fit',image:'look-soft',styles:['Casual','Athletic','Coastal'],tags:['Minimal','Relaxed','Cotton']},
 {id:'l2',name:'Off-duty essentials',desc:'Clean basics · easy movement',image:'look-grey',styles:['Casual','Athletic','Streetwear'],tags:['Minimal','Relaxed','Breathable']},
 {id:'l3',name:'A lighter day',desc:'Easy shorts · neutral palette',image:'look-shorts',styles:['Casual','Athletic','Coastal'],tags:['Minimal','Loose','Lightweight']},
 {id:'l4',name:'Street rotation',desc:'Structured layers · darker tones',image:'street',styles:['Streetwear','Casual'],tags:['Expressive','Loose','Layered']},
 {id:'l5',name:'Ready to move',desc:'Sporty basics · tapered fit',image:'athletic',styles:['Athletic','Streetwear'],tags:['Sporty','Regular','Tapered']},
 {id:'l7',name:'A sharper everyday',desc:'Tailored layers and clean lines',image:'casual',styles:['Business casual','Formal','Coastal'],tags:['Classic','Regular','Layered']},
 {id:'l8',name:'For the occasion',desc:'A considered, tailored silhouette',image:'formal',styles:['Formal','Business casual'],tags:['Classic','Tailored']},
 {id:'l6',name:'Everyday layers',desc:'Classic shapes · casual texture',image:'trouser',styles:['Casual','Business casual','Formal'],tags:['Classic','Regular','Layered']},
];

export const looksForStyles=(selected:string[])=>looks.filter(look=>!selected.length||look.styles.some(style=>selected.includes(style)));

export type Profile={styles:string[];looks:string[];location:string;occasions:string;budget:number;topSize:string;bottomSize:string;shoeSize?:string;targetPrice?:number|null;fit:string};
export const defaultProfile:Profile={styles:[],looks:[],location:'Los Angeles',occasions:'Working from home, coffee runs, and relaxed weekends',budget:200,targetPrice:150,topSize:'M',bottomSize:'32',shoeSize:'10',fit:'Relaxed'};
export type Rules={maxItems:number;maxDiscount:number};
export type Bundle={id:string;name:string;subtitle:string;skus:string[];images:string[];items_total:number|null;price:number;scores:{price:number|null;fit:number|null;style:number|null};probability:number|null;reason:string;tradeoff:string;issue:'none'|'value'|'fit'|'style'|'coverage'};
