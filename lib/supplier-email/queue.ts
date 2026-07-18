import 'server-only';
import {processInboundMessage} from './pipeline';

export async function runSupplierEmailQueue(database:any,limit=5){
  const candidates=await database.rpc('claim_supplier_inbound_messages',{batch_size:Math.min(20,Math.max(1,limit))});
  if(candidates.error)throw new Error('Processing queue could not be claimed.');
  const results=[];
  for(const row of candidates.data??[]){try{results.push(await processInboundMessage(database,row.id))}catch(error){console.error('[supplier-email-processor]',row.id,{code:(error as any)?.code??'processing_failed'});await database.from('supplier_inbound_messages').update({processing_status:'failed',processing_error:'Supplier email processing could not be completed. Reprocess is available.',locked_at:null}).eq('id',row.id);results.push({id:row.id,status:'failed'})}}
  return results;
}
