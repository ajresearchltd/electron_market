import 'server-only';

export const responseTypes = ['full_offer','partial_offer','availability_only','clarification','decline','amendment','replacement','other'] as const;
export const relationships = ['new','replacement','amendment','clarification','unknown'] as const;
export const remainingStatuses = ['explicitly_unavailable','not_mentioned','unknown'] as const;
export const itemStatuses = ['offered','partial_quantity','unavailable','alternative_proposed','clarification_required','rejected'] as const;
export const leadUnits = ['days','business_days','weeks','months','unknown'] as const;

const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };
const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] };
const nullableBoolean = { anyOf: [{ type: 'boolean' }, { type: 'null' }] };

export const supplierEmailResponseSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    procurementNumber: nullableString,
    responseType: { type: 'string', enum: responseTypes },
    responseRelationship: { type: 'string', enum: relationships },
    defaultCurrency: nullableString,
    quoteValidUntilRaw: nullableString,
    quoteValidUntilNormalized: nullableString,
    remainingItemsStatus: { type: 'string', enum: remainingStatuses },
    supplierGeneralMessage: nullableString,
    items: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        sourceReference: { type: 'object', additionalProperties: false, properties: {
          attachmentId: nullableString, sheetName: nullableString, sourceRowNumber: nullableNumber,
          pageNumber: nullableNumber, sourceText: nullableString,
        }, required: ['attachmentId','sheetName','sourceRowNumber','pageNumber','sourceText'] },
        requestedMpn: nullableString, requestedManufacturer: nullableString,
        originalProductName: nullableString, productType: nullableString,
        technicalParameters: { type: 'object', additionalProperties: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }] } },
        commercialTerms: { type: 'object', additionalProperties: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }] } },
        requestedQuantityRaw: nullableString, requestedQuantityNormalized: nullableNumber,
        responseStatus: { type: 'string', enum: itemStatuses },
        offeredMpn: nullableString, offeredManufacturer: nullableString,
        offeredQuantityRaw: nullableString, offeredQuantityNormalized: nullableNumber,
        availableQuantityRaw: nullableString, availableQuantityNormalized: nullableNumber,
        priceRaw: nullableString, priceAmount: nullableNumber, priceBasisQuantity: nullableNumber,
        priceBasisUnit: nullableString, packageQuantity: nullableNumber, calculatedUnitPrice: nullableNumber,
        currency: nullableString, priceBreaks: { anyOf: [{ type: 'array', items: { type: 'object', additionalProperties: false, properties: { minimumQuantity: nullableNumber, priceAmount: nullableNumber, currency: nullableString }, required: ['minimumQuantity','priceAmount','currency'] } }, { type: 'null' }] },
        moqRaw: nullableString, moqNormalized: nullableNumber,
        leadTimeRaw: nullableString, leadTimeValue: nullableNumber,
        leadTimeUnit: { anyOf: [{ type: 'string', enum: leadUnits }, { type: 'null' }] },
        leadTimeDaysNormalized: nullableNumber, stockConfirmed: nullableBoolean,
        dateCodeRaw: nullableString, dateCodeNormalized: nullableString,
        condition: { anyOf: [{ type: 'string', enum: ['new','used','refurbished','unknown'] }, { type: 'null' }] },
        certificateAvailable: nullableBoolean, traceabilityAvailable: nullableBoolean,
        supplierComment: nullableString, extractionConfidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['sourceReference','requestedMpn','requestedManufacturer','originalProductName','productType','technicalParameters','commercialTerms','requestedQuantityRaw','requestedQuantityNormalized','responseStatus','offeredMpn','offeredManufacturer','offeredQuantityRaw','offeredQuantityNormalized','availableQuantityRaw','availableQuantityNormalized','priceRaw','priceAmount','priceBasisQuantity','priceBasisUnit','packageQuantity','calculatedUnitPrice','currency','priceBreaks','moqRaw','moqNormalized','leadTimeRaw','leadTimeValue','leadTimeUnit','leadTimeDaysNormalized','stockConfirmed','dateCodeRaw','dateCodeNormalized','condition','certificateAvailable','traceabilityAvailable','supplierComment','extractionConfidence'],
    } },
  },
  required: ['procurementNumber','responseType','responseRelationship','defaultCurrency','quoteValidUntilRaw','quoteValidUntilNormalized','remainingItemsStatus','supplierGeneralMessage','items'],
} as const;

export type ParsedSupplierEmail = Record<string, any> & { items: Array<Record<string, any>> };

export function validateStructuredSupplierEmail(value: unknown): { value?: ParsedSupplierEmail; errors: string[] } {
  const row = value && typeof value === 'object' ? value as Record<string, any> : null;
  const errors: string[] = [];
  if (!row) return { errors: ['AI output is not an object.'] };
  if (!responseTypes.includes(row.responseType)) errors.push('Invalid response type.');
  if (!relationships.includes(row.responseRelationship)) errors.push('Invalid response relationship.');
  if (!remainingStatuses.includes(row.remainingItemsStatus)) errors.push('Invalid remaining-items status.');
  if (!Array.isArray(row.items)) errors.push('Items must be an array.');
  for (const [index, item] of (Array.isArray(row.items) ? row.items : []).entries()) {
    if (!item || typeof item !== 'object' || !itemStatuses.includes(item.responseStatus)) errors.push(`Item ${index + 1} has an invalid status.`);
    if (!(Number(item.extractionConfidence) >= 0 && Number(item.extractionConfidence) <= 1)) errors.push(`Item ${index + 1} has invalid extraction confidence.`);
    for (const key of ['requestedQuantityNormalized','offeredQuantityNormalized','availableQuantityNormalized','priceAmount','priceBasisQuantity','packageQuantity','calculatedUnitPrice','moqNormalized','leadTimeValue','leadTimeDaysNormalized']) {
      if (item[key] !== null && item[key] !== undefined && (!Number.isFinite(Number(item[key])) || Number(item[key]) < 0)) errors.push(`Item ${index + 1} has invalid ${key}.`);
    }
    if (!item.technicalParameters || typeof item.technicalParameters !== 'object' || Array.isArray(item.technicalParameters)) errors.push(`Item ${index + 1} has invalid technical parameters.`);
    if (!item.commercialTerms || typeof item.commercialTerms !== 'object' || Array.isArray(item.commercialTerms)) errors.push(`Item ${index + 1} has invalid commercial terms.`);
  }
  return errors.length ? { errors } : { value: row as ParsedSupplierEmail, errors: [] };
}
