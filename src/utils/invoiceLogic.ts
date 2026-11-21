import type { ContractDocument, CostBreakdownItem } from '../types/contract';
import type {
  InvoiceAdditionalOfferItem,
  InvoiceBankInfo,
  InvoiceComputedSummary,
  InvoiceDocument,
  InvoiceTerminMode,
} from '../types/invoice';
import {
  INVOICE_ADDITIONAL_OFFERS,
  INVOICE_ADDITIONAL_OFFERS_NOTE,
} from '../data/invoice/additionalServices';
import { INVOICE_BILLING_CONFIG, type InvoiceBillingConfig } from '../data/invoice/invoiceMeta';
import { INVOICE_BANK_INFO, INVOICE_PAYMENT_NOTES } from '../data/invoice/paymentInfo';
import { summarizeCostBreakdown } from './currency';
import { deriveClientInitials, toRomanMonth } from './date';

export const INVOICE_TERMIN_OPTIONS: {
  id: InvoiceTerminMode;
  label: string;
  shortLabel: string;
  percentage: number;
}[] = [
  {
    id: 'TERMIN_1_DP',
    label: 'Pembayaran I — Uang Muka / DP (Rp 700.000)',
    shortLabel: 'Pembayaran I · DP (Rp 700.000)',
    percentage: 37.74,
  },
  {
    id: 'TERMIN_2_PELUNASAN',
    label: 'Pembayaran II — Pelunasan Sisa Setelah Tester Sebelum Deploy (Termasuk PPN)',
    shortLabel: 'Pembayaran II · Pelunasan (Rp 1.155.000)',
    percentage: 62.26,
  },
  {
    id: 'FULL_100',
    label: 'Penawaran Penuh — Keseluruhan Nilai Kontrak (100%)',
    shortLabel: 'Penawaran Penuh (100%)',
    percentage: 100,
  },
];

export function formatInvoiceNumber(
  sequence = 127,
  issueDate = new Date().toISOString().slice(0, 10),
  clientNameOrCode = ''
): string {
  const parsed = new Date(issueDate);
  const valid = !Number.isNaN(parsed.getTime());
  const monthRoman = toRomanMonth(valid ? parsed.getMonth() : new Date().getMonth());
  const year = valid ? parsed.getFullYear() : new Date().getFullYear();
  const seq = String(Math.max(1, sequence)).padStart(3, '0');
  const trimmed = clientNameOrCode.trim();
  const clientCode = /^[A-Z0-9]{2,5}$/.test(trimmed)
    ? trimmed
    : deriveClientInitials(trimmed || 'Shansus Dzar Indonesia');
  return `ALINLABS/${clientCode}/QUO/3-${seq}/${monthRoman}/${year}`;
}

