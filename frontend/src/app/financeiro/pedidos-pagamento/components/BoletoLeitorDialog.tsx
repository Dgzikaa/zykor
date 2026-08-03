'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Barcode, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { decodificarDigitos, type BoletoDecodificado } from '../boletoBarcode';

/**
 * Leitura pelo LEITOR DE CÓDIGO DE BARRAS USB (o "pistolão" do financeiro).
 *
 * O leitor se comporta como um teclado: ao bipar o boleto ele "digita" os dígitos muito
 * rápido no campo focado e normalmente manda um Enter no fim. Então não existe driver nem
 * API — basta um campo focado escutando. O que fazemos aqui:
 *   - foco garantido no input (e refoco se o usuário clicar fora, senão o bipe se perde);
 *   - buffer com debounce de 150ms: só validamos quando a "digitação" para. Sem isso, uma
 *     linha de 47 díg. passaria por 44 no meio do caminho e poderia ser aceita como se fosse
 *     um código de barras (o DV bateria por acaso ~1 em 11 vezes);
 *   - Enter aceita na hora;
 *   - valida o DV antes de aceitar → leitura truncada não vira pedido errado.
 *
 * Aceita os 3 formatos que os leitores entregam: 44 (barras), 47 (linha bancária) e
 * 48 (arrecadação/concessionária).
 */
export function BoletoLeitorDialog({
  onDetect, onClose,
}: {
  onDetect: (dados: BoletoDecodificado) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const digitos = texto.replace(/\D/g, '');
  const completo = digitos.length === 44 || digitos.length === 47 || digitos.length === 48;

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const tentar = (valor: string, automatico: boolean) => {
    const dig = valor.replace(/\D/g, '');
    if (![44, 47, 48].includes(dig.length)) {
      // No modo automático ficamos quietos: ainda pode estar chegando dígito.
      if (!automatico && dig.length > 0) {
        setErro(`Li ${dig.length} dígitos. Um boleto tem 44, 47 ou 48 — bipe de novo.`);
      }
      return;
    }
    const dados = decodificarDigitos(dig);
    if (!dados.valido) {
      setErro('Dígito verificador não confere — a leitura veio incompleta ou trocada. Bipe de novo.');
      return;
    }
    onDetect(dados);
  };

  const onChange = (valor: string) => {
    setTexto(valor);
    setErro('');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => tentar(valor, true), 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <span className="font-semibold flex items-center gap-2 text-sm"><Barcode className="w-4 h-4 text-blue-500" />Bipar com o leitor</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Passe o leitor no código de barras do boleto. Ele preenche o campo abaixo sozinho e os
            dados do boleto entram no formulário.
          </p>

          <div>
            <Input
              ref={inputRef}
              value={texto}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (timerRef.current) clearTimeout(timerRef.current);
                  tentar(texto, false);
                }
              }}
              // O leitor só "digita" no campo focado — se perder o foco, o bipe some.
              onBlur={() => setTimeout(() => inputRef.current?.focus(), 0)}
              placeholder="aguardando o bipe…"
              inputMode="numeric"
              className={`font-mono text-sm ${erro ? 'border-red-400' : completo ? 'border-emerald-400' : ''}`}
            />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className={completo ? 'text-emerald-600' : 'text-muted-foreground'}>
                {completo
                  ? <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{digitos.length} dígitos</span>
                  : `${digitos.length} dígitos (boleto tem 44, 47 ou 48)`}
              </span>
              <span className="text-muted-foreground">dá pra digitar/colar também</span>
            </div>
          </div>

          {erro && (
            <div className="rounded-md bg-red-500/10 text-red-600 p-2.5 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{erro}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => { setTexto(''); setErro(''); inputRef.current?.focus(); }}>Limpar</Button>
            <Button size="sm" onClick={() => { if (timerRef.current) clearTimeout(timerRef.current); tentar(texto, false); }} disabled={!digitos}>Usar este código</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
