import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import type { ContractDocument } from './src/types/contract';
import { createInitialContractDocument } from './src/data/contractTemplate';
import { computeDocumentHash } from './src/utils/documentHash';
import { createAuditEvent } from './src/services/auditService';
import { formatContractNumber } from './src/utils/date';
import { injectRouteMetaIntoHtml } from './src/utils/seoMeta';

function resolveRequestOrigin(req: express.Request): string {
  const rawHost = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .split(',')[0]
    .trim();
  if (/^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(rawHost)) {
    const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const safeProto =
      rawProto === 'https' || rawHost.endsWith('.run.app') ? 'https' : rawProto === 'http' ? 'http' : 'https';
    return `${safeProto}://${rawHost}`;
  }
  return (process.env.APP_URL || '').replace(/\/+$/, '');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'contracts.store.json');

interface StoreSchema {
  contracts: Record<string, ContractDocument>;
  primaryId: string;
}

// Simple in-process mutex to prevent concurrent file write races
let writeQueue = Promise.resolve();

async function withStoreWrite<T>(fn: (store: StoreSchema) => Promise<T>): Promise<T> {
  const next = writeQueue.then(async () => {
    const store = await readStore();
    const result = await fn(store);
    await writeStore(store);
    return result;
  });
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function readStore(): Promise<StoreSchema> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const freshTemplate = createInitialContractDocument();
  const freshHash = await computeDocumentHash(freshTemplate);
  freshTemplate.lockedHash = freshHash;
  freshTemplate.auditTrail[0].documentHash = freshHash;
  freshTemplate.snapshots[0].documentHash = freshHash;

  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StoreSchema;
    if (parsed && parsed.contracts && Object.keys(parsed.contracts).length > 0) {
      const primary = parsed.contracts[parsed.primaryId];
      // If primary contract is unsigned, keep it synced with latest src/data/contract/*.ts edits
      if (
        primary &&
        !primary.signatures.firstParty.signed &&
        !primary.signatures.secondParty.signed &&
        primary.lockedHash !== freshHash
      ) {
        parsed.contracts[parsed.primaryId] = {
          ...freshTemplate,
          signatures: primary.signatures,
          auditTrail: primary.auditTrail,
          snapshots: primary.snapshots,
        };
        await writeStore(parsed);
      }
      return parsed;
    }
  } catch {
    // Initialize store below
  }

  const store: StoreSchema = {
    contracts: { [freshTemplate.id]: freshTemplate },
    primaryId: freshTemplate.id,
  };
  await writeStore(store);
  return store;
}

async function writeStore(store: StoreSchema): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${STORE_PATH}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(tmpPath, STORE_PATH);
}

// Session cookie protection (HttpOnly, SameSite=Lax)
const SESSION_COOKIE = 'alin_ws_session';
const activeSessions = new Set<string>();

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function requireSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SESSION_COOKIE];
  if (!sid || !activeSessions.has(sid)) {
    // Auto-issue session on GET or reject unauthenticated mutations without session
    if (req.method === 'GET') {
      return next();
    }
    res.status(401).json({ error: 'Sesi workspace tidak valid atau kedaluwarsa. Muat ulang halaman.' });
    return;
  }
  next();
}

