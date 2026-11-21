import type { ContractDocument } from '../types/contract';
import { DEFAULT_AGREEMENT_ISO } from './contract/agreementMeta';
import { createContractFromModules } from './contract/index';

export function createInitialContractDocument(nowIso = DEFAULT_AGREEMENT_ISO): ContractDocument {
  return createContractFromModules(nowIso);
}
