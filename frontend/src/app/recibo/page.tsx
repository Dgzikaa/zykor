'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Loader2, Printer } from 'lucide-react';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const fmt = (v: any) => `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtData = (d: string | null) => { if (!d) return '—'; try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; } catch { return d; } };

function ReciboInner() {
  const sp = useSearchParams();
  const id = sp.get('id'); const mes = Number(sp.get('mes')) || (new Date().getMonth() + 1); const ano = Number(sp.get('ano')) || new Date().getFullYear();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) { setErro('Funcionário não informado'); setLoading(false); return; }
    try { const r = await api.get(`/api/rh/recibo?id=${id}&mes=${mes}&ano=${ano}`); setD(r); }
    catch (e: any) { setErro(e?.message || 'Erro ao carregar'); }
    finally { setLoading(false); }
  }, [id, mes, ano]);
  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <div className="py-24 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-gray-400" /></div>;
  if (erro || !d?.funcionario) return <div className="py-24 text-center text-red-600">{erro || 'Funcionário não encontrado'}</div>;

  const f = d.funcionario; const folha = d.folha;
  const freela = f.tipo_contratacao === 'Freela';

  const proventos: [string, number][] = [];
  const descontos: [string, number][] = [];
  let liquido = 0;
  if (folha) {
    if (folha.salario_bruto) proventos.push(['Salário bruto', Number(folha.salario_bruto)]);
    if (folha.adicional_noturno) proventos.push(['Adicional noturno', Number(folha.adicional_noturno)]);
    if (folha.adicionais) proventos.push(['Adicionais', Number(folha.adicionais)]);
    if (folha.inss) descontos.push(['INSS', Number(folha.inss)]);
    if (folha.ir) descontos.push(['IRRF', Number(folha.ir)]);
    if (folha.desc_vale_transporte) descontos.push(['Vale transporte', Number(folha.desc_vale_transporte)]);
    if (folha.mensalidade_sindical) descontos.push(['Mensalidade sindical', Number(folha.mensalidade_sindical)]);
    liquido = Number(folha.salario_liquido) || (proventos.reduce((s, p) => s + p[1], 0) - descontos.reduce((s, x) => s + x[1], 0));
  } else {
    const bruto = Number(freela ? f.valor_diaria : f.salario_base) || 0;
    proventos.push([freela ? 'Diária' : 'Salário base', bruto]);
    liquido = bruto;
  }
  const totalProv = proventos.reduce((s, p) => s + p[1], 0);
  const totalDesc = descontos.reduce((s, x) => s + x[1], 0);

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="max-w-[700px] mx-auto">
        <div className="no-print flex justify-end mb-3">
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700"><Printer className="w-4 h-4" />Imprimir / Salvar PDF</button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-8 text-gray-800">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <div>
              <h1 className="text-lg font-bold">Recibo de Pagamento</h1>
              <p className="text-sm text-gray-500">Competência: {MESES[mes]} / {ano}</p>
            </div>
            <div className="text-right text-xs text-gray-400">{folha ? 'Holerite' : 'Recibo'}</div>
          </div>

          <div className="grid grid-cols-2 gap-y-1 gap-x-6 text-sm mb-5">
            <div><span className="text-gray-500">Funcionário:</span> <b>{f.nome}</b></div>
            <div><span className="text-gray-500">CPF:</span> {f.cpf || '—'}</div>
            <div><span className="text-gray-500">Cargo:</span> {f.cargo_nome || '—'}</div>
            <div><span className="text-gray-500">Área:</span> {f.area_nome || '—'}</div>
            <div><span className="text-gray-500">Admissão:</span> {fmtData(f.data_admissao)}</div>
            <div><span className="text-gray-500">Tipo:</span> {f.tipo_contratacao || '—'}</div>
            {folha?.dias_trabalhados != null && <div><span className="text-gray-500">Dias trabalhados:</span> {folha.dias_trabalhados}</div>}
          </div>

          <table className="w-full text-sm mb-4">
            <thead><tr className="border-y text-gray-500 text-xs"><th className="text-left py-1.5">Descrição</th><th className="text-right py-1.5">Proventos</th><th className="text-right py-1.5">Descontos</th></tr></thead>
            <tbody>
              {proventos.map(([l, v]) => <tr key={l} className="border-b border-gray-100"><td className="py-1.5">{l}</td><td className="text-right py-1.5">{fmt(v)}</td><td></td></tr>)}
              {descontos.map(([l, v]) => <tr key={l} className="border-b border-gray-100"><td className="py-1.5">{l}</td><td></td><td className="text-right py-1.5 text-red-600">{fmt(v)}</td></tr>)}
            </tbody>
            <tfoot><tr className="border-t font-semibold"><td className="py-2">Totais</td><td className="text-right py-2">{fmt(totalProv)}</td><td className="text-right py-2 text-red-600">{fmt(totalDesc)}</td></tr></tfoot>
          </table>

          <div className="flex justify-end mb-8">
            <div className="bg-gray-50 rounded-md px-4 py-2 text-right">
              <div className="text-xs text-gray-500">Líquido a receber</div>
              <div className="text-2xl font-bold text-emerald-600">{fmt(liquido)}</div>
            </div>
          </div>

          {f.chave_pix && <p className="text-xs text-gray-500 mb-8">Pagamento via PIX: {f.chave_pix}{f.tipo_chave_pix ? ` (${f.tipo_chave_pix})` : ''}</p>}

          <div className="grid grid-cols-2 gap-8 mt-12 text-center text-xs text-gray-500">
            <div className="border-t pt-1">Assinatura do funcionário</div>
            <div className="border-t pt-1">Assinatura da empresa</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReciboPage() {
  return <Suspense fallback={<div className="py-24 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-gray-400" /></div>}><ReciboInner /></Suspense>;
}
