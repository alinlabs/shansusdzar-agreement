import type { AgreementInfo, ContractNumberConfig } from '../../types/contract';
import { deriveClientInitials, formatContractNumber } from '../../utils/date';
import { FIRST_PARTY_IDENTITY } from './parties';

export const DEFAULT_AGREEMENT_CITY = 'Purwakarta';
export const DEFAULT_AGREEMENT_DATE = '2026-11-22';
export const DEFAULT_AGREEMENT_ISO = `${DEFAULT_AGREEMENT_DATE}T09:00:00.000Z`;

export const CONTRACT_NUMBER_CONFIG: ContractNumberConfig = {
  prefix: 'ALINLABS/AGR',
  clientCode: deriveClientInitials(FIRST_PARTY_IDENTITY.legalName),
  sequenceNumber: 48,
  useRomanMonth: true,
  year: 2026,
  autoFormat: true,
};

export function createAgreementMeta(agreementDate = DEFAULT_AGREEMENT_DATE): AgreementInfo {
  return {
    contractNumber: formatContractNumber(CONTRACT_NUMBER_CONFIG, agreementDate),
    numberConfig: { ...CONTRACT_NUMBER_CONFIG },
    signingCity: DEFAULT_AGREEMENT_CITY,
    agreementDate,
    governingLanguage: 'Bahasa Indonesia',
    counterpartsCount: 2,
  };
}

export const DOCUMENT_HEADER_META = {
  title: 'SURAT PERJANJIAN KERJA SAMA',
  subtitle: 'JASA PEMBUATAN DAN PENGEMBANGAN WEBSITE',
  legalBasisSummary: [
    'Kitab Undang-Undang Hukum Perdata (KUHPerdata) Pasal 1238, 1243, 1266, 1267, 1320, dan 1338',
    'Undang-Undang Nomor 28 Tahun 2014 tentang Hak Cipta',
    'Undang-Undang Nomor 11 Tahun 2008 tentang ITE sebagaimana terakhir diubah dengan UU Nomor 1 Tahun 2024',
    'Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik',
    'Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi',
    'Undang-Undang Nomor 10 Tahun 2020 tentang Bea Meterai',
  ],
};
