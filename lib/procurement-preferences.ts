export type ProcurementPreferences = {
  search_priority: 'price' | 'delivery_time' | 'balanced';
  max_lead_time_days: number | null;
  supplier_countries: string[];
  allow_independent_suppliers: boolean;
  allow_alternatives: boolean;
  allow_split_delivery: boolean;
  budget_amount: number | null;
  budget_currency: string | null;
  certificate_requirements: string;
};

export const defaultProcurementPreferences: ProcurementPreferences = { search_priority:'balanced', max_lead_time_days:null, supplier_countries:[], allow_independent_suppliers:false, allow_alternatives:false, allow_split_delivery:false, budget_amount:null, budget_currency:'USD', certificate_requirements:'' };

export function normalizeProcurementPreferences(value: any): ProcurementPreferences {
  const priority = ['price','delivery_time','balanced'].includes(String(value?.search_priority)) ? value.search_priority : 'balanced';
  const lead = value?.max_lead_time_days === '' || value?.max_lead_time_days == null ? null : Number(value.max_lead_time_days);
  const budget = value?.budget_amount === '' || value?.budget_amount == null ? null : Number(value.budget_amount);
  if (lead !== null && (!Number.isInteger(lead) || lead <= 0)) throw new Error('Maximum lead time must be a positive whole number.');
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) throw new Error('Maximum budget must be zero or greater.');
  const currency = value?.budget_currency ? String(value.budget_currency).trim().toUpperCase() : null;
  if (currency && !/^[A-Z]{3}$/.test(currency)) throw new Error('Budget currency must be a three-letter code.');
  const countries: string[] = Array.isArray(value?.supplier_countries) ? [...new Set<string>(value.supplier_countries.map((item:any)=>String(item).trim().toUpperCase()).filter((item:string)=>/^[A-Z]{2}$/.test(item)))] : [];
  return { search_priority:priority, max_lead_time_days:lead, supplier_countries:countries, allow_independent_suppliers:Boolean(value?.allow_independent_suppliers), allow_alternatives:Boolean(value?.allow_alternatives), allow_split_delivery:Boolean(value?.allow_split_delivery), budget_amount:budget, budget_currency:currency, certificate_requirements:String(value?.certificate_requirements||'').trim().slice(0,4000) };
}
