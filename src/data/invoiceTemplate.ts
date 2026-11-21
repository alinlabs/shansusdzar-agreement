import type { ContractDocument } from '../types/contract';
import type { InvoiceDocument } from '../types/invoice';
import { createInvoiceFromModules } from './invoice/index';

export function createInitialInvoiceDocument(contract: ContractDocument): InvoiceDocument {
  return createInvoiceFromModules(contract);
}
