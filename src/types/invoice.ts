import type { CompanyIdentity } from './company';
import type { CostBreakdownItem, FinancialInfo, PaymentTermin } from './contract';

export type InvoiceTerminMode = 'TERMIN_1_DP' | 'TERMIN_2_PELUNASAN' | 'FULL_100';
export type InvoicePaymentStatus = 'UNPAID' | 'PAID';

export interface InvoiceBankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  accountRole?: string;
}

export interface InvoiceAdditionalOfferItem {
  id: string;
  serviceName: string;
  description: string;
  normalPriceLabel: string;
  offerPriceLabel: string;
  monthlyPrice?: number;
  durationMonths?: number;
  totalPrice?: number;
  capacityGb?: number;
}

export interface InvoiceDocument {
  id: string;
  invoiceNumber: string;
  contractNumber: string;
  projectName: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  city: string;
  terminMode: InvoiceTerminMode;
  terminLabel: string;
  percentage: number;
  fixedBillAmount?: number;
  expectedContractTotal?: number;
  expectedTerminPercentage?: number;
  status: InvoicePaymentStatus;
  issuer: CompanyIdentity;
  recipient: CompanyIdentity;
  costItems: CostBreakdownItem[];
  terminSchedule?: PaymentTermin[];
  additionalOffers?: InvoiceAdditionalOfferItem[];
  additionalOffersNote?: string;
  customTotalOverride: number;
  priorPaymentDeducted: number;
  ppnPercentage: number;
  taxNote: string;
  bankInfo: InvoiceBankInfo;
  notes: string;
  issuerSigned: boolean;
  issuerSignerName: string;
  issuerSignerTitle: string;
  issuerSignedAt: string;
  issuerSignatureImageDataUrl: string;
}

export interface InvoiceComputedSummary {
  dppSubtotal: number;
  taxableSubtotal: number;
  ppnPercentage: number;
  ppnAmount: number;
  contractSubtotal: number;
  billPercentage: number;
  grossBillAmount: number;
  priorPaymentDeducted: number;
  netPayableAmount: number;
  hasNumericAmount: boolean;
  effectiveCostItems: CostBreakdownItem[];
  terminSource?: FinancialInfo['termins'][number];
}
