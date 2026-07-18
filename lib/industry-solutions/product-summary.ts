export const INDUSTRY_PRODUCT_SUMMARY_MAX_LENGTH = 80;

export function normalizeIndustryProductSummary(value: unknown) {
  const trimmed = String(value ?? '').trim();
  return trimmed || null;
}

export function validateIndustryProductSummary(value: unknown) {
  const normalized = normalizeIndustryProductSummary(value);
  return normalized && Array.from(normalized).length > INDUSTRY_PRODUCT_SUMMARY_MAX_LENGTH
    ? 'Product list must not exceed 80 characters.'
    : null;
}
