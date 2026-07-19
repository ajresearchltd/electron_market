'use client';
import {openSupplierRequest} from '../homepage/RequestEntryModal';
export default function SupplierRequestQuoteButton({publicSlug,supplierName,className}:{publicSlug:string;supplierName:string;className?:string}){return <button type="button" onClick={()=>openSupplierRequest(publicSlug,supplierName)} className={className||'inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2'}>Request Quote</button>}