export function addDaysIso(dateIso: string, days: number): string {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function getTerminMeta(mode: InvoiceTerminMode) {
  return INVOICE_TERMIN_OPTIONS.find((opt) => opt.id === mode) ?? INVOICE_TERMIN_OPTIONS[0];
}

function getContractTerminIndex(mode: InvoiceTerminMode): number {
  switch (mode) {
    case 'TERMIN_1_DP':
      return 0;
    case 'TERMIN_2_PELUNASAN':
      return 1;
    default:
      return -1;
  }
}

export interface BuildInvoiceModuleOptions {
  billingConfig?: InvoiceBillingConfig;
  bankInfo?: InvoiceBankInfo;
  paymentNotes?: string;
  additionalOffers?: InvoiceAdditionalOfferItem[];
  additionalOffersNote?: string;
}

export function buildDefaultInvoiceFromContract(
  contract: ContractDocument,
  options: BuildInvoiceModuleOptions = {}
): InvoiceDocument {
  const config = options.billingConfig ?? INVOICE_BILLING_CONFIG;
  const bankInfo = options.bankInfo ?? INVOICE_BANK_INFO;
  const paymentNotes = options.paymentNotes ?? INVOICE_PAYMENT_NOTES;
  const additionalOffers = options.additionalOffers ?? INVOICE_ADDITIONAL_OFFERS;
  const additionalOffersNote = options.additionalOffersNote ?? INVOICE_ADDITIONAL_OFFERS_NOTE;

  const issueDate =
    config.issueDateOverride ||
    contract.agreement.agreementDate ||
    new Date().toISOString().slice(0, 10);
  const dueDate =
    config.dueDateOverride || addDaysIso(issueDate, Math.max(0, config.paymentTermsDays));
  const terminMode = config.terminMode;
  const terminMeta = getTerminMeta(terminMode);
  const terminIdx = getContractTerminIndex(terminMode);
  const contractTermin =
    terminIdx >= 0 ? contract.financial.termins?.[terminIdx] : undefined;

  const resolvedPercentage = contractTermin?.percentage ?? terminMeta.percentage;
  const resolvedTotal =
    config.customTotalOverride > 0
      ? config.customTotalOverride
      : contract.financial.totalValue || 0;
  const hasFixedContractTermin =
    Boolean(contractTermin) &&
    config.customTotalOverride === 0 &&
    typeof contractTermin?.amount === 'number' &&
    contractTermin.amount > 0;

  const ppnPercentage =
    contract.financial.taxMode === 'INCLUDE_PPN'
      ? Math.max(0, contract.financial.ppnPercentage || 11)
      : 0;
  const status =
    config.statusOverride === 'AUTO'
      ? contract.financial.downPaymentPaid > 0
        ? 'PAID'
        : 'UNPAID'
      : config.statusOverride;

  const clientCode =
    contract.agreement.numberConfig?.clientCode?.trim() ||
    deriveClientInitials(contract.firstParty.legalName);

  return {
    id: `inv-${contract.id}`,
    invoiceNumber: formatInvoiceNumber(config.sequenceNumber, issueDate, clientCode),
    contractNumber: contract.agreement.contractNumber,
    projectName: contract.project.projectName,
    issueDate,
    dueDate,
    city: config.cityOverride || contract.agreement.signingCity || 'Purwakarta',
    terminMode,
    terminLabel: terminMeta.label,
    percentage: resolvedPercentage,
    fixedBillAmount: hasFixedContractTermin ? contractTermin!.amount : undefined,
    expectedContractTotal: hasFixedContractTermin ? resolvedTotal : undefined,
    expectedTerminPercentage: hasFixedContractTermin ? resolvedPercentage : undefined,
    status,
    issuer: { ...contract.secondParty },
    recipient: { ...contract.firstParty },
    costItems: structuredClone(contract.financial.costBreakdown ?? []),
    terminSchedule: structuredClone(contract.financial.termins ?? []),
    additionalOffers: structuredClone(additionalOffers),
    additionalOffersNote,
    customTotalOverride: resolvedTotal,
    priorPaymentDeducted: Math.max(0, config.priorPaymentDeducted || 0),
    ppnPercentage,
    taxNote: contract.financial.taxNote,
    bankInfo: {
      bankName: bankInfo.bankName,
      accountNumber: bankInfo.accountNumber,
      accountHolder:
        bankInfo.accountHolder || contract.secondParty.directorName || 'Mela Melati Aprilia',
      accountRole: bankInfo.accountRole,
    },
    notes: paymentNotes,
    issuerSigned: false,
    issuerSignerName: contract.secondParty.directorName || 'Alvareza Hilka Pratama, S.M.',
    issuerSignerTitle: contract.secondParty.directorTitle || 'Pemilik Usaha AlinLabs Indonesia',
    issuerSignedAt: '',
    issuerSignatureImageDataUrl: '',
  };
}

export function computeInvoiceSummary(invoice: InvoiceDocument): InvoiceComputedSummary {
  const effectiveCostItems: CostBreakdownItem[] = invoice.costItems ?? [];
  const itemized = summarizeCostBreakdown(effectiveCostItems);
  const ppnPercentage = Math.max(0, Number(invoice.ppnPercentage) || 0);
  const effectiveTaxableBase =
    itemized.taxableAmount > 0 ? itemized.taxableAmount : itemized.totalAmount;
  const itemizedPpn = Math.round((effectiveTaxableBase * ppnPercentage) / 100);
  const itemizedGrandTotal = itemized.totalAmount + itemizedPpn;

  const customTotal = Math.max(0, Number(invoice.customTotalOverride) || 0);
  const useItemized =
    itemized.hasItemizedAmounts && (customTotal === 0 || customTotal === itemizedGrandTotal);

  let dppSubtotal = 0;
  let taxableSubtotal = 0;
  let ppnAmount = 0;
  let contractSubtotal = 0;

  if (useItemized) {
    dppSubtotal = itemized.totalAmount;
    taxableSubtotal = effectiveTaxableBase;
    ppnAmount = itemizedPpn;
    contractSubtotal = itemizedGrandTotal;
  } else if (customTotal > 0) {
    contractSubtotal = customTotal;
    if (ppnPercentage > 0) {
      dppSubtotal = Math.round(customTotal / (1 + ppnPercentage / 100));
      taxableSubtotal = dppSubtotal;
      ppnAmount = customTotal - dppSubtotal;
    } else {
      dppSubtotal = customTotal;
      taxableSubtotal = 0;
      ppnAmount = 0;
    }
  }

  const billPercentage = Math.max(0, Math.min(100, Number(invoice.percentage) || 0));
  const useFixedBill =
    typeof invoice.fixedBillAmount === 'number' &&
    invoice.fixedBillAmount >= 0 &&
    contractSubtotal > 0 &&
    (invoice.expectedContractTotal === undefined || contractSubtotal === invoice.expectedContractTotal) &&
    (invoice.expectedTerminPercentage === undefined ||
      Math.abs(billPercentage - invoice.expectedTerminPercentage) < 0.01);

  const grossBillAmount = useFixedBill
    ? invoice.fixedBillAmount!
    : contractSubtotal > 0
      ? Math.round((contractSubtotal * billPercentage) / 100)
      : 0;
  const priorPaymentDeducted = Math.max(0, Number(invoice.priorPaymentDeducted) || 0);
  const netPayableAmount = Math.max(0, grossBillAmount - priorPaymentDeducted);

  return {
    dppSubtotal,
    taxableSubtotal,
    ppnPercentage,
    ppnAmount,
    contractSubtotal,
    billPercentage,
    grossBillAmount,
    priorPaymentDeducted,
    netPayableAmount,
    hasNumericAmount: contractSubtotal > 0,
    effectiveCostItems,
  };
}
