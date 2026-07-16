import 'server-only';

// One controlled source for the approved Electron Market issuer details.
export function getInvoiceIssuer() {
  return {
    companyName: 'Electron Market',
    legalCompanyName: 'AIG Research Ltd.',
    registrationNumber: '16265657',
    vatNumber: null,
    address: '128 City Road, London, EC1V 2NX, United Kingdom',
    accountHolder: 'EURO',
    bankName: null,
    bankAddress: 'Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium',
    iban: 'BE40905303790263',
    swiftBic: 'TRWIBEB1XXX',
    contactEmail: process.env.INVOICE_ISSUER_CONTACT_EMAIL?.trim()
      || process.env.SMTP_REPLY_TO?.trim()
      || process.env.SMTP_FROM_EMAIL?.trim()
      || null,
  };
}
