import type { ContractDocument } from '../../types/contract';
import { createAgreementMeta, DEFAULT_AGREEMENT_ISO } from './agreementMeta';
import { FIRST_PARTY_IDENTITY, SECOND_PARTY_IDENTITY } from './parties';
import { PROJECT_SCHEDULE_DATA } from './projectSchedule';
import { SCOPE_OF_WORK_DATA } from './scopeOfWork';
import { FINANCIAL_TERMS_DATA } from './financialTerms';
import { CLAUSES_DEFINITIONS_AND_OBLIGATIONS } from './clausesDefinitions';
import { CLAUSES_COMMERCIAL_AND_DELIVERY } from './clausesCommercial';
import { CLAUSES_IP_AND_DATA_PROTECTION } from './clausesIpAndData';
import { CLAUSES_GOVERNANCE_AND_CLOSING } from './clausesGovernance';

export interface DocumentTocItem {
  id: string;
  code: string;
  label: string;
  searchKeyword: string;
}

export const DOCUMENT_TOC_ITEMS: DocumentTocItem[] = [
  { id: 'opening', code: '00', label: 'Pembukaan & Identitas Pihak', searchKeyword: 'SURAT PERJANJIAN KERJA SAMA' },
  { id: 'recitals', code: 'KS', label: 'Konsiderans (Pertimbangan)', searchKeyword: 'KONSIDERANS' },
  { id: 'pasal-1', code: 'P01', label: 'Definisi', searchKeyword: 'PASAL 1' },
  { id: 'pasal-2', code: 'P02', label: 'Ruang Lingkup', searchKeyword: 'PASAL 2' },
  { id: 'pasal-3', code: 'P03', label: 'Kewajiban Pihak I', searchKeyword: 'PASAL 3' },
  { id: 'pasal-4', code: 'P04', label: 'Kewajiban Pihak II', searchKeyword: 'PASAL 4' },
  { id: 'pasal-5', code: 'P05', label: 'Rincian Biaya & DP', searchKeyword: 'PASAL 5' },
  { id: 'pasal-6', code: 'P06', label: 'Jangka Waktu Proyek', searchKeyword: 'PASAL 6' },
  { id: 'pasal-7', code: 'P07', label: 'Serah Terima & UAT', searchKeyword: 'PASAL 7' },
  { id: 'pasal-8', code: 'P08', label: 'Hak Kekayaan Intelektual', searchKeyword: 'PASAL 8' },
  { id: 'pasal-9', code: 'P09', label: 'Kerahasiaan & UU PDP', searchKeyword: 'PASAL 9' },
  { id: 'pasal-10', code: 'P10', label: 'Garansi & Biaya Update', searchKeyword: 'PASAL 10' },
  { id: 'pasal-11', code: 'P11', label: 'Change Request', searchKeyword: 'PASAL 11' },
  { id: 'pasal-12', code: 'P12', label: 'Wanprestasi & Sanksi', searchKeyword: 'PASAL 12' },
  { id: 'pasal-13', code: 'P13', label: 'Keadaan Kahar', searchKeyword: 'PASAL 13' },
  { id: 'pasal-14', code: 'P14', label: 'Pengakhiran', searchKeyword: 'PASAL 14' },
  { id: 'pasal-15', code: 'P15', label: 'Penyelesaian Sengketa', searchKeyword: 'PASAL 15' },
  { id: 'pasal-16', code: 'P16', label: 'Ketentuan Penutup', searchKeyword: 'PASAL 16' },
  { id: 'lampiran', code: 'LP', label: 'Lampiran I & II (SLA & BAST)', searchKeyword: 'LAMPIRAN I' },
  { id: 'signing', code: 'TTD', label: 'Blok Tanda Tangan Akhir', searchKeyword: 'PIHAK PERTAMA' },
];

export function buildAllContractClauses() {
  return [
    ...CLAUSES_DEFINITIONS_AND_OBLIGATIONS,
    ...CLAUSES_COMMERCIAL_AND_DELIVERY,
    ...CLAUSES_IP_AND_DATA_PROTECTION,
    ...CLAUSES_GOVERNANCE_AND_CLOSING,
  ];
}

