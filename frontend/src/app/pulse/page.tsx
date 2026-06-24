'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';

function PulseInner() {
  const sp = useSearchParams();
  const bar = sp.get('bar');
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    if (nota == null) { setErro('Escolha uma nota de 0 a 10'); return; }
    setEnviando(true); setErro(null);
    try {
      const r = await fetch('/api/rh/enps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bar_id: Number(bar), nota, comentario }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao enviar');
      setOk(true);
    } catch (e: any) { setErro(e?.message || 'Erro'); }
    finally { setEnviando(false); }
  };

  if (!bar) return <div className="min-h-screen flex items-center justify-center text-gray-500 p-6 text-center">Link inválido.</div>;

  if (ok) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-emerald-50 p-6">
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center max-w-sm">
        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-gray-800">Obrigado! 💚</h1>
        <p className="text-sm text-gray-500 mt-1">Sua resposta é anônima e ajuda a melhorar o nosso ambiente de trabalho.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-emerald-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-6 max-w-md w-full">
        <h1 className="text-lg font-bold text-gray-800">Como está sendo trabalhar aqui?</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">De 0 a 10, o quanto você recomendaria este lugar pra um amigo trabalhar? <b>É anônimo.</b></p>

        <div className="grid grid-cols-11 gap-1 mb-2">
          {Array.from({ length: 11 }, (_, i) => (
            <button key={i} onClick={() => setNota(i)}
              className={`aspect-square rounded-md text-sm font-semibold transition-colors ${nota === i ? 'bg-indigo-600 text-white' : i <= 6 ? 'bg-red-50 text-red-600 hover:bg-red-100' : i <= 8 ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>{i}</button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-4"><span>nada provável</span><span>muito provável</span></div>

        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} placeholder="Quer deixar um comentário? (opcional)" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400" />

        {erro && <p className="text-sm text-red-600 mb-2">{erro}</p>}
        <button onClick={enviar} disabled={enviando} className="w-full rounded-md bg-indigo-600 text-white py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}Enviar resposta
        </button>
      </div>
    </div>
  );
}

export default function PulsePage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>}><PulseInner /></Suspense>;
}
