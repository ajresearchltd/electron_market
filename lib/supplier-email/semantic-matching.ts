import { createOpenAIClient, loadAiConfig, resolveOpenAIKey } from '../ai/config';
import { matchSupplierSemantically, normalizeSupplierMpn, type SupplierItemMatchResult } from './matching';
import type { NexarEvidence } from './nexar-matching';
import { semanticMatchSchema, validateSemanticMatch } from './semantic-schema';
import {loadSupplierEmailPromptConfig} from './prompt-config';

const rowId = (row: any) => String(row?.rfq_item_id ?? row?.id ?? '');
const responseText = (response: any) => typeof response?.output_text === 'string' ? response.output_text : (response?.output ?? []).flatMap((entry: any) => entry.type === 'message' ? (entry.content ?? []).filter((part: any) => part.type === 'output_text').map((part: any) => part.text) : []).join('');

export async function matchSupplierItemWithOpenAI(item: any, rfqItems: any[], nexar: NexarEvidence): Promise<{ match: SupplierItemMatchResult; engine: 'openai_semantic' | 'local_fallback'; model: string }> {
  let model = process.env.OPENAI_SUPPLIER_EMAIL_MATCH_MODEL || process.env.OPENAI_SUPPLIER_EMAIL_MODEL || '';
  try {
    const { config } = await loadAiConfig();const promptConfig=await loadSupplierEmailPromptConfig();
    const key = resolveOpenAIKey(config);
    model ||= promptConfig.semantic_model||config.default_model;
    if (!key) throw new Error('OpenAI is not configured.');
    const client = createOpenAIClient(key);
    const supplierPosition = {
      originalPartNumber: item.offeredMpn ?? item.requestedMpn ?? null,
      normalizedPartNumber: normalizeSupplierMpn(item.offeredMpn ?? item.requestedMpn) || null,
      productName: item.originalProductName ?? null,
      manufacturer: item.offeredManufacturer ?? item.requestedManufacturer ?? null,
      description: item.description ?? item.sourceReference?.sourceText ?? null,
      package: item.commercialTerms?.packaging ?? item.packageType ?? null,
      technicalParameters: item.technicalParameters ?? [],
      nexarEvidence: { canonicalPartNumber: nexar.canonicalPartNumber, manufacturer: nexar.manufacturer, description: nexar.description, warnings: nexar.warnings },
    };
    const candidates = rfqItems.map((row) => ({ rfqItemId: rowId(row), requestedPartNumber: row.part_number ?? null, manufacturer: row.manufacturer ?? null, productName: row.product_name ?? null, description: row.description ?? null, package: row.package_type ?? null, technicalRequirements: row.technical_requirements ?? null }));
    const request: any = { model, instructions: promptConfig.semantic_system_prompt, input: JSON.stringify({ supplierPosition, currentRfqPositions: candidates }), text: { format: { type: 'json_schema', name: 'supplier_rfq_semantic_match', strict: true, schema: semanticMatchSchema } },...(promptConfig.semantic_max_output_tokens?{max_output_tokens:promptConfig.semantic_max_output_tokens}:{}) };
    for (let attempt = 0; attempt <= Number(promptConfig.semantic_retry_count??1); attempt++) {
      try {
        const response = await client.responses.create(request);
        const parsed = validateSemanticMatch(JSON.parse(responseText(response)), rfqItems);
        if (parsed) return { match: parsed, engine: 'openai_semantic', model };
      } catch (error) {
        console.error('Supplier RFQ semantic matching attempt failed.', { attempt: attempt + 1, code: (error as any)?.status ?? (error as any)?.code ?? 'request_failed' });
      }
    }
  } catch (error) {
    console.error('Supplier RFQ semantic matching unavailable.', { code: (error as any)?.status ?? (error as any)?.code ?? 'configuration_failed' });
  }
  const fallback = matchSupplierSemantically({ ...item, offeredManufacturer: item.offeredManufacturer || nexar.manufacturer, originalProductName: item.originalProductName || nexar.description }, rfqItems);
  return { match: { ...fallback, method: 'local_semantic_fallback', warnings: ['OpenAI semantic matching was unavailable after retry.', ...nexar.warnings, ...fallback.warnings] }, engine: 'local_fallback', model };
}