export function createContractFromModules(nowIso = DEFAULT_AGREEMENT_ISO): ContractDocument {
  const agreementDate = nowIso.slice(0, 10);

  return {
    id: 'alin-shansus-web-001',
    version: 1,
    status: 'FINAL_LOCKED',
    createdAt: nowIso,
    updatedAt: nowIso,
    lastSavedBy: 'AlinLabs Indonesia Legal Engine (.ts)',
    lockedAt: nowIso,
    lockedHash: '',
    agreement: createAgreementMeta(agreementDate),
    firstParty: { ...FIRST_PARTY_IDENTITY },
    secondParty: { ...SECOND_PARTY_IDENTITY },
    project: structuredClone(PROJECT_SCHEDULE_DATA),
    scope: structuredClone(SCOPE_OF_WORK_DATA),
    financial: structuredClone(FINANCIAL_TERMS_DATA),
    legalSettings: {
      ipTransferCondition: 'FULL_PAYMENT',
      sourceCodeHandover: false,
      reusableComponentsOwnedByDeveloper: true,
      allowPortfolioShowcase: true,
      includePdpRoleClause: true,
      warrantyDays: 0,
      bugFixResponseHours: 24,
      maintenanceMonthlyFee: 0,
      maintenanceScope:
        'Garansi perbaikan error source code berlaku selamanya gratis; update source kebijakan eksternal (Google dll) Rp 50.000 - Rp 150.000; perubahan fitur/perombakan pasca deploy mulai Rp 100.000; backup server & cloud diserahkan kepada Pihak Pertama (opsional dikerjakan Pihak Kedua Rp 150.000 - Rp 250.000 per project backup & refresh).',
      forceMajeureNoticeDays: 7,
      terminationNoticeDays: 14,
      disputeForum: 'PENGADILAN_NEGERI',
      disputeJurisdiction: 'Jakarta Selatan',
      stampDutyBearer: 'EACH_PARTY',
    },
    clauses: buildAllContractClauses(),
    signatures: {
      firstParty: {
        signed: false,
        signerName: '',
        signerTitle: '',
        signerEmail: '',
        signedAt: '',
        consentAccepted: false,
        consentStatement:
          'Saya menyatakan berwenang mewakili Shansus Dzar Indonesia dan menyetujui seluruh isi Perjanjian ini.',
        verificationMethod: 'EXPLICIT_CONSENT',
        verificationNote: '',
        signatureImageDataUrl: '',
        documentHashAtSigning: '',
        documentVersionAtSigning: 0,
        certifiedStatus: 'UNVERIFIED_SIMPLE_ESIGN',
      },
      secondParty: {
        signed: false,
        signerName: '',
        signerTitle: '',
        signerEmail: '',
        signedAt: '',
        consentAccepted: false,
        consentStatement:
          'Saya menyatakan berwenang mewakili AlinLabs Indonesia dan menyetujui seluruh isi Perjanjian ini.',
        verificationMethod: 'EXPLICIT_CONSENT',
        verificationNote: '',
        signatureImageDataUrl: '',
        documentHashAtSigning: '',
        documentVersionAtSigning: 0,
        certifiedStatus: 'UNVERIFIED_SIMPLE_ESIGN',
      },
      psre: {
        mode: 'ELECTRONIC_SIMPLE',
        provider: 'NONE',
        providerDisplayName: 'Mode A — Tanda Tangan Elektronik Sederhana (Non-PSrE)',
        apiBaseUrl: '',
        environment: 'SANDBOX',
        apiKeyConfigured: false,
        webhookCallbackUrl: '',
        integrationNote:
          'Siap dihubungkan dengan PSrE Indonesia tersertifikasi Komdigi (PrivyID, VIDA, Peruri, atau TekenSign) melalui konfigurasi API server-side.',
      },
    },
    auditTrail: [
      {
        id: 'audit-init-1',
        timestamp: nowIso,
        actor: 'AlinLabs Indonesia Legal Engine (.ts)',
        action: 'CREATED',
        summary:
          'Dokumen Perjanjian Kerja Sama Shansus Dzar Indonesia × AlinLabs Indonesia dimuat dari modul kontrak TypeScript.',
        versionBefore: 0,
        versionAfter: 1,
        documentHash: '',
      },
    ],
    snapshots: [
      {
        version: 1,
        savedAt: nowIso,
        savedBy: 'AlinLabs Indonesia Legal Engine (.ts)',
        note: 'Dokumen final awal berbasis modul .ts siap untuk pemeriksaan dan penandatanganan',
        documentHash: '',
        status: 'FINAL_LOCKED',
      },
    ],
  };
}
