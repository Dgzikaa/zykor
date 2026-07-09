'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X, ScanLine } from 'lucide-react';
import { decodificarBoleto, type BoletoDecodificado } from '../boletoBarcode';

/**
 * Scanner do código de barras do boleto pela câmera (funciona na webcam do PC e na
 * traseira do celular). Lê o padrão ITF (Interleaved 2 of 5) via ZXing — carregado sob
 * demanda (dynamic import) pra não pesar o bundle. Valida o DV antes de aceitar, então
 * leitura suja é descartada e ele segue tentando.
 */
export function BoletoScanner({
  onDetect, onClose,
}: {
  onDetect: (dados: BoletoDecodificado) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [erro, setErro] = useState('');
  const [status, setStatus] = useState('Abrindo câmera…');

  useEffect(() => {
    let cancelado = false;

    (async () => {
      // Contexto seguro é obrigatório pra câmera (HTTPS ou localhost).
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setErro(!window.isSecureContext
          ? 'A câmera só funciona em HTTPS (ou localhost). Abra o site por https://.'
          : 'Este navegador não suporta acesso à câmera.');
        return;
      }

      // Pede a câmera direto — prompt limpo + erro específico por tipo.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      } catch (e: any) {
        const nome = String(e?.name || '');
        setErro(
          /NotAllowed|Security/i.test(nome)
            ? 'Acesso à câmera bloqueado. Clique no ícone de câmera na barra de endereço do navegador, escolha "Permitir", e tente de novo.'
            : /NotFound|DevicesNotFound|OverconstrainedError/i.test(nome)
              ? 'Nenhuma câmera encontrada neste dispositivo.'
              : /NotReadable|TrackStart/i.test(nome)
                ? 'A câmera está em uso por outro app. Feche o outro programa e tente de novo.'
                : `Não consegui abrir a câmera: ${e?.message || nome || 'erro'}`,
        );
        return;
      }
      if (cancelado) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (cancelado) return;

        const hints = new Map<number, unknown>();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.ITF]);
        const reader = new BrowserMultiFormatReader(hints as any);

        setStatus('Aponte a câmera pro código de barras do boleto');
        const controls = await reader.decodeFromStream(
          stream,
          videoRef.current!,
          (result: any) => {
            if (!result || cancelado) return;
            const texto = String(result.getText?.() ?? result.text ?? '').replace(/\D/g, '');
            if (texto.length !== 44) return; // boleto = 44 dígitos
            const dados = decodificarBoleto(texto);
            if (!dados.valido) return; // DV não bateu → leitura suja, continua
            cancelado = true;
            try { controls.stop(); } catch { /* ok */ }
            onDetect(dados);
          },
        );
        controlsRef.current = controls;
      } catch (e: any) {
        setErro(`Falha ao iniciar a leitura: ${e?.message || e || 'erro'}`);
      }
    })();

    return () => {
      cancelado = true;
      try { controlsRef.current?.stop(); } catch { /* ok */ }
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch { /* ok */ }
    };
  }, [onDetect]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold flex items-center gap-2 text-sm"><ScanLine className="w-4 h-4 text-blue-500" />Escanear boleto</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        {erro ? (
          <div className="p-5 text-center space-y-3">
            <p className="text-sm text-red-600">{erro}</p>
            <Button variant="outline" size="sm" onClick={onClose}>Fechar e preencher manual</Button>
          </div>
        ) : (
          <div className="relative bg-black">
            <video ref={videoRef} className="w-full aspect-[4/3] object-cover" playsInline muted autoPlay />
            {/* Guia visual — enquadre o código de barras nesta faixa */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-[85%] h-16 border-2 border-blue-400/80 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-xs text-center py-1.5 flex items-center justify-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />{status}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
