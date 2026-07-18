"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import AdminHubTableViewport from "../admin/AdminHubTableViewport";
type Role = "customer" | "admin";
type Row = Record<string, any>;
const show = (v: any) =>
  v === null || v === undefined || v === "" ? "—" : String(v);
const human = (v: any) =>
  show(v)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
const date = (v: any) => {
  const d = new Date(String(v ?? ""));
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
};
const number = (v: any) =>
  Number(v ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
const money = (v: any, c: any) => `${show(c)} ${number(v)}`;
const fileSize = (value: any) => value == null ? "—" : `${(Number(value) / 1024).toFixed(Number(value) < 1024 * 1024 ? 1 : 0)} ${Number(value) < 1024 * 1024 ? "KB" : "MB"}`;
function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-slate-950">
        {show(value)}
      </div>
    </div>
  );
}
function PaymentUploadModal({id,invoice,onClose,onUploaded}:{id:string;invoice:any;onClose:()=>void;onUploaded:(payment:any)=>void}){
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(""),[error,setError]=useState(""),[sending,setSending]=useState(false),input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(!file){setPreview("");return}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
  const choose=(next:File|null)=>{setError("");if(!next){setFile(null);return}const allowed=new Map([["application/pdf",["pdf"]],["image/jpeg",["jpg","jpeg"]],["image/png",["png"]],["image/gif",["gif"]]]),ext=next.name.split(".").pop()?.toLowerCase();if(!allowed.get(next.type)?.includes(ext||"")||!next.size||next.size>10*1024*1024){setFile(null);setError("Please upload a PDF, JPG, PNG or GIF file up to 10 MB.");return}setFile(next)};
  const submit=async()=>{if(!file){setError("Please select a payment document.");return}setSending(true);setError("");try{const body=new FormData();body.set("file",file);const response=await fetch(`/api/customer/invoices/${encodeURIComponent(id)}/payment-document`,{method:"POST",body}),result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Payment document could not be uploaded.");onUploaded(result.invoice?.payment)}catch(reason){setError(reason instanceof Error?reason.message:"Payment document could not be uploaded.")}finally{setSending(false)}};
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="payment-upload-title"><div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"><header className="rounded-t-2xl bg-[#071b3a] px-5 py-4 text-white"><h3 id="payment-upload-title" className="text-lg font-bold">Upload Payment Document</h3><p className="text-sm text-blue-100">{invoice.invoiceNumber} · {invoice.customer}</p></header><div className="space-y-4 p-5"><p className="text-sm text-slate-600">PDF, JPG, PNG or GIF · maximum 10 MB. The file is uploaded only after you click SEND.</p><button type="button" onClick={()=>input.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();choose(e.dataTransfer.files[0]||null)}} className="w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-5 text-center font-bold text-blue-900">Choose a file or drop it here</button><input ref={input} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,application/pdf,image/jpeg,image/png,image/gif" onChange={e=>choose(e.target.files?.[0]||null)}/>{file&&<div className="flex items-center gap-4 rounded-xl border bg-slate-50 p-3">{file.type.startsWith("image/")?<img src={preview} alt="Selected payment document preview" className="h-[120px] w-[180px] rounded-lg object-contain bg-white"/>:<div className="flex h-20 w-20 items-center justify-center rounded-lg bg-red-100 font-black text-red-700">PDF</div>}<div className="min-w-0"><p className="truncate font-bold">{file.name}</p><p className="text-sm text-slate-500">{fileSize(file.size)}</p></div></div>}{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}</div><footer className="flex justify-end gap-3 border-t bg-slate-50 px-5 py-4"><button type="button" disabled={sending} onClick={onClose} className="rounded-lg border px-5 py-2 font-bold">Cancel</button><button type="button" disabled={sending||!file} onClick={submit} className="inline-flex items-center gap-2 rounded-lg bg-[#0b2b55] px-6 py-2 font-bold text-white shadow-md disabled:opacity-50">{sending&&<span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"/>}{sending?"Sending…":"SEND"}</button></footer></div></div>
}
function InvoiceModal({
  role,
  id,
  onClose,
  onPaymentUpdated,
}: {
  role: Role;
  id: string;
  onClose: () => void;
  onPaymentUpdated: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [expanded, setExpanded] = useState(""),
    [sending, setSending] = useState(false),
    [uploadOpen,setUploadOpen]=useState(false),
    [sendResult, setSendResult] = useState<any>(null);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const c = new AbortController();
    fetch(`/api/${role}/invoices/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(b.error);
        setData(b);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Invoice details could not be loaded. Please try again.");
      });
    return () => {
      c.abort();
      document.body.style.overflow = old;
    };
  }, [id, role]);
  const inv = data?.invoice;
  const send = async () => {
    if (sending) return;
    setSending(true);
    setSendResult(null);
    try {
      const r = await fetch(
          `/api/${role}/invoices/${encodeURIComponent(id)}/send-email`,
          { method: "POST" },
        ),
        b = await r.json().catch(() => ({}));
      setSendResult({
        ...b.emailDelivery,
        invoiceNumber: b.invoiceNumber || inv?.invoiceNumber,
      });
    } catch {
      setSendResult({
        status: "failed",
        invoiceNumber: inv?.invoiceNumber,
        error:
          "Invoice email could not be delivered. The Invoice remains available.",
      });
    } finally {
      setSending(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-dialog-title"
    >
      <div className="flex max-h-[calc(100vh-16px)] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]">
        <header className="flex items-center justify-between gap-4 bg-[#071b3a] px-5 py-4 text-white">
          <div>
            <h2 id="invoice-dialog-title" className="text-xl font-bold">
              Invoice Details
            </h2>
            <p className="text-sm text-blue-100">
              {inv?.invoiceNumber || "Loading Invoice details…"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-lg border border-white/60 px-4 py-2 font-bold disabled:opacity-60"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {error ? (
            <div className="rounded-xl bg-red-50 p-4 text-red-800">{error}</div>
          ) : !data ? (
            <div className="py-16 text-center">Loading Invoice details…</div>
          ) : (
            <>
              <h3 className="mb-3 text-lg font-bold text-blue-950">
                Invoice Summary
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Invoice number" value={inv.invoiceNumber} />
                <Info
                  label="Procurement number"
                  value={inv.procurementNumber}
                />
                <Info label="Source RFQ" value={inv.sourceRfqId} />
                <Info label="Generated" value={date(inv.generatedAt)} />
                <Info label="Customer" value={inv.customer} />
                <Info label="Supplier" value={inv.supplier} />
                <Info label="Status" value={human(inv.status)} />
                <Info label="Items" value={inv.itemCount} />
                <Info
                  label="Subtotal"
                  value={money(inv.subtotal, inv.currency)}
                />
                <Info label="Total" value={money(inv.total, inv.currency)} />
                {role === "admin" && (
                  <>
                    <Info
                      label="Invoice sequence"
                      value={inv.invoiceSequence}
                    />
                    <Info
                      label="Created by role"
                      value={human(inv.createdByRole)}
                    />
                    <Info label="Canonical Invoice ID" value={inv.id} />
                  </>
                )}
              </div>
              {role === "admin" && <><h3 className="mb-3 mt-7 text-lg font-bold text-blue-950">Payment</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Info label="Paid status" value={inv.paid?"Paid":"Not paid"}/><Info label="Paid at" value={date(inv.payment?.paidAt)}/><Info label="Document" value={inv.payment?.originalName}/><Info label="File type" value={inv.payment?.mimeType}/><Info label="File size" value={fileSize(inv.payment?.sizeBytes)}/><Info label="Uploaded" value={date(inv.payment?.uploadedAt)}/><Info label="Uploaded by" value={inv.payment?.uploadedBy}/></div></>}
              <h3 className="mb-3 mt-7 text-lg font-bold text-blue-950">
                Invoice Positions
              </h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-[1150px] text-left text-xs">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      {[
                        "№",
                        "Requested MPN",
                        "Offered MPN",
                        "Description",
                        "Quantity",
                        "Unit Price",
                        "Price Basis",
                        "Line Total",
                        "Lead Time",
                        "Condition",
                      ].map((h) => (
                        <th key={h} className="px-3 py-3 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.items.flatMap((item: Row, index: number) => {
                      const main = (
                        <tr
                          key={item.id}
                          tabIndex={0}
                          onClick={() =>
                            setExpanded(expanded === item.id ? "" : item.id)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpanded(expanded === item.id ? "" : item.id);
                            }
                          }}
                          className="cursor-pointer hover:bg-blue-50 focus-visible:ring-2"
                        >
                          <td className="px-3 py-3">
                            {item.lineNumber ?? index + 1}
                          </td>
                          <td className="px-3 py-3 font-bold">
                            {show(item.requestedMpn)}
                          </td>
                          <td className="px-3 py-3">{show(item.offeredMpn)}</td>
                          <td className="px-3 py-3">
                            {show(item.description)}
                          </td>
                          <td className="px-3 py-3">
                            {show(item.quantity)} {show(item.unit)}
                          </td>
                          <td className="px-3 py-3">
                            {money(item.unitPrice, item.currency)}
                          </td>
                          <td className="px-3 py-3">
                            {show(item.priceBasisQuantity)} /{" "}
                            {show(item.priceBasisUnit)}
                          </td>
                          <td className="px-3 py-3 font-bold">
                            {money(item.lineTotal, item.currency)}
                          </td>
                          <td className="px-3 py-3">
                            {item.leadTimeDays != null
                              ? `${item.leadTimeDays} days`
                              : "—"}
                          </td>
                          <td className="px-3 py-3">{human(item.condition)}</td>
                        </tr>
                      );
                      const detail = (
                        <tr key={`${item.id}-details`}>
                          <td colSpan={10} className="bg-blue-50 p-4">
                            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                              <Info
                                label="Manufacturer"
                                value={item.manufacturer}
                              />
                              <Info label="MOQ" value={item.moq} />
                              <Info
                                label="Available"
                                value={item.availableQuantity}
                              />
                              <Info label="Packaging" value={item.packaging} />
                              <Info label="Date code" value={item.dateCode} />
                              <Info label="Incoterms" value={item.incoterms} />
                              <Info
                                label="Payment terms"
                                value={item.paymentTerms}
                              />
                              <Info label="Validity" value={item.validity} />
                              <Info
                                label="Certificates"
                                value={
                                  item.certificateAvailable == null
                                    ? "—"
                                    : item.certificateAvailable
                                      ? "Available"
                                      : "Not provided"
                                }
                              />
                              <Info
                                label="Delivery"
                                value={item.deliveryConditions}
                              />
                              {role === "admin" && (
                                <>
                                  <Info
                                    label="Allocation ID"
                                    value={item.sourceAllocationId}
                                  />
                                  <Info
                                    label="Response item ID"
                                    value={item.sourceSupplierResponseItemId}
                                  />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                      return expanded === item.id ? [main, detail] : [main];
                    })}
                  </tbody>
                </table>
              </div>
              {sendResult && (
                <div
                  role="status"
                  className={`mt-4 rounded-lg border p-3 text-sm font-semibold ${sendResult.status === "sent" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}
                >
                  {sendResult.status === "sent"
                    ? `Invoice ${sendResult.invoiceNumber || inv.invoiceNumber} was sent successfully to ${sendResult.recipient}.`
                    : sendResult.error ||
                      "Invoice email could not be delivered. The Invoice remains available."}
                </div>
              )}
            </>
          )}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">{data&&<span aria-label={inv.paid?"Paid":"Not paid"} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-bold ${inv.paid?"border-emerald-400 bg-emerald-50 text-emerald-700":"border-slate-300 bg-white text-slate-500"}`}><span aria-hidden="true">{inv.paid?"✓":"□"}</span>{inv.paid?"PAID":"NOT PAID"}</span>}{data&&role==="customer"&&(inv.payment?.downloadAvailable?<a href={`/api/customer/invoices/${encodeURIComponent(id)}/payment-document`} className="rounded-lg border border-blue-200 bg-white px-4 py-2 font-bold text-blue-900 shadow-sm">Download payment</a>:<button type="button" onClick={()=>setUploadOpen(true)} className="rounded-lg border border-blue-200 bg-white px-4 py-2 font-bold text-blue-900 shadow-sm">Upload payment</button>)}{data&&role==="admin"&&inv.payment?.downloadAvailable&&<a href={`/api/admin/invoices/${encodeURIComponent(id)}/payment-document`} className="rounded-lg border border-blue-200 bg-white px-4 py-2 font-bold text-blue-900 shadow-sm">Download payment</a>}</div>
          <div className="flex flex-wrap justify-end gap-3">
          {data && (
            <a
              href={`/api/${role}/invoices/${encodeURIComponent(id)}/pdf`}
              className="inline-flex items-center rounded-lg border border-blue-200 bg-[#0b2b55] px-5 py-2 font-bold text-white shadow-md transition hover:bg-[#123d73]"
            >
              Download PDF
            </a>
          )}
          {data && (
            <button
              onClick={send}
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-[#0b2b55] px-5 py-2 font-bold text-white shadow-md transition hover:bg-[#123d73] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending && (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
              )}
              {sending
                ? "Sending Invoice..."
                : sendResult?.status === "sent"
                  ? "Resend Invoice by Email"
                  : "Send Invoice by Email"}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={sending}
            className="rounded-lg bg-blue-700 px-5 py-2 font-bold text-white disabled:opacity-60"
          >
            Close
          </button>
          </div>
        </footer>
      </div>
      {uploadOpen&&<PaymentUploadModal id={id} invoice={inv} onClose={()=>setUploadOpen(false)} onUploaded={async()=>{setUploadOpen(false);const response=await fetch(`/api/${role}/invoices/${encodeURIComponent(id)}`,{cache:'no-store'}),refreshed=await response.json().catch(()=>null);if(response.ok&&refreshed)setData(refreshed);await onPaymentUpdated()}}/>}
    </div>
  );
}
export default function InvoiceHubTable({
  role,
  title,
  adminHubViewport = false,
}: {
  role: Role;
  title: string;
  adminHubViewport?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [selected, setSelected] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/${role}/invoices`, { cache: "no-store" }),
        b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error);
      setRows(b.invoices ?? []);
    } catch {
      setError("Invoices could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [role]);
  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("invoice-created", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("invoice-created", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);
  const columns =
    role === "admin"
      ? [
          "Invoice No",
          "Procurement No",
          "Generated",
          "Customer",
          "Supplier",
          "Items",
          "Total",
          "Currency",
          "Status",
          "Paid",
        ]
      : [
          "Invoice No",
          "Procurement No",
          "Generated",
          "Supplier",
          "Items",
          "Total",
          "Currency",
          "Status",
        ];
  return (
    <section
      id={`${role}-invoices`}
      className="w-full min-w-0 rounded-2xl border bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold text-blue-900">{title}</h2>
      {error && <div className="mt-4 bg-red-50 p-3 text-red-700">{error}</div>}
      <AdminHubTableViewport label={title} enabled={adminHubViewport} className="mt-4">
        <table className="min-w-[1050px] text-left text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-4 py-3 text-xs uppercase">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center">
                  Loading Invoices…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center">
                  No Invoices have been generated yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  aria-label={`Open Invoice ${row.invoiceNumber} details`}
                  onClick={() => setSelected(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(row.id);
                    }
                  }}
                  className="cursor-pointer hover:bg-blue-50 focus-visible:ring-2"
                >
                  <td className="px-4 py-3 font-bold text-blue-900">
                    {show(row.invoiceNumber)}
                  </td>
                  <td className="px-4 py-3">{show(row.procurementNumber)}</td>
                  <td className="px-4 py-3">{date(row.generatedAt)}</td>
                  {role === "admin" && (
                    <td className="px-4 py-3">{show(row.customer)}</td>
                  )}
                  <td className="px-4 py-3">{show(row.supplier)}</td>
                  <td className="px-4 py-3">{row.itemCount}</td>
                  <td className="px-4 py-3">{number(row.total)}</td>
                  <td className="px-4 py-3">{show(row.currency)}</td>
                  <td className="px-4 py-3">{human(row.status)}</td>
                  {role === "admin" && <td className={`px-4 py-3 font-bold ${row.paid?"text-emerald-700":"text-slate-400"}`}>{row.paid?"✓ Paid":"—"}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </AdminHubTableViewport>
      {selected && (
        <InvoiceModal
          role={role}
          id={selected}
          onClose={() => setSelected("")}
          onPaymentUpdated={load}
        />
      )}
    </section>
  );
}
