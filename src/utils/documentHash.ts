import type { ContractDocument } from '../types/contract';

/**
 * Extracts canonical contract payload (excluding mutable audit/signature metadata)
 * so document hashing accurately reflects any substantive legal/commercial change.
 */
export function buildCanonicalHashPayload(doc: ContractDocument): string {
  const canonical = {
    agreement: doc.agreement,
    firstParty: doc.firstParty,
    secondParty: doc.secondParty,
    project: doc.project,
    scope: doc.scope,
    financial: doc.financial,
    legalSettings: doc.legalSettings,
    clauses: doc.clauses.map((c) => ({
      id: c.id,
      articleNumber: c.articleNumber,
      title: c.title,
      enabled: c.enabled,
      paragraphs: c.paragraphs.map((p) => ({
        id: p.id,
        text: p.text,
        enabled: p.enabled,
      })),
    })),
  };
  return JSON.stringify(canonical);
}

/**
 * Computes SHA-256 hex digest using Web Crypto (browser) or Node crypto (server/tests).
 */
export async function computeDocumentHash(doc: ContractDocument): Promise<string> {
  const payload = buildCanonicalHashPayload(doc);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const data = new TextEncoder().encode(payload);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  const nodeCrypto = await import('node:crypto');
  return nodeCrypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}
