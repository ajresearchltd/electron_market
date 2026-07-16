import 'server-only';
import path from 'path';
import {mkdir,readFile,writeFile,copyFile,unlink,stat} from 'fs/promises';
import {constants} from 'fs';
import {randomUUID} from 'crypto';
import {renderCanonicalInvoicePdf} from './render-invoice-pdf';

export const invoicePdfDirectory=()=>process.env.INVOICE_PDF_DIR?.trim()||path.join(process.cwd(),'invoice');
export const invoicePdfFilename=(invoiceNumber:string)=>{
 const clean=String(invoiceNumber||'').replace(/[\u0000-\u001f\u007f/\\]/g,'-').replace(/\.\./g,'-').replace(/[^A-Za-z0-9._-]/g,'-').replace(/-+/g,'-').replace(/^[-.]+|[-.]+$/g,'');
 if(!clean)throw new Error('Invoice PDF could not be generated.');return `${clean}.pdf`;
};
export async function getOrCreateInvoicePdf(model:any){
 const directory=invoicePdfDirectory(),filename=invoicePdfFilename(model.invoice.invoiceNumber),filePath=path.join(directory,filename);
 await mkdir(directory,{recursive:true,mode:0o750});
 try{const existing=await readFile(filePath);if(existing.length>4&&existing.subarray(0,4).toString()==='%PDF')return{buffer:existing,filename}}catch(error:any){if(error?.code!=='ENOENT')throw error}
 const buffer=await renderCanonicalInvoicePdf(model);if(buffer.length<5||buffer.subarray(0,4).toString()!=='%PDF')throw new Error('Invoice PDF could not be generated.');
 const temp=path.join(directory,`.${filename}.${randomUUID()}.tmp`);await writeFile(temp,buffer,{flag:'wx',mode:0o640});
 try{await copyFile(temp,filePath,constants.COPYFILE_EXCL)}catch(error:any){if(error?.code!=='EEXIST')throw error}finally{await unlink(temp).catch(()=>{})}
 const final=await readFile(filePath);const info=await stat(filePath);if(!info.isFile()||final.subarray(0,4).toString()!=='%PDF')throw new Error('Invoice PDF is not available.');return{buffer:final,filename};
}
