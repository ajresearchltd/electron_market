export function nextInvoiceIdentity(procurementNumber:string,sequences:unknown[]){
 const previousMax=Math.max(0,...sequences.map(value=>Number(value??0)).filter(Number.isFinite));
 const nextSequence=previousMax+1;
 return {previousMax,nextSequence,nextInvoiceNumber:`${procurementNumber}-INV-${String(nextSequence).padStart(3,'0')}`};
}

export function selectNextSupplierCurrencyGroup<T extends {supplier_id:string;currency:string;created_at?:string}>(rows:T[]){
 const groups=new Map<string,T[]>();
 for(const row of rows){const key=`${row.supplier_id}:${String(row.currency).toUpperCase()}`;groups.set(key,[...(groups.get(key)??[]),row])}
 const ordered=[...groups.values()].sort((a,b)=>String(a[0].created_at??'').localeCompare(String(b[0].created_at??''))||a[0].supplier_id.localeCompare(b[0].supplier_id)||String(a[0].currency).localeCompare(String(b[0].currency)));
 return {group:ordered[0]??[],remainingGroups:Math.max(0,ordered.length-1)};
}
