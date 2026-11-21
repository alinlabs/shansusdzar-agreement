import type { CostBreakdownItem, FinancialInfo, PaymentTermin } from '../types/contract';

export function formatIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatNumberID(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('id-ID').format(safe);
}

export function calculateRemainingPayment(totalValue: number, downPaymentPaid: number): number {
  const total = Number.isFinite(totalValue) ? Math.max(0, totalValue) : 0;
  const dp = Number.isFinite(downPaymentPaid) ? Math.max(0, downPaymentPaid) : 0;
  return Math.max(0, total - dp);
}

export function calculateTaxSummary(financial: FinancialInfo): {
  baseValue: number;
  ppnAmount: number;
  grandTotal: number;
  downPaymentPaid: number;
  remainingPayment: number;
} {
  const totalValue = Number.isFinite(financial.totalValue) ? Math.max(0, financial.totalValue) : 0;
  const dp = Number.isFinite(financial.downPaymentPaid) ? Math.max(0, financial.downPaymentPaid) : 0;
  const ppnRate = Number.isFinite(financial.ppnPercentage) ? Math.max(0, financial.ppnPercentage) : 11;

  if (financial.taxMode === 'INCLUDE_PPN') {
    const itemizedSummary = summarizeCostBreakdown(financial.costBreakdown);
    const explicitTaxableBase =
      typeof financial.taxableBaseValue === 'number' && financial.taxableBaseValue >= 0
        ? financial.taxableBaseValue
        : itemizedSummary.taxableAmount > 0
          ? itemizedSummary.taxableAmount
          : undefined;

    if (explicitTaxableBase !== undefined) {
      const ppnAmount = Math.round((explicitTaxableBase * ppnRate) / 100);
      const baseValue = Math.max(0, totalValue - ppnAmount);
      return {
        baseValue,
        ppnAmount,
        grandTotal: totalValue,
        downPaymentPaid: dp,
        remainingPayment: calculateRemainingPayment(totalValue, dp),
      };
    }

    const baseValue = Math.round(totalValue / (1 + ppnRate / 100));
    const ppnAmount = totalValue - baseValue;
    return {
      baseValue,
      ppnAmount,
      grandTotal: totalValue,
      downPaymentPaid: dp,
      remainingPayment: calculateRemainingPayment(totalValue, dp),
    };
  }

  return {
    baseValue: totalValue,
    ppnAmount: 0,
    grandTotal: totalValue,
    downPaymentPaid: dp,
    remainingPayment: calculateRemainingPayment(totalValue, dp),
  };
}

export function summarizeTermins(termins: PaymentTermin[], totalValue: number): {
  totalPercentage: number;
  totalAmount: number;
  isPercentageValid: boolean;
  isAmountConsistent: boolean;
  differenceAmount: number;
} {
  const totalPercentage = termins.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
  const totalAmount = termins.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const roundedPercent = Math.round(totalPercentage * 100) / 100;
  const isPercentageValid = totalValue === 0 ? true : Math.abs(roundedPercent - 100) <= 0.01;
  const differenceAmount = Math.round(totalAmount - totalValue);
  const isAmountConsistent = totalValue === 0 ? true : Math.abs(differenceAmount) <= 100;

  return {
    totalPercentage: roundedPercent,
    totalAmount: Math.round(totalAmount),
    isPercentageValid,
    isAmountConsistent,
    differenceAmount,
  };
}

export function summarizeCostBreakdown(items: CostBreakdownItem[] | undefined): {
  totalAmount: number;
  taxableAmount: number;
  hasItemizedAmounts: boolean;
} {
  if (!items || items.length === 0) {
    return { totalAmount: 0, taxableAmount: 0, hasItemizedAmounts: false };
  }
  const totalAmount = items.reduce(
    (sum, item) => sum + (Number.isFinite(item.amount) ? Math.max(0, item.amount) : 0),
    0
  );
  const taxableAmount = items.reduce(
    (sum, item) =>
      sum + (item.taxable && Number.isFinite(item.amount) ? Math.max(0, item.amount) : 0),
    0
  );
  const hasItemizedAmounts = items.some((item) => Number.isFinite(item.amount) && item.amount > 0);
  return {
    totalAmount: Math.round(totalAmount),
    taxableAmount: Math.round(taxableAmount),
    hasItemizedAmounts,
  };
}

const SATUAN = [
  '',
  'Satu',
  'Dua',
  'Tiga',
  'Empat',
  'Lima',
  'Enam',
  'Tujuh',
  'Delapan',
  'Sembilan',
  'Sepuluh',
  'Sebelas',
];

function terbilangCore(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${terbilangCore(n - 10)} Belas`;
  if (n < 100) return `${terbilangCore(Math.floor(n / 10))} Puluh ${terbilangCore(n % 10)}`.trim();
  if (n < 200) return `Seratus ${terbilangCore(n - 100)}`.trim();
  if (n < 1000) return `${terbilangCore(Math.floor(n / 100))} Ratus ${terbilangCore(n % 100)}`.trim();
  if (n < 2000) return `Seribu ${terbilangCore(n - 1000)}`.trim();
  if (n < 1000000) return `${terbilangCore(Math.floor(n / 1000))} Ribu ${terbilangCore(n % 1000)}`.trim();
  if (n < 1000000000) return `${terbilangCore(Math.floor(n / 1000000))} Juta ${terbilangCore(n % 1000000)}`.trim();
  if (n < 1000000000000) return `${terbilangCore(Math.floor(n / 1000000000))} Miliar ${terbilangCore(n % 1000000000)}`.trim();
  return `${terbilangCore(Math.floor(n / 1000000000000))} Triliun ${terbilangCore(n % 1000000000000)}`.trim();
}

export function terbilangIDR(amount: number): string {
  const safe = Math.floor(Math.max(0, Number.isFinite(amount) ? amount : 0));
  if (safe === 0) return 'Nol Rupiah';
  return `${terbilangCore(safe).replace(/\s+/g, ' ').trim()} Rupiah`;
}
