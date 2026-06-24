'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, CalendarRange, Clock, CheckCircle2, Send } from 'lucide-react';

type Esc = { data: string; turno: string; status: string; hora_inicio: string | null; hora_fim: string | null };
type Sol = { id: string; tipo: string; data_inicio: string; data_fim: string | null; status: string };

const fmtMin = (min: number) => { const neg = min < 0; const a = Math.abs(min); const h = Math.floor(a / 60); const m = a % 60; return `${neg ? '-' : '+'}${h}h${m ? String(m).padStart(2, '0') : ''}`; };
const diaSem = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const STATUS_CLS: Record<string, string> = { pendente: 'bg-amber-100 text-amber-700', aprovado: 'bg-emerald-100 text-emerald-700', recusado: 'bg-red-100 text-red-700' };
const TURNO_CLS: Record<string, string> = { 'Manhã': 'bg-amber-100 text-amber-700', 'Tarde': 'bg-sky-100 text-sky-700', 'Noite': 'bg-indigo-100 text-indigo-700', 'Integral': 'bg-emerald-100 text-emerald-700' };

export default function PortalPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({ tipo: 'folga', data_inicio: '', data_fim: '', motivo: '' });
  const [enviando, setEnviando] = useState(false);
  const [okMsg, setOkMsg] = useState(false);

  const carregar = useCallback(async () => {
    try { const r = await fetch(`/api/portal/${token}`, { cache: 'no-store' }).then((x) => x.json()); if (!r.success) throw new Error(r.error); setD(r); }
    catch (e: any) { setErro(e?.message || 'Erro'); } finally { setLoading(false); }
  }, [token]);
  useEffect(() => { carregar(); }, [carregar]);

  const enviar = async () => {
    if (!form.data_inicio) { setErro('Informe a data'); return; }
    setEnviando(true); setErro(null);
    try {
      const r = await fetch(`/api/portal/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).then((x) => x.json());
      if (!r.success) throw new Error(r.error);
      setOkMsg(true); setForm({ tipo: 'folga', data_inicio: '', data_fim: '', motivo: '' }); carregar();
      setTimeout(() => setOkMsg(false), 3000);
    } catch (e: any) { setErro(e?.message || 'Erro'); } finally { setEnviando(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>;
  if (erro && !d) return <div className="min-h-screen flex items-center justify-center text-red-600 p-6 text-center">{erro}</div>;

  const f = d.funcionario; const saldo = d.banco_horas_min || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white px-5 pt-8 pb-6">
        <div className="max-w-md mx-auto">
          <div className="text-xs text-white/70">Portal do colaborador</div>
          <h1 className="text-2xl font-bold leading-tight">Olá, {f.nome.split(' ')[0]} 👋</h1>
          <p className="text-sm text-white/80">{[f.cargo_nome, f.area_nome].filter(Boolean).join(' · ') || ''}</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-4">
        {/* Banco de horas */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600"><Clock className="w-5 h-5" /><span className="text-sm font-medium">Banco de horas (mês)</span></div>
          <span className={`text-xl font-bold ${saldo > 0 ? 'text-emerald-600' : saldo < 0 ? 'text-red-600' : 'text-gray-500'}`}>{saldo === 0 ? '0h' : fmtMin(saldo)}</span>
        </div>

        {/* Escala */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center gap-2 text-gray-700 mb-3"><CalendarRange className="w-5 h-5" /><span className="text-sm font-semibold">Sua escala (próximos dias)</span></div>
          {d.escala?.length ? (
            <div className="space-y-1.5">
              {d.escala.map((e: Esc, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-gray-600">{diaSem(e.data)}</span>
                  {e.status === 'folga' ? <span className="text-xs rounded px-2 py-0.5 bg-gray-100 text-gray-500">Folga</span>
                    : <span className={`text-xs rounded px-2 py-0.5 ${TURNO_CLS[e.turno] || 'bg-gray-100'}`}>{e.turno}{e.hora_inicio ? ` ${e.hora_inicio.slice(0, 5)}` : ''}</span>}
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-gray-400">Nada escalado pros próximos dias.</div>}
        </div>

        {/* Pedir folga/férias */}
        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">Pedir folga / férias</div>
          {okMsg && <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Pedido enviado! Aguarde aprovação.</div>}
          <div className="space-y-2">
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full h-10 rounded-lg border border-gray-300 px-2 text-sm">
              <option value="folga">Folga</option><option value="ferias">Férias</option><option value="outro">Outro</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[11px] text-gray-500">Início</label><input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} className="w-full h-10 rounded-lg border border-gray-300 px-2 text-sm" /></div>
              <div><label className="text-[11px] text-gray-500">Fim (opcional)</label><input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} className="w-full h-10 rounded-lg border border-gray-300 px-2 text-sm" /></div>
            </div>
            <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Motivo (opcional)" className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm" />
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <button onClick={enviar} disabled={enviando} className="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">{enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Enviar pedido</button>
          </div>
        </div>

        {/* Meus pedidos */}
        {d.solicitacoes?.length > 0 && (
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">Meus pedidos</div>
            <div className="space-y-1.5">
              {d.solicitacoes.map((s: Sol) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-gray-600">{s.tipo} · {s.data_inicio.split('-').reverse().slice(0, 2).join('/')}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 capitalize ${STATUS_CLS[s.status] || 'bg-gray-100'}`}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-[11px] text-gray-400 pt-2">Zykor · seus dados são pessoais e confidenciais</p>
      </div>
    </div>
  );
}
