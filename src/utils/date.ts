import type { ContractNumberConfig } from '../types/contract';

const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const INDONESIAN_DAYS = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function toRomanMonth(monthIndexZeroBased: number): string {
  return ROMAN_MONTHS[monthIndexZeroBased] ?? 'I';
}

export function formatIndonesianDate(isoDate: string): string {
  if (!isoDate) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return isoDate;
  return `${day} ${INDONESIAN_MONTHS[month]} ${year}`;
}

export function getIndonesianDayName(isoDate: string): string {
  if (!isoDate) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return '';
  return INDONESIAN_DAYS[date.getDay()] ?? '';
}

export function deriveClientInitials(clientName: string): string {
  const tokens = (clientName || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !['PT', 'CV', 'UD', 'TBK', 'FIRMA', 'YAYASAN'].includes(t));
  if (tokens.length === 0) return 'CLI';
  if (tokens.length === 1) return tokens[0].slice(0, 3);
  return tokens
    .slice(0, 4)
    .map((t) => t[0])
    .join('');
}

export function deriveClientNumericCode(clientName: string): string {
  const normalized = (clientName || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return '100';
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const codeNum = 101 + ((hash >>> 0) % 899);
  return String(codeNum);
}

export function formatContractNumber(config: ContractNumberConfig, isoDate?: string): string {
  const seq = String(Math.max(1, Math.floor(config.sequenceNumber || 48))).padStart(3, '0');
  let monthIndex = new Date().getMonth();
  let year = config.year || new Date().getFullYear();

  if (isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
    if (match) {
      year = config.year || Number(match[1]);
      monthIndex = Math.min(11, Math.max(0, Number(match[2]) - 1));
    }
  }

  const monthPart = config.useRomanMonth
    ? toRomanMonth(monthIndex)
    : String(monthIndex + 1).padStart(2, '0');

  const rawPrefix = (config.prefix || 'ALINLABS/AGR').replace(/\/+$/, '');
  const parts = rawPrefix.split('/').filter(Boolean);
  const brandPrefix = parts[0] || 'ALINLABS';
  const docType = parts.length >= 2 ? parts[1] : parts[0] && parts[0] !== 'ALINLABS' ? parts[0] : 'AGR';
  const rawClient = (config.clientCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const clientCode = rawClient || 'SDI';

  return `${brandPrefix}/${clientCode}/${docType}/3-${seq}/${monthPart}/${year}`;
}

export function formatDateTimeID(isoTimestamp: string): string {
  if (!isoTimestamp) return '-';
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return isoTimestamp;
  const day = d.getDate();
  const month = INDONESIAN_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}
