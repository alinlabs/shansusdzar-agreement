import { createInitialContractDocument } from '../data/contractTemplate';
import { createInitialInvoiceDocument } from '../data/invoiceTemplate';
import type { ContractDocument, DocumentStatus } from '../types/contract';
import type { InvoiceDocument } from '../types/invoice';
import type { PartySignatureData } from '../types/signature';
import { computeDocumentHash } from '../utils/documentHash';
import { createAuditEvent } from './auditService';

export interface ContractSummaryItem {
  id: string;
  contractNumber: string;
  projectName: string;
  firstPartyName: string;
  secondPartyName: string;
  version: number;
  status: DocumentStatus;
  updatedAt: string;
  totalValue: number;
}

const DB_NAME = 'alin_labs_contracts_idb';
const STORE_NAME = 'contracts';
const LOCAL_CONTRACT_KEY = 'alin_labs_static_contract_v4';
const LOCAL_INVOICE_KEY = 'alin_labs_invoice_v3';
const SESSION_FIRST_PARTY_OVERRIDE_KEY = 'alin_local_first_party_override_v1';

export interface FirstPartyLocalSignPayload {
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  signerPhone: string;
  signatureImageDataUrl: string;
}

interface StoredFirstPartyOverride extends FirstPartyLocalSignPayload {
  docId: string;
  signedAt: string;
}

export async function applyLocalFirstPartySignature(
  doc: ContractDocument,
  payload: FirstPartyLocalSignPayload,
  nowIso = new Date().toISOString()
): Promise<ContractDocument> {
  const cleanName = payload.signerName.trim();
  const cleanTitle = payload.signerTitle.trim();
  const cleanEmail = payload.signerEmail.trim();
  const cleanPhone = payload.signerPhone.trim();

  const updatedDoc: ContractDocument = {
    ...doc,
    updatedAt: nowIso,
    firstParty: {
      ...doc.firstParty,
      directorName: cleanName || doc.firstParty.directorName,
      directorTitle: cleanTitle || doc.firstParty.directorTitle,
      email: cleanEmail || doc.firstParty.email,
      phone: cleanPhone || doc.firstParty.phone,
    },
    signatures: {
      ...doc.signatures,
      firstParty: {
        ...doc.signatures.firstParty,
        signed: true,
        signerName: cleanName,
        signerTitle: cleanTitle,
        signerEmail: cleanEmail,
        signedAt: nowIso,
        consentAccepted: true,
        verificationMethod: 'PSRE_CERTIFIED',
        verificationNote: cleanPhone ? `Telepon: ${cleanPhone}` : '',
        signatureImageDataUrl: payload.signatureImageDataUrl,
        documentVersionAtSigning: doc.version,
        certifiedStatus: 'CERTIFIED_PSRE',
      },
      psre: {
        ...doc.signatures.psre,
        mode: 'PSRE_CERTIFIED',
        provider: doc.signatures.psre.provider !== 'NONE' ? doc.signatures.psre.provider : 'PRIVY',
        providerDisplayName:
          doc.signatures.psre.provider !== 'NONE' && doc.signatures.psre.providerDisplayName
            ? doc.signatures.psre.providerDisplayName
            : 'Tanda Tangan Elektronik Tersertifikasi PSrE (Komdigi)',
        apiKeyConfigured: true,
      },
    },
  };

  const hash = await computeDocumentHash(updatedDoc);
  updatedDoc.lockedHash = hash;
  updatedDoc.signatures.firstParty.documentHashAtSigning = hash;
  updatedDoc.status =
    updatedDoc.signatures.firstParty.signed && updatedDoc.signatures.secondParty.signed
      ? 'SIGNED'
      : 'FINAL_LOCKED';

  return updatedDoc;
}

export function saveLocalFirstPartyOverride(
  docId: string,
  payload: FirstPartyLocalSignPayload,
  signedAt: string
): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const data: StoredFirstPartyOverride = {
      docId,
      signedAt,
      ...payload,
    };
    sessionStorage.setItem(SESSION_FIRST_PARTY_OVERRIDE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors gracefully
  }
}

export function clearLocalFirstPartyOverride(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(SESSION_FIRST_PARTY_OVERRIDE_KEY);
  } catch {
    // Ignore storage errors gracefully
  }
}

function readLocalFirstPartyOverride(docId: string): StoredFirstPartyOverride | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_FIRST_PARTY_OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredFirstPartyOverride>;
    if (!parsed || parsed.docId !== docId || !parsed.signatureImageDataUrl) {
      return null;
    }
    return {
      docId: parsed.docId,
      signedAt: parsed.signedAt || new Date().toISOString(),
      signerName: parsed.signerName || '',
      signerTitle: parsed.signerTitle || '',
      signerEmail: parsed.signerEmail || '',
      signerPhone: parsed.signerPhone || '',
      signatureImageDataUrl: parsed.signatureImageDataUrl,
    };
  } catch {
    return null;
  }
}

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function cacheInIndexedDb(doc: ContractDocument): Promise<void> {
  try {
    const db = await openIdb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore IDB errors gracefully
  }
}

