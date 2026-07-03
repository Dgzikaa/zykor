'use client';

import { useState } from 'react';
import { X, Loader2, Send, Eye } from 'lucide-react';

export interface ItemPesquisa {
  ordem: number;
  chave: string;
  tipo: 'nota_1_10' | 'texto';
  titulo: string;
  obrigatoria: boolean;
}
export interface PesquisaDef {
  id: number;
  slug?: string;
  titulo: string;
  subtitulo: string | null;
  itens: ItemPesquisa[];
}

export interface RespostaItem {
  item_chave: string;
  nota?: number;
  texto?: string;
}

const NOTAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Cor da nota selecionada (1-4 rosa, 5-7 âmbar, 8-10 esmeralda).
function corNota(n: number): string {
  if (n <= 4) return 'bg-rose-500 text-white border-rose-500';
  if (n <= 7) return 'bg-amber-500 text-white border-amber-500';
  return 'bg-emerald-500 text-white border-emerald-500';
}

/**
 * Modal visual da pesquisa. Presentational + estado próprio das respostas.
 * Usado tanto no disparo real (PesquisaOnboarding) quanto na pré-visualização
 * (Configurações → Pesquisas, com preview=true — nada é salvo).
 */
export function PesquisaModalView({
  pesquisa,
  onEnviar,
  onFechar,
  preview = false,
}: {
  pesquisa: PesquisaDef;
  onEnviar: (respostas: RespostaItem[]) => Promise<void> | void;
  onFechar: () => void;
  preview?: boolean;
}) {
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    const faltando = pesquisa.itens.filter(
      (i) => i.obrigatoria && i.tipo === 'nota_1_10' && notas[i.chave] == null
    );
    if (faltando.length) {
      setErro('Dá pelo menos a nota geral pra gente 🙏');
      return;
    }
    setEnviando(true);
    setErro(null);
    const respostas: RespostaItem[] = pesquisa.itens.map((i) =>
      i.tipo === 'nota_1_10'
        ? { item_chave: i.chave, nota: notas[i.chave] }
        : { item_chave: i.chave, texto: textos[i.chave] }
    );
    try {
      await onEnviar(respostas);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        {preview && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <Eye className="h-3.5 w-3.5" /> Pré-visualização — nada será salvo
          </div>
        )}

        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">{pesquisa.titulo}</h2>
            {pesquisa.subtitulo && (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{pesquisa.subtitulo}</p>
            )}
          </div>
          <button
            onClick={onFechar}
            title={preview ? 'Fechar' : 'Responder depois'}
            className="flex-none rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          {pesquisa.itens.map((item) =>
            item.tipo === 'nota_1_10' ? (
              <div key={item.chave}>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {item.titulo}
                    {item.obrigatoria && <span className="ml-1 text-rose-500">*</span>}
                  </label>
                  {notas[item.chave] != null && (
                    <span className="text-sm font-bold tabular-nums text-neutral-900 dark:text-white">
                      {notas[item.chave]}/10
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {NOTAS.map((n) => {
                    const sel = notas[item.chave] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNotas((prev) => ({ ...prev, [item.chave]: n }))}
                        className={`h-9 rounded-md border text-sm font-semibold tabular-nums transition-colors ${
                          sel
                            ? corNota(n)
                            : 'border-neutral-200 text-neutral-500 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400'
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div key={item.chave}>
                <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-200">
                  {item.titulo}
                </label>
                <textarea
                  value={textos[item.chave] || ''}
                  onChange={(e) => setTextos((prev) => ({ ...prev, [item.chave]: e.target.value.slice(0, 2000) }))}
                  rows={3}
                  placeholder="Fica à vontade pra escrever…"
                  className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-teal-400 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-100"
                />
              </div>
            )
          )}
        </div>

        {erro && <p className="mt-3 text-sm text-rose-500">{erro}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={onFechar}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            {preview ? 'Fechar prévia' : 'Responder depois'}
          </button>
          <button
            onClick={enviar}
            disabled={enviando}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {preview ? 'Simular envio' : 'Enviar feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}