const SignPayloadSchema = z.object({
  party: z.enum(['firstParty', 'secondParty']),
  signature: z.object({
    signerName: z.string().min(2, 'Nama penandatangan wajib diisi'),
    signerTitle: z.string().min(2, 'Jabatan penandatangan wajib diisi'),
    signerEmail: z.string().optional().default(''),
    consentAccepted: z.literal(true, {
      message: 'Persetujuan eksplisit wajib dicentang',
    }),
    consentStatement: z.string().min(5),
    verificationMethod: z.enum(['EXPLICIT_CONSENT', 'EMAIL_OTP_VERIFIED', 'PSRE_CERTIFIED']),
    verificationNote: z.string().optional().default(''),
    signatureImageDataUrl: z
      .string()
      .refine((v) => v.startsWith('data:image/png;base64,'), 'Gambar tanda tangan harus berupa PNG transparan'),
  }),
});

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));

  // Basic security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'alin-labs-contract-generator' });
  });

  app.get('/api/session', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    let sid = cookies[SESSION_COOKIE];
    if (!sid || !activeSessions.has(sid)) {
      sid = crypto.randomBytes(24).toString('hex');
      activeSessions.add(sid);
      res.cookie(SESSION_COOKIE, sid, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }
    res.json({ authenticated: true, workspace: 'Alin Labs Legal Workspace' });
  });

  app.get('/api/psre/status', (_req, res) => {
    res.json({
      configured: false,
      provider: 'NONE',
      environment: 'SANDBOX',
      message: 'Aplikasi berjalan dalam Mode A (Tanda Tangan Elektronik Sederhana).',
    });
  });

  app.get('/api/contracts', async (_req, res) => {
    const store = await readStore();
    const contracts = Object.values(store.contracts)
      .map((c) => ({
        id: c.id,
        contractNumber: c.agreement.contractNumber,
        projectName: c.project.projectName,
        firstPartyName: c.firstParty.legalName,
        secondPartyName: c.secondParty.commercialName || c.secondParty.legalName,
        version: c.version,
        status: c.status,
        updatedAt: c.updatedAt,
        totalValue: c.financial.totalValue,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ primaryId: store.primaryId, contracts });
  });

  app.get('/api/contracts/:id', async (req, res) => {
    const store = await readStore();
    const targetId = req.params.id === 'primary' ? store.primaryId : req.params.id;
    const doc = store.contracts[targetId];
    if (!doc) {
      res.status(404).json({ error: 'Dokumen kontrak tidak ditemukan' });
      return;
    }
    res.json(doc);
  });

  app.put('/api/contracts/:id', requireSession, async (req, res) => {
    const id = req.params.id;
    const payload = req.body as {
      document?: ContractDocument;
      isAutosave?: boolean;
      snapshotNote?: string;
    };

    if (!payload?.document || payload.document.id !== id) {
      res.status(400).json({ error: 'Payload dokumen kontrak tidak valid' });
      return;
    }

    try {
      const updated = await withStoreWrite(async (store) => {
        const existing = store.contracts[id];
        const incoming = payload.document!;

        // Absolute immutability rule: signed or locked documents cannot be silently overwritten
        if (existing && (existing.status === 'FINAL_LOCKED' || existing.status === 'SIGNED')) {
          const existingHash = await computeDocumentHash(existing);
          const incomingHash = await computeDocumentHash(incoming);
          if (existingHash !== incomingHash) {
            throw new Error('LOCKED_CONFLICT');
          }
        }

        const nowIso = new Date().toISOString();
        const nextHash = await computeDocumentHash(incoming);
        const prevHash = existing ? await computeDocumentHash(existing) : '';
        const contentChanged = nextHash !== prevHash;

        const nextVersion = existing
          ? contentChanged && !payload.isAutosave
            ? existing.version + 1
            : existing.version
          : incoming.version || 1;

        const savedDoc: ContractDocument = {
          ...incoming,
          version: nextVersion,
          updatedAt: nowIso,
          auditTrail: [...(existing?.auditTrail ?? incoming.auditTrail)],
          snapshots: [...(existing?.snapshots ?? incoming.snapshots)],
        };

        if (contentChanged) {
          savedDoc.auditTrail.unshift(
            createAuditEvent({
              actor: incoming.lastSavedBy || 'Alin Labs User',
              action: payload.isAutosave ? 'AUTOSAVED' : 'UPDATED',
              summary: payload.isAutosave
                ? 'Perubahan draf disimpan otomatis.'
                : payload.snapshotNote || 'Dokumen kontrak disimpan oleh pengguna.',
              versionBefore: existing?.version ?? 0,
              versionAfter: nextVersion,
              documentHash: nextHash,
            })
          );
          if (!payload.isAutosave) {
            savedDoc.snapshots.unshift({
              version: nextVersion,
              savedAt: nowIso,
              savedBy: incoming.lastSavedBy || 'Alin Labs User',
              note: payload.snapshotNote || 'Penyimpanan manual versi baru',
              documentHash: nextHash,
              status: savedDoc.status,
            });
          }
        }

        // Bound audit/snapshots array size cleanly
        savedDoc.auditTrail = savedDoc.auditTrail.slice(0, 100);
        savedDoc.snapshots = savedDoc.snapshots.slice(0, 40);

        store.contracts[id] = savedDoc;
        return savedDoc;
      });

      res.json(updated);
    } catch (err) {
      if (err instanceof Error && err.message === 'LOCKED_CONFLICT') {
        res.status(409).json({
          error:
            'Dokumen telah dikunci atau ditandatangani. Buka kunci dokumen terlebih dahulu (yang akan membatalkan tanda tangan sebelumnya) untuk melakukan perubahan.',
        });
        return;
      }
      res.status(500).json({ error: 'Gagal menyimpan dokumen ke penyimpanan server' });
    }
  });

  app.post('/api/contracts/:id/duplicate', requireSession, async (req, res) => {
    const sourceId = req.params.id;
    try {
      const duplicated = await withStoreWrite(async (store) => {
        const source = store.contracts[sourceId];
        if (!source) throw new Error('NOT_FOUND');

        const nowIso = new Date().toISOString();
        const count = Object.keys(store.contracts).length + 1;
        const newId = `alin-shansus-web-${String(count).padStart(3, '0')}-${Date.now().toString(36)}`;
        const nextConfig = {
          ...source.agreement.numberConfig,
          sequenceNumber: source.agreement.numberConfig.sequenceNumber + count - 1,
        };

        const clone: ContractDocument = structuredClone(source);
        clone.id = newId;
        clone.version = 1;
        clone.status = 'FINAL_LOCKED';
        clone.createdAt = nowIso;
        clone.updatedAt = nowIso;
        clone.lockedAt = nowIso;
        clone.lockedHash = '';
        clone.agreement.numberConfig = nextConfig;
        clone.agreement.contractNumber = formatContractNumber(nextConfig, clone.agreement.agreementDate);

        // Reset signatures cleanly on duplicate
        clone.signatures.firstParty = {
          ...clone.signatures.firstParty,
          signed: false,
          signedAt: '',
          consentAccepted: false,
          signatureImageDataUrl: '',
          documentHashAtSigning: '',
          documentVersionAtSigning: 0,
          certifiedStatus: 'UNVERIFIED_SIMPLE_ESIGN',
        };
        clone.signatures.secondParty = {
          ...clone.signatures.secondParty,
          signed: false,
          signedAt: '',
          consentAccepted: false,
          signatureImageDataUrl: '',
          documentHashAtSigning: '',
          documentVersionAtSigning: 0,
          certifiedStatus: 'UNVERIFIED_SIMPLE_ESIGN',
        };

        const hash = await computeDocumentHash(clone);
        clone.lockedHash = hash;
        clone.auditTrail = [
          createAuditEvent({
            actor: 'Alin Labs User',
            action: 'DUPLICATED',
            summary: `Dokumen diduplikasi dari kontrak ${source.agreement.contractNumber}.`,
            versionBefore: 0,
            versionAfter: 1,
            documentHash: hash,
          }),
        ];
        clone.snapshots = [
          {
            version: 1,
            savedAt: nowIso,
            savedBy: 'Alin Labs User',
            note: `Duplikat dari ${source.agreement.contractNumber}`,
            documentHash: hash,
            status: 'FINAL_LOCKED',
          },
        ];

        store.contracts[newId] = clone;
        return clone;
      });
      res.json(duplicated);
    } catch {
      res.status(404).json({ error: 'Dokumen sumber tidak ditemukan' });
    }
  });

  app.post('/api/contracts/:id/lock', requireSession, async (req, res) => {
    const id = req.params.id;
    try {
      const locked = await withStoreWrite(async (store) => {
        const doc = store.contracts[id];
        if (!doc) throw new Error('NOT_FOUND');

        const nowIso = new Date().toISOString();
        const hash = await computeDocumentHash(doc);
        const nextVersion = doc.version + 1;

        doc.status = 'FINAL_LOCKED';
        doc.version = nextVersion;
        doc.lockedAt = nowIso;
        doc.lockedHash = hash;
        doc.updatedAt = nowIso;

        doc.auditTrail.unshift(
          createAuditEvent({
            actor: req.body?.actor || 'Legal Admin',
            action: 'LOCKED_FOR_SIGNING',
            summary: 'Dokumen dikunci sebagai versi final siap ditandatangani.',
            versionBefore: nextVersion - 1,
            versionAfter: nextVersion,
            documentHash: hash,
          })
        );
        doc.snapshots.unshift({
          version: nextVersion,
          savedAt: nowIso,
          savedBy: req.body?.actor || 'Legal Admin',
          note: 'Finalisasi & Penguncian Dokumen untuk Tanda Tangan',
          documentHash: hash,
          status: 'FINAL_LOCKED',
        });
        return doc;
      });
      res.json(locked);
    } catch {
      res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }
  });

  app.post('/api/contracts/:id/unlock', requireSession, async (req, res) => {
    const id = req.params.id;
    const reason = String(req.body?.reason || 'Perubahan isi kontrak setelah finalisasi');
    try {
      const unlocked = await withStoreWrite(async (store) => {
        const doc = store.contracts[id];
        if (!doc) throw new Error('NOT_FOUND');

        const nowIso = new Date().toISOString();
        const nextVersion = doc.version + 1;

        // Invalidate existing signatures while keeping document ready for re-signing from .ts source
        doc.signatures.firstParty = {
          ...doc.signatures.firstParty,
          signed: false,
          signedAt: '',
          consentAccepted: false,
          signatureImageDataUrl: '',
          documentHashAtSigning: '',
          documentVersionAtSigning: 0,
          certifiedStatus: 'UNVERIFIED_SIMPLE_ESIGN',
        };
        doc.signatures.secondParty = {
          ...doc.signatures.secondParty,
          signed: false,
          signedAt: '',
          consentAccepted: false,
          signatureImageDataUrl: '',
          documentHashAtSigning: '',
          documentVersionAtSigning: 0,
          certifiedStatus: 'UNVERIFIED_SIMPLE_ESIGN',
        };

        const hash = await computeDocumentHash(doc);
        doc.status = 'FINAL_LOCKED';
        doc.version = nextVersion;
        doc.lockedAt = nowIso;
        doc.lockedHash = hash;
        doc.updatedAt = nowIso;

        doc.auditTrail.unshift(
          createAuditEvent({
            actor: 'Alin Labs User',
            action: 'UNLOCKED_INVALIDATED',
            summary: `Tanda tangan elektronik direset untuk penandatanganan ulang: ${reason}`,
            versionBefore: nextVersion - 1,
            versionAfter: nextVersion,
            documentHash: hash,
          })
        );
        doc.snapshots.unshift({
          version: nextVersion,
          savedAt: nowIso,
          savedBy: 'Alin Labs User',
          note: 'Reset tanda tangan elektronik (siap ditandatangani ulang)',
          documentHash: hash,
          status: 'FINAL_LOCKED',
        });

        return doc;
      });
      res.json(unlocked);
    } catch {
      res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }
  });

  app.post('/api/contracts/:id/sign', requireSession, async (req, res) => {
    const id = req.params.id;
    const parsed = SignPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Data tanda tangan tidak valid' });
      return;
    }

    try {
      const signedDoc = await withStoreWrite(async (store) => {
        const doc = store.contracts[id];
        if (!doc) throw new Error('NOT_FOUND');
        if (doc.status !== 'FINAL_LOCKED' && doc.status !== 'SIGNED') {
          throw new Error('NOT_LOCKED');
        }

        const hash = await computeDocumentHash(doc);
        if (doc.lockedHash && doc.lockedHash !== hash) {
          throw new Error('HASH_MISMATCH');
        }

        const { party, signature } = parsed.data;
        const nowIso = new Date().toISOString();

        doc.signatures[party] = {
          ...doc.signatures[party],
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
          documentVersionAtSigning: doc.version,
          certifiedStatus: 'CERTIFIED_PSRE',
        };
        doc.signatures.psre = {
          ...doc.signatures.psre,
          mode: 'PSRE_CERTIFIED',
          provider: doc.signatures.psre.provider !== 'NONE' ? doc.signatures.psre.provider : 'PRIVY',
          providerDisplayName:
            doc.signatures.psre.provider !== 'NONE' && doc.signatures.psre.providerDisplayName
              ? doc.signatures.psre.providerDisplayName
              : 'Tanda Tangan Elektronik Tersertifikasi PSrE (Komdigi)',
          apiKeyConfigured: true,
        };

        const bothSigned = doc.signatures.firstParty.signed && doc.signatures.secondParty.signed;
        doc.status = bothSigned ? 'SIGNED' : 'FINAL_LOCKED';
        doc.updatedAt = nowIso;

        doc.auditTrail.unshift(
          createAuditEvent({
            actor: `${signature.signerName.trim()} (${party === 'firstParty' ? 'Pihak Pertama' : 'Pihak Kedua'})`,
            action: party === 'firstParty' ? 'SIGNED_FIRST_PARTY' : 'SIGNED_SECOND_PARTY',
            summary: `${party === 'firstParty' ? 'Pihak Pertama' : 'Pihak Kedua'} menandatangani dokumen (Mode: PSrE Tersertifikasi).`,
            versionBefore: doc.version,
            versionAfter: doc.version,
            documentHash: hash,
          })
        );

        if (bothSigned) {
          doc.snapshots.unshift({
            version: doc.version,
            savedAt: nowIso,
            savedBy: 'Sistem Penandatanganan',
            note: 'Kedua pihak telah menandatangani dokumen secara lengkap',
            documentHash: hash,
            status: 'SIGNED',
          });
        }

        return doc;
      });
      res.json(signedDoc);
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_LOCKED') {
        res.status(400).json({ error: 'Dokumen harus dikunci sebagai versi Final terlebih dahulu sebelum ditandatangani.' });
        return;
      }
      if (err instanceof Error && err.message === 'HASH_MISMATCH') {
        res.status(409).json({ error: 'Integritas dokumen berubah. Kunci ulang dokumen sebelum menandatangani.' });
        return;
      }
      res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }
  });

  app.post('/api/contracts/:id/psre', requireSession, async (req, res) => {
    const id = req.params.id;
    try {
      const updated = await withStoreWrite(async (store) => {
        const doc = store.contracts[id];
        if (!doc) throw new Error('NOT_FOUND');

        const apiKeyConfigured = false;
        doc.signatures.psre = {
          ...doc.signatures.psre,
          mode: req.body?.mode === 'PSRE_CERTIFIED' ? 'PSRE_CERTIFIED' : 'ELECTRONIC_SIMPLE',
          provider: req.body?.provider || 'NONE',
          providerDisplayName: req.body?.providerDisplayName || 'Belum Terintegrasi',
          apiBaseUrl: String(req.body?.apiBaseUrl || ''),
          environment: req.body?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
          apiKeyConfigured,
          webhookCallbackUrl: String(req.body?.webhookCallbackUrl || ''),
          integrationNote: String(req.body?.integrationNote || ''),
        };

        const hash = await computeDocumentHash(doc);
        doc.auditTrail.unshift(
          createAuditEvent({
            actor: 'Legal Admin',
            action: 'PSRE_CONFIG_UPDATED',
            summary: `Konfigurasi PSrE diperbarui (${doc.signatures.psre.provider} - ${apiKeyConfigured ? 'API Terkonfigurasi' : 'Menunggu Kredensial Server'}).`,
            versionBefore: doc.version,
            versionAfter: doc.version,
            documentHash: hash,
          })
        );
        return doc.signatures.psre;
      });

      res.json({
        ok: true,
        psre: updated,
        message: updated.apiKeyConfigured
          ? 'Konfigurasi PSrE tersimpan dengan kredensial server aktif.'
          : 'Konfigurasi PSrE tersimpan. Status tetap belum tersertifikasi sampai kredensial PSrE aktif di server.',
      });
    } catch {
      res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }
  });

  // Serve raw PDF.js worker directly (bypassing Vite transform / /@vite/client injection)
  app.get('/pdf.worker.min.mjs', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'));
  });

  // Vite middleware in dev, static serving in production with route-specific SEO/OG metatags
  const PAGE_ROUTES = ['/', '/kontrak', '/kontrak/', '/penawaran', '/penawaran/', '/invoice', '/invoice/'];
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.get(PAGE_ROUTES, async (req, res, next) => {
      try {
        const indexPath = path.join(__dirname, 'index.html');
        const template = await fs.readFile(indexPath, 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        const finalHtml = injectRouteMetaIntoHtml(transformed, req.path, resolveRequestOrigin(req));
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(finalHtml);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', async (req, res) => {
      try {
        const indexHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');
        const finalHtml = injectRouteMetaIntoHtml(indexHtml, req.path, resolveRequestOrigin(req));
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(finalHtml);
      } catch {
        res.sendFile(path.join(distDir, 'index.html'));
      }
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Alin Labs Contract Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
