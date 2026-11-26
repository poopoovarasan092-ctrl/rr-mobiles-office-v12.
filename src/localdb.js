// RR Mobiles Office V12: fresh, offline IndexedDB database.
// V12 deliberately uses a new database name so it starts empty and never opens V11 data.
export const DB_NAME = 'rr-mobiles-offline-v12';
export const TABLES = [
  'customers','products','bills','repairs','purchases','expenses',
  'credit_payments','loyalty_transactions','service_transactions',
  'accounts','account_transactions','recycle_bin'
];
const DB_VERSION = 2;
let dbPromise;
function db(){
  if(!dbPromise) dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{const database=request.result;for(const table of TABLES){if(!database.objectStoreNames.contains(table))database.createObjectStore(table,{keyPath:'id'});}};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
  return dbPromise;
}
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
async function all(table){const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction(table).objectStore(table).getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error);});}
async function put(table,row){const database=await db();const saved={...row,id:row.id||uid(),created_at:row.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};return new Promise((resolve,reject)=>{const request=database.transaction(table,'readwrite').objectStore(table).put(saved);request.onsuccess=()=>resolve(saved);request.onerror=()=>reject(request.error);});}
async function del(table,id){const database=await db();return new Promise((resolve,reject)=>{const request=database.transaction(table,'readwrite').objectStore(table).delete(id);request.onsuccess=()=>resolve(true);request.onerror=()=>reject(request.error);});}
class Query{
 constructor(table){if(!TABLES.includes(table))throw Error(`Unknown local table: ${table}`);this.table=table;this.action='select';this.payload=null;this.filters=[];this.sort=null;this.max=Infinity;}
 select(){if(this.action!=='insert')this.action='select';return this;}
 insert(value){this.action='insert';this.payload=Array.isArray(value)?value:[value];return this;}
 update(value){this.action='update';this.payload=value;return this;}
 delete(){this.action='delete';return this;}
 eq(key,value){this.filters.push(row=>row[key]===value);return this;}
 order(key,options={}){this.sort={key,ascending:options.ascending!==false};return this;}
 limit(count){this.max=count;return this;}
 async then(resolve,reject){try{let records=await all(this.table);records=records.filter(row=>this.filters.every(filter=>filter(row)));let data=null;
  if(this.action==='insert'){data=[];for(const row of this.payload)data.push(await put(this.table,row));}
  else if(this.action==='update'){data=[];for(const row of records){const next={...row,...this.payload,updated_at:new Date().toISOString()};await put(this.table,next);data.push(next);}}
  else if(this.action==='delete'){data=[];for(const row of records){if(this.table==='recycle_bin'){await del(this.table,row.id);data.push(row);continue;}await put('recycle_bin',{original_table:this.table,original_record:row,deleted_at:new Date().toISOString()});await del(this.table,row.id);data.push(row);}}
  else {if(this.sort){const {key,ascending}=this.sort;records.sort((a,b)=>{const result=String(a[key]??'').localeCompare(String(b[key]??''),undefined,{numeric:true});return ascending?result:-result;});}data=records.slice(0,this.max);}
  resolve({data,error:null});
 }catch(error){resolve({data:null,error:{message:error?.message||String(error)}});}}
}
async function rpc(name,params){try{
 if(name==='create_rr_bill_v4'){
  const items=params.p_items||[];for(const item of items){if(item.product_id){const product=(await all('products')).find(row=>row.id===item.product_id);if(!product||Number(product.stock)<Number(item.qty))throw Error(`Insufficient stock for ${item.name}`);}}
  const bill=await put('bills',{bill_no:params.p_bill_no,bill_date:params.p_bill_date,customer_id:params.p_customer_id,customer_name:params.p_customer_name,customer_phone:params.p_customer_phone,items,total:Number(params.p_total),cost_total:Number(params.p_cost_total),payment_mode:params.p_payment_mode,points_earned:Math.floor(Number(params.p_total)/100)});
  for(const item of items)if(item.product_id){const product=(await all('products')).find(row=>row.id===item.product_id);await put('products',{...product,stock:Number(product.stock)-Number(item.qty)});}
  if(params.p_customer_id){const customer=(await all('customers')).find(row=>row.id===params.p_customer_id);if(customer)await put('customers',{...customer,points_balance:Number(customer.points_balance||0)+Math.floor(Number(params.p_total)/100)});}
  return {data:bill,error:null};
 }
 if(name==='create_rr_stock_purchase_v6'){
  const product=(await all('products')).find(row=>row.id===params.p_product_id);if(!product)throw Error('Product not found');const quantity=Number(params.p_quantity),cost=Number(params.p_unit_cost);if(quantity<=0||cost<0)throw Error('Invalid purchase quantity or cost');
  const purchase=await put('purchases',{product_id:product.id,product_name:product.name,supplier:params.p_supplier,quantity,unit_cost:cost,total:quantity*cost,purchase_date:params.p_purchase_date});await put('products',{...product,stock:Number(product.stock||0)+quantity});return {data:purchase,error:null};
 }
 if(name==='record_rr_credit_payment_v10'){
  const bill=(await all('bills')).find(row=>row.id===params.p_bill_id);if(!bill||String(bill.payment_mode).toLowerCase()!=='credit')throw Error('Credit bill not found');const payments=(await all('credit_payments')).filter(row=>row.bill_id===bill.id);const paid=payments.reduce((sum,row)=>sum+Number(row.amount||0),0),amount=Number(params.p_amount);if(amount<=0||amount>Number(bill.total)-paid)throw Error('Payment exceeds outstanding balance');return {data:await put('credit_payments',{bill_id:bill.id,customer_id:bill.customer_id,payment_date:params.p_payment_date,amount,payment_mode:params.p_payment_mode,notes:params.p_notes}),error:null};
 }
 throw Error(`Unsupported offline operation: ${name}`);
 }catch(error){return {data:null,error:{message:error?.message||String(error)}};}}
export const localClient={from:table=>new Query(table),rpc,auth:{getSession:async()=>({data:{session:{user:{id:'local-owner',email:'owner@rrmobiles.local'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async()=>({data:{session:{user:{id:'local-owner'}}},error:null}),signOut:async()=>({error:null})}};
export async function localDbInfo(){const counts={};for(const table of TABLES)counts[table]=(await all(table)).length;return counts;}
export async function exportLocalDatabase(){const data={app:'RR Mobiles Office',version:12,database:DB_NAME,exported_at:new Date().toISOString(),tables:{}};for(const table of TABLES)data.tables[table]=await all(table);return data;}
export async function importLocalDatabase(backup,{replace=false}={}){
 if(!backup||backup.app!=='RR Mobiles Office'||!backup.tables||typeof backup.tables!=='object')throw Error('This is not a valid RR Mobiles backup file.');
 const database=await db();const transaction=database.transaction(TABLES,'readwrite');
 for(const table of TABLES){const store=transaction.objectStore(table);if(replace)store.clear();const rows=Array.isArray(backup.tables[table])?backup.tables[table]:[];for(const row of rows){if(!row||!row.id)continue;store.put(row);}}
 await new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('Restore cancelled'));});
 return localDbInfo();
}
export async function clearLocalDatabase(){const database=await db();const transaction=database.transaction(TABLES,'readwrite');for(const table of TABLES)transaction.objectStore(table).clear();await new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});}
