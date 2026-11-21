import type { CompanyIdentity } from '../types/company';

export const DEFAULT_FIRST_PARTY: CompanyIdentity = {
  roleLabel: 'PIHAK PERTAMA (KLIEN / PEMBELI)',
  legalName: 'Shansus Dzar Indonesia',
  commercialName: 'Shansus Dzar Indonesia',
  entityType: 'Badan Usaha / Perusahaan',
  businessField: 'Interior Design & Building',
  address: '',
  nib: '',
  npwp: '',
  directorName: '',
  directorTitle: '',
  authorityBasis: '',
  phone: '',
  email: '',
};

export const DEFAULT_SECOND_PARTY: CompanyIdentity = {
  roleLabel: 'PIHAK KEDUA (PENYEDIA JASA / PENGEMBANG)',
  legalName: 'AlinLabs Indonesia',
  commercialName: 'AlinLabs Indonesia',
  entityType: 'Badan Usaha / Perusahaan Teknologi Digital',
  businessField: 'Digital Agency, Website Development, Artificial Intelligence & Digital Solutions',
  address: '',
  nib: '',
  npwp: '',
  directorName: '',
  directorTitle: '',
  authorityBasis: '',
  phone: '',
  email: '',
};
