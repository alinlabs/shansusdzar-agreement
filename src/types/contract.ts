import type { CompanyIdentity } from './company';
import type { SignatureState } from './signature';

export type DocumentStatus = 'DRAFT' | 'IN_REVIEW' | 'FINAL_LOCKED' | 'SIGNED';

export type SidebarSectionId =
  | 'agreement-info'
  | 'parties-identity'
  | 'project-info'
  | 'scope-of-work'
  | 'pricing-payment'
  | 'rights-obligations'
  | 'intellectual-property'
  | 'confidentiality-pdp'
  | 'warranty-maintenance'
  | 'termination'
  | 'dispute-resolution'
  | 'document-validation'
  | 'signing';

export interface ContractNumberConfig {
  prefix: string;
  clientCode: string;
  sequenceNumber: number;
  useRomanMonth: boolean;
  year: number;
  autoFormat: boolean;
}

export interface AgreementInfo {
  contractNumber: string;
  numberConfig: ContractNumberConfig;
  signingCity: string;
  agreementDate: string; // YYYY-MM-DD
  governingLanguage: string;
  counterpartsCount: number;
}

export interface ProjectMilestone {
  id: string;
  phase: string;
  deliverable: string;
  durationDays: number;
  targetDate: string;
}

export interface ProjectInfo {
  projectName: string;
  websiteType: string;
  websitePurpose: string;
  startDate: string;
  targetEndDate: string;
  estimatedDurationDays: number;
  milestones: ProjectMilestone[];
  clientFeedbackMaxDays: number;
}

export interface ScopeOfWork {
  pagesList: string[];
  featuresList: string[];
  uiUxDesign: string;
  responsiveness: string;
  apiIntegrations: string;
  thirdPartyIntegrations: string;
  cmsAdmin: string;
  includeAiFeatures: boolean;
  aiFeaturesDetail: string;
  deploymentServer: string;
  technicalDocumentation: string;
  techStackDetail?: string;
  securityArchitecture?: string;
  seoGeoPerformance?: string;
  includedRevisions: number;
  outOfScopePolicy: string;
}

export interface CostBreakdownItem {
  id: string;
  itemName: string;
  description: string;
  amount: number;
  originalAmount?: number;
  note?: string;
  taxable?: boolean;
}

export interface PaymentTermin {
  id: string;
  description: string;
  percentage: number;
  amount: number;
  trigger: string;
  dueDate: string;
  isPriorDp: boolean;
  status: 'PAID' | 'PENDING';
}

export type TaxMode = 'EXCLUDE_TAX' | 'INCLUDE_PPN' | 'NON_PKP';

export interface FinancialInfo {
  totalValue: number;
  downPaymentPaid: number;
  downPaymentDate: string;
  downPaymentInvoiceNumber: string;
  downPaymentReference: string;
  downPaymentMethod: string;
  taxMode: TaxMode;
  ppnPercentage: number;
  taxableBaseValue?: number;
  taxNote: string;
  additionalCostsNote: string;
  costBreakdown?: CostBreakdownItem[];
  termins: PaymentTermin[];
}

export interface LegalSettings {
  ipTransferCondition: 'FULL_PAYMENT' | 'PROPORTIONAL';
  sourceCodeHandover: boolean;
  reusableComponentsOwnedByDeveloper: boolean;
  allowPortfolioShowcase: boolean;
  includePdpRoleClause: boolean;
  warrantyDays: number;
  bugFixResponseHours: number;
  maintenanceMonthlyFee: number;
  maintenanceScope: string;
  forceMajeureNoticeDays: number;
  terminationNoticeDays: number;
  disputeForum: 'BANI' | 'PENGADILAN_NEGERI';
  disputeJurisdiction: string;
  stampDutyBearer: 'EACH_PARTY' | 'FIRST_PARTY' | 'SECOND_PARTY';
}

export interface ClauseParagraph {
  id: string;
  text: string;
  enabled: boolean;
  optional: boolean;
}

export interface ContractClause {
  id: string;
  articleNumber: number;
  title: string;
  sectionGroup: SidebarSectionId;
  enabled: boolean;
  optional: boolean;
  legalBasisHint?: string;
  paragraphs: ClauseParagraph[];
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action:
    | 'CREATED'
    | 'UPDATED'
    | 'AUTOSAVED'
    | 'DUPLICATED'
    | 'VALIDATED'
    | 'LOCKED_FOR_SIGNING'
    | 'UNLOCKED_INVALIDATED'
    | 'SIGNED_FIRST_PARTY'
    | 'SIGNED_SECOND_PARTY'
    | 'PDF_EXPORTED'
    | 'PSRE_CONFIG_UPDATED';
  summary: string;
  versionBefore: number;
  versionAfter: number;
  documentHash: string;
}

export interface ContractSnapshot {
  version: number;
  savedAt: string;
  savedBy: string;
  note: string;
  documentHash: string;
  status: DocumentStatus;
}

export interface ContractDocument {
  id: string;
  version: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  lastSavedBy: string;
  lockedAt: string;
  lockedHash: string;
  agreement: AgreementInfo;
  firstParty: CompanyIdentity;
  secondParty: CompanyIdentity;
  project: ProjectInfo;
  scope: ScopeOfWork;
  financial: FinancialInfo;
  legalSettings: LegalSettings;
  clauses: ContractClause[];
  signatures: SignatureState;
  auditTrail: AuditEvent[];
  snapshots: ContractSnapshot[];
}