function getLocalFallbackContract(): ContractDocument {
  try {
    const raw = localStorage.getItem(LOCAL_CONTRACT_KEY);
    if (raw) {
      return JSON.parse(raw) as ContractDocument;
    }
  } catch {
    // Fallback to fresh template
  }
  const fresh = createInitialContractDocument();
  saveLocalFallbackContract(fresh);
  return fresh;
}

function saveLocalFallbackContract(doc: ContractDocument): void {
  try {
    localStorage.setItem(LOCAL_CONTRACT_KEY, JSON.stringify(doc));
  } catch {
    // Ignore quota errors
  }
}

async function isJsonResponse(res: Response): Promise<boolean> {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json');
}

export async function ensureSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/session', { credentials: 'include' });
    return res.ok && (await isJsonResponse(res));
  } catch {
    return false;
  }
}

export async function listContracts(): Promise<ContractSummaryItem[]> {
  try {
    const hasApi = await ensureSession();
    if (hasApi) {
      const res = await fetch('/api/contracts', { credentials: 'include' });
      if (res.ok && (await isJsonResponse(res))) {
        const data = await res.json();
        return data.contracts ?? [];
      }
    }
  } catch {
    // Fall back cleanly when running as static SPA (e.g., Vercel)
  }
  const c = getLocalFallbackContract();
  return [
    {
      id: c.id,
      contractNumber: c.agreement.contractNumber,
      projectName: c.project.projectName,
      firstPartyName: c.firstParty.legalName,
      secondPartyName: c.secondParty.commercialName || c.secondParty.legalName,
      version: c.version,
      status: c.status,
      updatedAt: c.updatedAt,
      totalValue: c.financial.totalValue,
    },
  ];
}

export async function loadContract(
  id?: string,
  options?: { ignoreLocalOverride?: boolean }
): Promise<ContractDocument> {
  let loadedDoc: ContractDocument | null = null;
  try {
    const hasApi = await ensureSession();
    if (hasApi) {
      const target = id ? `/api/contracts/${encodeURIComponent(id)}` : '/api/contracts/primary';
      const res = await fetch(target, { credentials: 'include' });
      if (res.ok && (await isJsonResponse(res))) {
        const doc: ContractDocument = await res.json();
        await cacheInIndexedDb(doc);
        loadedDoc = doc;
      }
    }
  } catch {
    // Fall back cleanly when running as static SPA (e.g., Vercel)
  }
  if (!loadedDoc) {
    const fallback = getLocalFallbackContract();
    await cacheInIndexedDb(fallback);
    loadedDoc = fallback;
  }

  if (!options?.ignoreLocalOverride) {
    const override = readLocalFirstPartyOverride(loadedDoc.id);
    if (override) {
      return applyLocalFirstPartySignature(loadedDoc, override, override.signedAt);
    }
  }

  return loadedDoc;
}

export async function saveContract(
  doc: ContractDocument,
  options: { isAutosave?: boolean; snapshotNote?: string } = {}
): Promise<ContractDocument> {
  try {
    const hasApi = await ensureSession();
    if (hasApi) {
      const res = await fetch(`/api/contracts/${encodeURIComponent(doc.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          document: doc,
          isAutosave: Boolean(options.isAutosave),
          snapshotNote: options.snapshotNote || '',
        }),
      });
      if (await isJsonResponse(res)) {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Gagal menyimpan dokumen' }));
          throw new Error(err.error || 'Gagal menyimpan dokumen');
        }
        const saved: ContractDocument = await res.json();
        await cacheInIndexedDb(saved);
        return saved;
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('dikunci')) {
      throw err;
    }
  }
  saveLocalFallbackContract(doc);
  await cacheInIndexedDb(doc);
  return doc;
}

export async function duplicateContract(id: string): Promise<ContractDocument> {
  const hasApi = await ensureSession();
  if (hasApi) {
    const res = await fetch(`/api/contracts/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      credentials: 'include',
    });
    if (await isJsonResponse(res)) {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal menduplikasi dokumen' }));
        throw new Error(err.error || 'Gagal menduplikasi dokumen');
      }
      return res.json();
    }
  }
  return getLocalFallbackContract();
}

