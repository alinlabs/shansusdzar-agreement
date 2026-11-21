import type { ContractDocument } from '../../types/contract';
import type { InvoiceDocument } from '../../types/invoice';
import { buildDefaultInvoiceFromContract } from '../../utils/invoiceLogic';
import {
  INVOICE_ADDITIONAL_OFFERS,
  INVOICE_ADDITIONAL_OFFERS_NOTE,
} from './additionalServices';
import { INVOICE_BILLING_CONFIG } from './invoiceMeta';
import { INVOICE_BANK_INFO, INVOICE_PAYMENT_NOTES } from './paymentInfo';

export {
  INVOICE_ADDITIONAL_OFFERS,
  INVOICE_ADDITIONAL_OFFERS_NOTE,
} from './additionalServices';
export { INVOICE_BILLING_CONFIG } from './invoiceMeta';
export { INVOICE_BANK_INFO, INVOICE_PAYMENT_NOTES } from './paymentInfo';

export function createInvoiceFromModules(contract: ContractDocument): InvoiceDocument {
  return buildDefaultInvoiceFromContract(contract, {
    billingConfig: INVOICE_BILLING_CONFIG,
    bankInfo: INVOICE_BANK_INFO,
    paymentNotes: INVOICE_PAYMENT_NOTES,
    additionalOffers: INVOICE_ADDITIONAL_OFFERS,
    additionalOffersNote: INVOICE_ADDITIONAL_OFFERS_NOTE,
  });
}
