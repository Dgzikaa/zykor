'use client';

import { use, useEffect, useState } from 'react';
import { Loader2, CheckCircle2, HeartHandshake } from 'lucide-react';

/**
 * Pesquisa da Felicidade — a tela de quem responde.
 *
 * Aberta por link, sem login, e feita pro celular: é o que o time abre no WhatsApp entre um
 * turno e outro. Sem menu, sem barra lateral, sem nada que peça conta.
 *
 * É ANÔNIMA de verdade: a tela não pede nome nem e-mail, e a API não guarda nada que ligue a
 * resposta a uma pessoa. A área é opcional porque o indicador é lido por setor.
 */

const ESCALA = [
  { valor: 1, curto: 'Discordo\ntotalmente', cor: 'bg-red-500' },
  { valor: 2, curto: 'Discordo', cor: 'bg-orange-400' },
  { valor: 3, curto: 'Mais ou\nmenos', cor: 'bg-yellow-400' },
  { valor: 4, curto: 'Concordo', cor: 'bg-lime-500' },
  { valor: 5, curto: 'Concordo\ntotalmente', cor: 'bg-emerald-500' },
];

type Pergunta = { dimensao: string; texto: string; titulo: string };

export default function PesquisaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [areaId, setAreaId] = useState('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    fetch(`/api/pesquisa/${token}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Link inválido');
        setDados(j);
      })
      .catch((e) => setErro(e.message));
  }, [token]);

  const perguntas: Pergunta[] = dados?.perguntas || [];
  const faltam = perguntas.filter((p) => !respostas[p.dimensao]).length;

  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await fetch(`/api/pesquisa/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respostas, comentario, area_id: areaId ? Number(areaId) : null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Não deu para enviar');
      setPronto(true);
    } catch (e: any) {
      setErro(e.message);
    } finally { setEnviando(false); }
  };

  if (erro && !dados) {
    return (
      <Moldura>
        <p className="text-center text-white/80 py-10">{erro}</p>
      </Moldura>
    );
  }
  if (!dados) {
    return (
      <Moldura><div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-white/70" /></div></Moldura>
    );
  }
  if (pronto) {
    return (
      <Moldura>
        <div className="py-14 text-center space-y-3">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Obrigado!</h2>
          <p className="text-white/70 text-sm max-w-xs mx-auto">
            Sua resposta foi registrada de forma anônima. É com ela que a gente melhora o dia a dia
            do {dados.bar}.
          </p>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div className="space-y-4 pb-28">
        <div className="text-center space-y-1 pt-2">
          <HeartHandshake className="w-9 h-9 mx-auto text-white/90" />
          <h1 className="text-lg font-bold text-white">Pesquisa da Felicidade</h1>
          <p className="text-white/70 text-[13px]">
            {dados.bar} · 5 perguntas, menos de um minuto. <b>É anônima</b> — ninguém vê quem respondeu.
          </p>
        </div>

        {perguntas.map((p, i) => (
          <div key={p.dimensao} className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-white/50">{i + 1}/5 · {p.titulo}</div>
              <p className="text-white font-medium leading-snug mt-0.5">{p.texto}</p>
            </div>
            {/* Botões grandes e em linha: quem responde está no celular, muitas vezes em pé. */}
            <div className="grid grid-cols-5 gap-1.5">
              {ESCALA.map((e) => {
                const ativo = respostas[p.dimensao] === e.valor;
                return (
                  <button key={e.valor} type="button"
                    onClick={() => setRespostas((r) => ({ ...r, [p.dimensao]: e.valor }))}
                    className={`rounded-xl py-2.5 px-1 text-[10px] leading-tight whitespace-pre-line transition
                      ${ativo ? `${e.cor} text-white font-semibold ring-2 ring-white/70`
                              : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                    {e.curto}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/50">Sua área (opcional)</label>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)}
              className="mt-1 w-full h-10 rounded-lg bg-white/10 text-white px-2 text-sm border border-white/20">
              <option value="" className="text-black">— prefiro não dizer —</option>
              {(dados.areas || []).map((a: any) => (
                <option key={a.id} value={a.id} className="text-black">{a.nome}</option>
              ))}
            </select>
            <p className="text-[10px] text-white/50 mt-1">Serve só pra somar por setor. Continua anônimo.</p>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-white/50">Quer falar mais alguma coisa?</label>
            <textarea rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)}
              placeholder="Opcional"
              className="mt-1 w-full rounded-lg bg-white/10 text-white px-3 py-2 text-sm border border-white/20 placeholder:text-white/40" />
          </div>
        </div>
      </div>

      {/* Barra fixa: no celular o botão no fim da página some atrás do teclado. */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
        <div className="mx-auto max-w-md">
          <button onClick={enviar} disabled={enviando || faltam > 0}
            className="w-full h-12 rounded-xl bg-white text-slate-900 font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
            {faltam > 0 ? `Falta${faltam > 1 ? 'm' : ''} ${faltam} pergunta${faltam > 1 ? 's' : ''}` : 'Enviar resposta'}
          </button>
          {erro && <p className="text-center text-red-300 text-xs mt-2">{erro}</p>}
        </div>
      </div>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-700 to-fuchsia-700 px-4 py-6">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}
