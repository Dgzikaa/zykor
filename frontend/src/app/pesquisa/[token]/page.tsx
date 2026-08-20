'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, HeartHandshake } from 'lucide-react';

/**
 * Pesquisas de RH — a tela de quem responde.
 *
 * Aberta por link, sem login, e feita pro celular: é o que o time abre no WhatsApp entre um
 * turno e outro. Sem menu, sem barra lateral, sem nada que peça conta.
 *
 * Três formatos no mesmo endereço, decididos pelo `tipo` que a rodada devolve:
 *  - felicidade        : 5 perguntas, escala de concordância, anônima;
 *  - marca_empregadora : nota 0-10 + sugestão, anônima;
 *  - feedback          : escolhe o próprio nome e responde sim/não (essa NÃO é anônima).
 */

const ESCALA = [
  { valor: 1, curto: 'Discordo\ntotalmente', cor: 'bg-red-500' },
  { valor: 2, curto: 'Discordo', cor: 'bg-orange-400' },
  { valor: 3, curto: 'Mais ou\nmenos', cor: 'bg-yellow-400' },
  { valor: 4, curto: 'Concordo', cor: 'bg-lime-500' },
  { valor: 5, curto: 'Concordo\ntotalmente', cor: 'bg-emerald-500' },
];

const corNota = (n: number) =>
  n <= 6 ? 'bg-red-500' : n <= 8 ? 'bg-yellow-400' : 'bg-emerald-500';

