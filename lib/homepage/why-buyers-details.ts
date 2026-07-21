export type WhyBuyersCardDetailRow = {
  id?: string;
  homepage_content_id: string;
  card_number: number;
  modal_title: string | null;
  modal_subtitle: string | null;
  main_image_path: string | null;
  main_image_alt: string | null;
  additional_image_1_path: string | null;
  additional_image_1_alt: string | null;
  additional_image_2_path: string | null;
  additional_image_2_alt: string | null;
  summary_text: string | null;
  body_text: string | null;
  button_text: string | null;
  button_url: string | null;
};

export type WhyBuyersCardDetail = {
  cardNumber: number;
  modalTitle: string | null;
  modalSubtitle: string | null;
  mainImagePath: string | null;
  mainImageAlt: string | null;
  additionalImage1Path: string | null;
  additionalImage1Alt: string | null;
  additionalImage2Path: string | null;
  additionalImage2Alt: string | null;
  summaryText: string | null;
  bodyText: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
};

export const WHY_BUYERS_DETAIL_FIELDS = ['modal_title','modal_subtitle','main_image_path','main_image_alt','additional_image_1_path','additional_image_1_alt','additional_image_2_path','additional_image_2_alt','summary_text','body_text','button_text','button_url'] as const;
export const WHY_BUYERS_IMAGE_UPLOADS = {
  main_image: { pathField: 'main_image_path', folder: 'main', label: 'Main image' },
  additional_image_1: { pathField: 'additional_image_1_path', folder: 'additional-1', label: 'Additional image 1' },
  additional_image_2: { pathField: 'additional_image_2_path', folder: 'additional-2', label: 'Additional image 2' },
} as const;
export type WhyBuyersImageInput = keyof typeof WHY_BUYERS_IMAGE_UPLOADS;
export const WHY_BUYERS_DETAIL_LIMITS: Record<(typeof WHY_BUYERS_DETAIL_FIELDS)[number], number> = { modal_title:160, modal_subtitle:400, main_image_path:2048, main_image_alt:300, additional_image_1_path:2048, additional_image_1_alt:300, additional_image_2_path:2048, additional_image_2_alt:300, summary_text:1000, body_text:20000, button_text:100, button_url:2048 };
export const emptyWhyBuyersDetail = (homepageContentId: string, cardNumber: number): WhyBuyersCardDetailRow => ({ homepage_content_id:homepageContentId, card_number:cardNumber, modal_title:null, modal_subtitle:null, main_image_path:null, main_image_alt:null, additional_image_1_path:null, additional_image_1_alt:null, additional_image_2_path:null, additional_image_2_alt:null, summary_text:null, body_text:null, button_text:null, button_url:null });
const optionalText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
export const mapWhyBuyersCardDetail = (row: WhyBuyersCardDetailRow): WhyBuyersCardDetail => ({
  cardNumber: row.card_number,
  modalTitle: optionalText(row.modal_title), modalSubtitle: optionalText(row.modal_subtitle),
  mainImagePath: optionalText(row.main_image_path), mainImageAlt: optionalText(row.main_image_alt),
  additionalImage1Path: optionalText(row.additional_image_1_path), additionalImage1Alt: optionalText(row.additional_image_1_alt),
  additionalImage2Path: optionalText(row.additional_image_2_path), additionalImage2Alt: optionalText(row.additional_image_2_alt),
  summaryText: optionalText(row.summary_text), bodyText: optionalText(row.body_text),
  buttonText: optionalText(row.button_text), buttonUrl: optionalText(row.button_url),
});
export const safeWhyBuyersCtaUrl = (value?: string | null) => {
  const url = value?.trim() ?? '';
  if (!url) return null;
  if (url.startsWith('/') && !url.startsWith('//')) return { href:url, external:false };
  try { const parsed = new URL(url); return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? { href:parsed.toString(), external:true } : null; } catch { return null; }
};