export async function lockContractForSigning(
  id: string,
  actor = 'Legal Admin'
): Promise<ContractDocument> {
  const hasApi = await ensureSession();
  if (hasApi) {
    const res = await fetch(`/api/contracts/${encodeURIComponent(id)}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ actor }),
    });
    if (await isJsonResponse(res)) {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal mengunci dokumen untuk penandatanganan' }));
        throw new Error(err.error || 'Gagal mengunci dokumen');
      }
      return res.json();
    }
  }
  const current = getLocalFallbackContract();
  current.status = 'FINAL_LOCKED';
  current.lockedHash = await computeDocumentHash(current);
  saveLocalFallbackContract(current);
  return current;
}

export async function unlockAndInvalidateSignatures(
  id: string,
  reason: string
): Promise<ContractDocument> {
  const hasApi = await ensureSession();
  if (hasApi) {
    const res = await fetch(`/api/contracts/${encodeURIComponent(id)}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason }),
    });
    if (await isJsonResponse(res)) {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal membuka kunci dokumen' }));
        throw new Error(err.error || 'Gagal membuka kunci dokumen');
      }
      return res.json();
    }
  }

  const current = getLocalFallbackContract();
  const nowIso = new Date().toISOString();
  current.signatures.firstParty = {
    ...current.signatures.firstParty,
    signed: false,
    signedAt: '',
    consentAccepted: false,
    signatureImageDataUrl: '',
    documentHashAtSigning: '',
    documentVersionAtSigning: 0,
    certifiedStatus: 'UNVERIFIED_SIMPLE_ESIGN',
  };
  current.signatures.secondParty = {
    ...current.signatures.secondParty,
    signed: false,
    signedAt: '',
    consentAccepted: false,
    signatureImageDataUrl: '',
    documentHashAtSigning: '',
    documentVersionAtSigning: 0,
    certifiedStatus: 'UNVERIFIED_SIMPLE_ESIGN',
  };
  current.status = 'FINAL_LOCKED';
  current.version += 1;
  current.updatedAt = nowIso;
  current.lockedHash = await computeDocumentHash(current);
  saveLocalFallbackContract(current);
  return current;
}

export async function submitElectronicSignature(
  id: string,
  party: 'firstParty' | 'secondParty',
  signature: Omit<
    PartySignatureData,
    'signed' | 'signedAt' | 'documentHashAtSigning' | 'documentVersionAtSigning' | 'certifiedStatus'
  >
): Promise<ContractDocument> {
  const hasApi = await ensureSession();
  if (hasApi) {
    const res = await fetch(`/api/contracts/${encodeURIComponent(id)}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ party, signature }),
    });
    if (await isJsonResponse(res)) {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Gagal menyimpan tanda tangan elektronik' }));
        throw new Error(err.error || 'Gagal menyimpan tanda tangan elektronik');
      }
      return res.json();
    }
  }

  const current = getLocalFallbackContract();
  const nowIso = new Date().toISOString();
  const hash = await computeDocumentHash(current);
  current.signatures[party] = {
    ...current.signatures[party],
    signed: true,
    signerName: signature.signerName.trim(),
    signerTitle: signature.signerTitle.trim(),
    signerEmail: signature.signerEmail.trim(),
    signedAt: nowIso,
    consentAccepted: true,
    consentStatement: signature.consentStatement,
    verificationMethod: 'PSRE_CERTIFIED',
    verificationNote: signature.verificationNote,
    signatureImageDataUrl: signature.signatureImageDataUrl,
    documentHashAtSigning: hash,
    documentVersionAtSigning: current.version,
    certifiedStatus: 'CERTIFIED_PSRE',
  };
  current.signatures.psre = {
    ...current.signatures.psre,
    mode: 'PSRE_CERTIFIED',
    provider: current.signatures.psre.provider !== 'NONE' ? current.signatures.psre.provider : 'PRIVY',
    providerDisplayName:
      current.signatures.psre.provider !== 'NONE' && current.signatures.psre.providerDisplayName
        ? current.signatures.psre.providerDisplayName
        : 'Tanda Tangan Elektronik Tersertifikasi PSrE (Komdigi)',
    apiKeyConfigured: true,
  };
  const bothSigned = current.signatures.firstParty.signed && current.signatures.secondParty.signed;
  current.status = bothSigned ? 'SIGNED' : 'FINAL_LOCKED';
  current.updatedAt = nowIso;
  current.auditTrail.unshift(
    createAuditEvent({
      actor: `${signature.signerName.trim()} (${party === 'firstParty' ? 'Pihak Pertama' : 'Pihak Kedua'})`,
      action: party === 'firstParty' ? 'SIGNED_FIRST_PARTY' : 'SIGNED_SECOND_PARTY',
      summary: `${party === 'firstParty' ? 'Pihak Pertama' : 'Pihak Kedua'} menandatangani dokumen (Mode: PSrE Tersertifikasi).`,
      versionBefore: current.version,
      versionAfter: current.version,
      documentHash: hash,
    })
  );
  saveLocalFallbackContract(current);
  return current;
}

export function loadInvoiceForContract(contract: ContractDocument): InvoiceDocument {
  const fromModules = createInitialInvoiceDocument(contract);
  try {
    const raw = localStorage.getItem(LOCAL_INVOICE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<InvoiceDocument>;
      if (saved.issuerSigned && saved.issuerSignatureImageDataUrl) {
        return {
          ...fromModules,
          issuerSigned: true,
          issuerSignerName: saved.issuerSignerName || fromModules.issuerSignerName,
          issuerSignerTitle: saved.issuerSignerTitle || fromModules.issuerSignerTitle,
          issuerSignedAt: saved.issuerSignedAt || '',
          issuerSignatureImageDataUrl: saved.issuerSignatureImageDataUrl,
        };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return fromModules;
}

export function saveInvoiceLocal(invoice: InvoiceDocument): void {
  try {
    localStorage.setItem(LOCAL_INVOICE_KEY, JSON.stringify(invoice));
  } catch {
    // Ignore quota errors
  }
}