export default function PesquisaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [areaId, setAreaId] = useState('');
  const [comentario, setComentario] = useState('');
  const [nota, setNota] = useState<number | null>(null);
  const [quem, setQuem] = useState('');
  const [buscaNome, setBuscaNome] = useState('');
  const [sim, setSim] = useState<boolean | null>(null);
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

  const tipo: string = dados?.tipo || 'felicidade';
  const perguntas: { dimensao: string; texto: string }[] = dados?.perguntas || [];

  const pessoasFiltradas = useMemo(() => {
    const t = buscaNome.trim().toLowerCase();
    const lista: any[] = dados?.pessoas || [];
    return t ? lista.filter((p) => p.nome.toLowerCase().includes(t)) : lista;
  }, [dados, buscaNome]);

  const faltaAlgo = (() => {
    if (tipo === 'marca_empregadora') return nota == null;
    if (tipo === 'feedback') return !quem || sim == null;
    const semResposta = perguntas.filter((p) => !respostas[p.dimensao]).length;
    if (semResposta) return true;
    return !!dados?.exige_area && !areaId;
  })();

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const corpo = tipo === 'marca_empregadora' ? { nota, comentario }
        : tipo === 'feedback' ? { funcionario_id: Number(quem), sim }
        : { respostas, area_id: areaId ? Number(areaId) : null };
      const r = await fetch(`/api/pesquisa/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Não deu para enviar');
      setPronto(true);
    } catch (e: any) {
      setErro(e.message);
    } finally { setEnviando(false); }
  };

  if (erro && !dados) return <Moldura><p className="text-center text-white/80 py-10">{erro}</p></Moldura>;
  if (!dados) return <Moldura><div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-white/70" /></div></Moldura>;

  if (pronto) {
    return (
      <Moldura>
        <div className="py-14 text-center space-y-3">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-400" />
          <h2 className="text-xl font-bold text-white">Obrigado!</h2>
          <p className="text-white/70 text-sm max-w-xs mx-auto">
            Resposta registrada. É com ela que a gente melhora o dia a dia do {dados.bar}.
          </p>
        </div>
      </Moldura>
    );
  }

  const titulo = tipo === 'marca_empregadora' ? 'Marca Empregadora'
    : tipo === 'feedback' ? 'Feedback do seu líder'
    : 'Pesquisa da Felicidade';
  const subtitulo = tipo === 'feedback'
    ? `${dados.bar} · uma pergunta só. Essa não é anônima — a gente precisa saber de quem é.`
    : tipo === 'marca_empregadora'
      ? `${dados.bar} · uma pergunta e uma sugestão. É 100% anônima.`
      : `${dados.bar} · 5 perguntas, menos de um minuto. É anônima — ninguém vê quem respondeu.`;

  return (
    <Moldura>
      <div className="space-y-4 pb-28">
        <div className="text-center space-y-1 pt-2">
          <HeartHandshake className="w-9 h-9 mx-auto text-white/90" />
          <h1 className="text-lg font-bold text-white">{titulo}</h1>
          <p className="text-white/70 text-[13px]">{subtitulo}</p>
        </div>

        {/* ---------------- FELICIDADE ---------------- */}
        {tipo === 'felicidade' && (
          <>
            {perguntas.map((p, i) => (
              <div key={p.dimensao} className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-3">
                {/* Sem o nome da dimensão: quem responde não precisa saber que aquela é a
                    pergunta de "pertencimento" — e saber muda a resposta. */}
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-white/50">{i + 1} de {perguntas.length}</div>
                  <p className="text-white font-medium leading-snug mt-0.5">{p.texto}</p>
                </div>
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

            {dados.exige_area && (
              <div className="rounded-2xl bg-white/10 backdrop-blur p-4">
                <label className="text-[11px] uppercase tracking-wide text-white/50">Sua área</label>
                <select value={areaId} onChange={(e) => setAreaId(e.target.value)}
                  className="mt-1 w-full h-11 rounded-lg bg-white/10 text-white px-2 text-sm border border-white/20">
                  <option value="" className="text-black">— escolha —</option>
                  {(dados.areas || []).map((a: any) => (
                    <option key={a.id} value={a.id} className="text-black">{a.nome}</option>
                  ))}
                </select>
                <p className="text-[10px] text-white/50 mt-1">
                  Serve só pra somar por setor — continua anônimo.
                </p>
              </div>
            )}
          </>
        )}

        {/* ---------------- MARCA EMPREGADORA ---------------- */}
        {tipo === 'marca_empregadora' && (
          <>
            <div className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-3">
              <p className="text-white font-medium leading-snug">{dados.pergunta}</p>
              {/* 0 a 10 em duas linhas: 11 botões numa linha só ficam finos demais no celular. */}
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 11 }, (_, n) => (
                  <button key={n} type="button" onClick={() => setNota(n)}
                    className={`rounded-xl h-11 text-sm font-semibold transition
                      ${nota === n ? `${corNota(n)} text-white ring-2 ring-white/70`
                                   : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-white/50">
                <span>0 · de jeito nenhum</span><span>10 · com certeza</span>
              </div>
            </div>
            {/* Mesma tipografia da pergunta de cima: as duas SÃO perguntas, e a segunda em
                rótulo miúdo parecia legenda de campo (Rodrigo, 20/08/2026). */}
            <div className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-3">
              <label htmlFor="sugestao" className="block text-white font-medium leading-snug">
                {dados.sugestao}
              </label>
              <textarea id="sugestao" rows={4} value={comentario} onChange={(e) => setComentario(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-lg bg-white/10 text-white px-3 py-2 text-sm border border-white/20 placeholder:text-white/40" />
            </div>
          </>
        )}

        {/* ---------------- FEEDBACK ---------------- */}
        {tipo === 'feedback' && (
          <>
            <div className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-2">
              <label className="text-[11px] uppercase tracking-wide text-white/50">Quem é você?</label>
              <input value={buscaNome} onChange={(e) => setBuscaNome(e.target.value)} placeholder="Digite seu nome"
                className="w-full h-11 rounded-lg bg-white/10 text-white px-3 text-sm border border-white/20 placeholder:text-white/40" />
              <div className="max-h-56 overflow-y-auto space-y-1">
                {pessoasFiltradas.map((p: any) => (
                  <button key={p.id} type="button" onClick={() => setQuem(String(p.id))}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition
                      ${quem === String(p.id) ? 'bg-white text-slate-900 font-semibold' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>
                    {p.nome}
                  </button>
                ))}
                {pessoasFiltradas.length === 0 && (
                  <p className="text-white/50 text-xs px-1 py-2">Nenhum nome com esse texto.</p>
                )}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-3">
              <p className="text-white font-medium leading-snug">{dados.pergunta}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSim(true)}
                  className={`rounded-xl h-12 font-semibold transition ${sim === true ? 'bg-emerald-500 text-white ring-2 ring-white/70' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  Sim, teve
                </button>
                <button type="button" onClick={() => setSim(false)}
                  className={`rounded-xl h-12 font-semibold transition ${sim === false ? 'bg-red-500 text-white ring-2 ring-white/70' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
                  Ainda não
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Barra fixa: no celular o botão no fim da página some atrás do teclado. */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
        <div className="mx-auto max-w-md">
          <button onClick={enviar} disabled={enviando || faltaAlgo}
            className="w-full h-12 rounded-xl bg-white text-slate-900 font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
            {faltaAlgo ? 'Falta responder' : 'Enviar resposta'}
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
