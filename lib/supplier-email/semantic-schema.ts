import { createMatchResult, type SupplierItemMatchResult } from './matching.ts';

export const semanticMatchSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    matchState: { type: 'string', enum: ['matched_semantic', 'review_required', 'ambiguous', 'unmatched'] },
    matchedRfqItemId: { type: ['string', 'null'] },
    candidateRfqItemIds: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasons: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['matchState', 'matchedRfqItemId', 'candidateRfqItemIds', 'confidence', 'reasons', 'warnings'],
} as const;

const rowId = (row: any) => String(row?.rfq_item_id ?? row?.id ?? '');
export function validateSemanticMatch(value: any, rfqItems: any[]): SupplierItemMatchResult | null {
  const validStates = new Set(['matched_semantic', 'review_required', 'ambiguous', 'unmatched']);
  if (!value || !validStates.has(value.matchState) || !Array.isArray(value.candidateRfqItemIds) || !Array.isArray(value.reasons) || !Array.isArray(value.warnings) || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) return null;
  const byId = new Map(rfqItems.map((row) => [rowId(row), row]));
  const candidateIds = [...new Set<string>(value.candidateRfqItemIds.map((candidate: unknown) => String(candidate)))].filter((id) => byId.has(id));
  const matchedId = value.matchedRfqItemId == null ? null : String(value.matchedRfqItemId);
  if (matchedId && !byId.has(matchedId)) return null;
  if (value.matchState === 'matched_semantic' && !matchedId) return null;
  if (value.matchState !== 'matched_semantic' && matchedId) return null;
  const match = matchedId ? byId.get(matchedId) : null;
  const candidates = candidateIds.map((id) => byId.get(id));
  return createMatchResult(value.matchState, match, candidates[0] ?? null, candidates, value.confidence, value.reasons.map(String), value.warnings.map(String), 'openai_semantic');
}
