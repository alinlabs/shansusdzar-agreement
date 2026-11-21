import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ContractDocument } from '../../types/contract';
import type { FirstPartyLocalSignPayload } from '../../services/documentService';
import { formatDateTimeID } from '../../utils/date';
import { SignatureCanvas } from './SignatureCanvas';

interface SignaturePanelProps {
  doc: ContractDocument;
  formId?: string;
  resetNonce?: number;
  onSubmittingChange?: (busy: boolean) => void;
  onSignFirstParty: (payload: FirstPartyLocalSignPayload) => Promise<void>;
  onClearCanvas?: () => void;
}

function getDefaultSignerField(value: string): string {
  if (!value || value.trim().startsWith('..')) return '';
  return value;
}

export const SignaturePanel: React.FC<SignaturePanelProps> = ({
  doc,
  formId = 'contract-signing-form',
  resetNonce = 0,
  onSubmittingChange,
  onSignFirstParty,
  onClearCanvas,
}) => {
  const firstPartyMeta = doc.firstParty;
  const firstPartySig = doc.signatures.firstParty;

  const [canvasDataUrl, setCanvasDataUrl] = useState(
    firstPartySig.signatureImageDataUrl || ''
  );
  const [signerName, setSignerName] = useState(
    firstPartySig.signerName || getDefaultSignerField(firstPartyMeta.directorName)
  );
  const [signerTitle, setSignerTitle] = useState(
    firstPartySig.signerTitle || getDefaultSignerField(firstPartyMeta.directorTitle)
  );
  const [signerEmail, setSignerEmail] = useState(
    firstPartySig.signerEmail || getDefaultSignerField(firstPartyMeta.email)
  );
  const [signerPhone, setSignerPhone] = useState(
    getDefaultSignerField(firstPartyMeta.phone)
  );
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );
  const prevResetNonceRef = useRef(resetNonce);

  useEffect(() => {
    setCanvasDataUrl(doc.signatures.firstParty.signatureImageDataUrl || '');
    setSignerName(
      doc.signatures.firstParty.signerName || getDefaultSignerField(doc.firstParty.directorName)
    );
    setSignerTitle(
      doc.signatures.firstParty.signerTitle || getDefaultSignerField(doc.firstParty.directorTitle)
    );
    setSignerEmail(
      doc.signatures.firstParty.signerEmail || getDefaultSignerField(doc.firstParty.email)
    );
    setSignerPhone(getDefaultSignerField(doc.firstParty.phone));
    setFeedback(null);
  }, [doc.id, doc.firstParty, doc.signatures.firstParty]);

  useEffect(() => {
    if (resetNonce !== prevResetNonceRef.current) {
      prevResetNonceRef.current = resetNonce;
      setCanvasDataUrl('');
      setFeedback(null);
    }
  }, [resetNonce]);

  const handleSubmitSign = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!canvasDataUrl) {
      setFeedback({
        type: 'error',
        text: 'Silakan gambar tanda tangan Pihak Pertama pada kanvas terlebih dahulu.',
      });
      return;
    }
    if (!signerName.trim()) {
      setFeedback({ type: 'error', text: 'Nama penandatangan wajib diisi.' });
      return;
    }
    if (!signerTitle.trim()) {
      setFeedback({ type: 'error', text: 'Jabatan wajib diisi.' });
      return;
    }
    if (!signerEmail.trim()) {
      setFeedback({ type: 'error', text: 'Email wajib diisi.' });
      return;
    }
    if (!signerPhone.trim()) {
      setFeedback({ type: 'error', text: 'Nomor telepon wajib diisi.' });
      return;
    }

    onSubmittingChange?.(true);
    try {
      await onSignFirstParty({
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim(),
        signerEmail: signerEmail.trim(),
        signerPhone: signerPhone.trim(),
        signatureImageDataUrl: canvasDataUrl,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menerapkan tanda tangan lokal.',
      });
    } finally {
      onSubmittingChange?.(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmitSign} className="space-y-3.5">
      {firstPartySig.signed && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          <span>
            Sudah diterapkan secara lokal oleh <strong>{firstPartySig.signerName}</strong> (
            {formatDateTimeID(firstPartySig.signedAt)}). Anda dapat mengubah ulang lalu klik Ubah Tanda Tangan.
          </span>
        </div>
      )}

      {feedback && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs ${
            feedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-700">
            Kanvas Tanda Tangan Pihak Pertama
          </span>
          {canvasDataUrl && onClearCanvas && (
            <button
              type="button"
              onClick={onClearCanvas}
              className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
            >
              Bersihkan
            </button>
          )}
        </div>
        <SignatureCanvas
          value={canvasDataUrl}
          resetNonce={resetNonce}
          label="Gambar Tanda Tangan Pihak Pertama"
          onChange={setCanvasDataUrl}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="sign-name" className="block text-xs font-medium text-slate-700">
            Nama *
          </label>
          <input
            id="sign-name"
            type="text"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Nama lengkap Pihak Pertama"
            className="mt-1 min-h-[42px] sm:min-h-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 sm:py-1.5 text-base sm:text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="sign-title" className="block text-xs font-medium text-slate-700">
            Jabatan *
          </label>
          <input
            id="sign-title"
            type="text"
            value={signerTitle}
            onChange={(e) => setSignerTitle(e.target.value)}
            placeholder="Pemilik Usaha Shansus Dzar Indonesia"
            className="mt-1 min-h-[42px] sm:min-h-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 sm:py-1.5 text-base sm:text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="sign-email" className="block text-xs font-medium text-slate-700">
            Email *
          </label>
          <input
            id="sign-email"
            type="email"
            value={signerEmail}
            onChange={(e) => setSignerEmail(e.target.value)}
            placeholder="shansusdzardigital.id@gmail.com"
            className="mt-1 min-h-[42px] sm:min-h-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 sm:py-1.5 text-base sm:text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="sign-phone" className="block text-xs font-medium text-slate-700">
            Telepon *
          </label>
          <input
            id="sign-phone"
            type="tel"
            value={signerPhone}
            onChange={(e) => setSignerPhone(e.target.value)}
            placeholder="085314205258"
            className="mt-1 min-h-[42px] sm:min-h-0 w-full rounded-md border border-slate-300 bg-white px-3 py-2 sm:py-1.5 text-base sm:text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>
    </form>
  );
};
