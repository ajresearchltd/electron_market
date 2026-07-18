import { searchNexarByPartNumber, type NexarSearchResult } from '../market-data/nexar.ts';
import {
  createMatchResult,
  matchSupplierPartNumber,
  normalizeSupplierMpn,
  type SupplierItemMatchResult,
} from './matching.ts';

export type NexarEvidence = {
  attempted: boolean;
  canonicalPartNumber: string | null;
  manufacturer: string | null;
  description: string | null;
  warnings: string[];
  match: SupplierItemMatchResult | null;
};

const emptyEvidence = (): NexarEvidence => ({
  attempted: false,
  canonicalPartNumber: null,
  manufacturer: null,
  description: null,
  warnings: [],
  match: null,
});

export async function resolveSupplierPartWithNexar(
  item: any,
  rfqItems: any[],
  lookup: (partNumber: string) => Promise<NexarSearchResult> = searchNexarByPartNumber,
): Promise<NexarEvidence> {
  const supplied = String(item.offeredMpn || item.requestedMpn || '').trim();
  if (!supplied) return emptyEvidence();
  try {
    const found = await lookup(supplied);
    const canonical = String(found.part_number || '').trim() || null;
    if (!canonical) return { ...emptyEvidence(), attempted: true, manufacturer: found.manufacturer, description: found.description, warnings: ['Nexar returned no canonical Part Number.'] };
    const local = matchSupplierPartNumber({ ...item, offeredMpn: canonical, offeredManufacturer: item.offeredManufacturer || found.manufacturer }, rfqItems);
    if (local && ['matched_exact', 'matched_normalized'].includes(local.matchState)) {
      return {
        attempted: true,
        canonicalPartNumber: canonical,
        manufacturer: found.manufacturer,
        description: found.description,
        warnings: [],
        match: createMatchResult('matched_normalized', local.match, local.candidate, local.candidates, 0.98, [`Nexar confirmed canonical Part Number ${canonical}.`, ...local.reasons], [], 'matched_normalized_nexar'),
      };
    }
    return {
      attempted: true,
      canonicalPartNumber: canonical,
      manufacturer: found.manufacturer,
      description: found.description,
      warnings: [normalizeSupplierMpn(canonical) === normalizeSupplierMpn(supplied) ? 'Nexar verified the supplied Part Number but it did not match an RFQ position.' : 'Nexar returned normalization evidence that requires semantic or Admin review.'],
      match: null,
    };
  } catch {
    return { ...emptyEvidence(), attempted: true, warnings: ['Nexar verification was unavailable; matching continued without it.'] };
  }
}

export async function matchSupplierItemWithEvidence(
  item: any,
  rfqItems: any[],
  lookup: (partNumber: string) => Promise<NexarSearchResult> = searchNexarByPartNumber,
): Promise<{ match: SupplierItemMatchResult | null; nexar: NexarEvidence }> {
  const deterministic = matchSupplierPartNumber(item, rfqItems);
  if (deterministic && !deterministic.reviewRequired) return { match: deterministic, nexar: emptyEvidence() };
  const nexar = await resolveSupplierPartWithNexar(item, rfqItems, lookup);
  if (nexar.match) return { match: nexar.match, nexar };
  return { match: null, nexar };
}
