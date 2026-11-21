import React, { useEffect, useRef, useState } from 'react';

interface SignatureCanvasProps {
  value: string;
  disabled?: boolean;
  label: string;
  resetNonce?: number;
  onChange: (dataUrl: string) => void;
}

const CANVAS_LOGICAL_WIDTH = 646;
const CANVAS_LOGICAL_HEIGHT = 386;

export const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  value,
  disabled = false,
  label,
  resetNonce = 0,
  onChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastExportedRef = useRef<string>('');
  const lastResetNonceRef = useRef<number>(resetNonce);
  const [hasInk, setHasInk] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const isExplicitReset = resetNonce !== lastResetNonceRef.current;
    lastResetNonceRef.current = resetNonce;

    if (!isExplicitReset && value && value === lastExportedRef.current) {
      return;
    }

    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const widthCss = CANVAS_LOGICAL_WIDTH;
    const heightCss = CANVAS_LOGICAL_HEIGHT;
    canvas.width = widthCss * dpr;
    canvas.height = heightCss * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, widthCss, heightCss);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Black/deep-ink professional pen color

    if (value && !isExplicitReset) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, widthCss, heightCss);
        const pad = 16;
        const maxW = widthCss - pad * 2;
        const maxH = heightCss - pad * 2;
        const imgW = img.naturalWidth || widthCss;
        const imgH = img.naturalHeight || heightCss;
        const ratio = Math.min(maxW / imgW, maxH / imgH);
        const drawW = imgW * ratio;
        const drawH = imgH * ratio;
        const drawX = (widthCss - drawW) / 2;
        const drawY = (heightCss - drawH) / 2;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        hasStrokeRef.current = true;
        setHasInk(true);
      };
      img.src = value;
    } else {
      lastExportedRef.current = '';
      hasStrokeRef.current = false;
      setHasInk(false);
    }
  }, [value, resetNonce]);

  const getLocalPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_LOGICAL_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_LOGICAL_HEIGHT,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getLocalPoint(e);
    isDrawingRef.current = true;
    hasStrokeRef.current = true;
    lastPointRef.current = pt;

    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    ctx.lineWidth = Math.max(2.6, Math.min(5.2, 2.8 + pressure * 2.1));
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(pt.x + 0.1, pt.y + 0.1);
    ctx.stroke();
    setHasInk(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !lastPointRef.current) return;

    const pt = getLocalPoint(e);
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    ctx.lineWidth = Math.max(2.6, Math.min(5.2, 2.8 + pressure * 2.1));
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPointRef.current = pt;
  };

  const exportTrimmedPngDataUrl = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');

    const { width, height } = canvas;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      const rowOffset = y * width * 4;
      for (let x = 0; x < width; x += 1) {
        if (data[rowOffset + x * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      return canvas.toDataURL('image/png');
    }

    const pad = 8;
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
    const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = sw;
    outCanvas.height = sh;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return canvas.toDataURL('image/png');

    outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return outCanvas.toDataURL('image/png');
  };

  const finishStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokeRef.current) return;
    // Export strictly transparent trimmed PNG matching AlinLabs aspect ratio & clarity
    const url = exportTrimmedPngDataUrl(canvas);
    lastExportedRef.current = url;
    onChange(url);
  };

  return (
    <div className="relative w-full aspect-[646/386] overflow-hidden rounded-lg border border-dashed border-slate-300 bg-white">
      <canvas
        ref={canvasRef}
        aria-label={label}
        data-testid={`signature-canvas-${label.toLowerCase().replace(/\s+/g, '-')}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        className={`h-full w-full touch-none ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(#e2e8f0 0.8px, transparent 0.8px)',
          backgroundSize: '14px 14px',
        }}
      />
      {!hasInk && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-slate-400">
          Gambar tanda tangan dengan mouse, sentuhan, atau stylus di sini
        </div>
      )}
    </div>
  );
};
