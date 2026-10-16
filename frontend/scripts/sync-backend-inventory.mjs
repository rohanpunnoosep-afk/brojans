import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Read-only source snapshot: repository/db/seed_items.json. Never writes to db/.
// All fit/style/gender metadata below is inferred presentation data, not server data.
const frontend = fileURLToPath(new URL('../', import.meta.url));
const source = path.resolve(frontend, '../db/seed_items.json');
const sourceText = await readFile(source, 'utf8');
const inventory = JSON.parse(sourceText);
const fields = ['sku','name','category','color','material','size','price','stock','image'];
for (const item of inventory) {
  if (Object.keys(item).sort().join() !== [...fields].sort().join()) {
    throw new Error(`Unexpected backend inventory schema: ${item.sku}`);
  }
}

// Existing photographs are approximate category/color previews only. A null value
// intentionally requests a neutral placeholder rather than substituting another item.
const previews = {
  'JKT-02-OL': 'olive-overshirt.jpg',
  'BLZ-01-NV': 'blazer.jpg',
  'TEE-02-WH': 'white-tee.jpg',
  'TEE-04-GR': 'slate-tee.jpg',
  'HOD-02-HG': 'hoodie.jpg',
  'SWT-01-OT': 'sand-crew.jpg',
  'JNS-01-IN': 'jeans.jpg',
  'SNK-01-WH': 'white-sneaker.jpg',
};

const displayCategories = {
  jacket:'Jackets',blazer:'Jackets',tee:'T-shirts',shirt:'Shirts',hoodie:'Hoodies',
  sweatshirt:'Sweatshirts',pants:'Pants',jeans:'Pants',trousers:'Pants',joggers:'Pants',
  shorts:'Shorts',boots:'Footwear',sneakers:'Footwear',loafers:'Footwear',sandals:'Footwear',
  beanie:'Accessories',belt:'Accessories',
};
const shoeCategories = new Set(['boots','sneakers','loafers','sandals']);
const bottomCategories = new Set(['pants','jeans','trousers','joggers','shorts']);
const accessoryCategories = new Set(['beanie','belt']);
const stylesFor = item => {
  const name = item.name.toLowerCase();
  if (/blazer|oxford|pleated|loafer|belt/.test(name)) return ['Business casual','Formal'];
  if (/training|running|trail|windbreaker/.test(name)) return ['Athletic'];
  if (/lounge|plain hoodie|brushed crewneck|jogger|slide/.test(name)) return ['Casual','Athletic','Loungewear'];
  if (/graphic|skinny|cargo|bomber/.test(name)) return ['Streetwear','Casual'];
  return ['Casual'];
};
const fitFor = item => {
  const name = item.name.toLowerCase();
  if (/skinny/.test(name)) return 'Slim';
  if (/tapered/.test(name)) return 'Tapered';
  if (/boxy/.test(name)) return 'Boxy';
  if (/lounge|plain hoodie|brushed crewneck/.test(name)) return 'Relaxed';
  return 'Regular';
};

const metadata = {};
const imageMap = {};
for (const item of inventory) {
  const id = item.sku.slice(0,item.sku.lastIndexOf('-'));
  const group = shoeCategories.has(item.category) ? 'shoe'
    : bottomCategories.has(item.category) ? 'bottom'
    : accessoryCategories.has(item.category) ? 'accessory' : 'top';
  const sourceAsset = previews[id] ?? null;
  if (sourceAsset) await access(path.join(frontend,'public/images',sourceAsset));
  if (!metadata[id]) {
    metadata[id] = {
      skus: [],fit:fitFor(item),styles:stylesFor(item),gender:'Menswear',group,
      displayCategory:displayCategories[item.category] ?? item.category,sourceAsset,
      presentationSource:'Inferred from backend item name/category for display only; not backend attributes.',
    };
  }
  metadata[id].skus.push(item.sku);
  imageMap[item.image] = sourceAsset;
}

await mkdir(path.join(frontend,'src/data'), { recursive:true });
// Preserve each wire record's values and image filename exactly as the backend seed.
await writeFile(path.join(frontend,'src/data/backend-inventory.json'), sourceText);
await writeFile(path.join(frontend,'src/data/backend-product-meta.json'), JSON.stringify(metadata,null,2)+'\n');
await writeFile(path.join(frontend,'src/data/backend-image-map.json'), JSON.stringify(imageMap,null,2)+'\n');
console.log(`Snapshot from db/seed_items.json: ${inventory.length} SKUs, ${Object.keys(metadata).length} products, ${Object.values(imageMap).filter(Boolean).length} illustrative previews, ${Object.values(imageMap).filter(value=>value===null).length} placeholders.`);
