import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ultimoDiaMes = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

/**
 * Importação dos agregados do XML das NFC-e (para separar impostos por CNPJ). O parse do XML é no
 * navegador (lib/financeiro/nfce-xml.ts); aqui recebemos só os agregados por CNPJ e por CNPJ×NCM,
 * resolvemos o cnpj_indice (via financial.nf_cnpj_labels) e gravamos. Re-subir o mês SUBSTITUI.
 *
 *  GET  ?bar_id&ano&mes → o que já foi importado nesse mês (import + resumos)
 *  POST { bar_id, ano, mes, arquivo_nome?, agregado }  → grava (delete+insert por competência)
 *  DELETE ?bar_id&ano&mes → remove a importação do mês
 */

async function labelsPorBar(fin: any, barId: number): Promise<Map<string, { indice: number; label: string }>> {
  const { data } = await fin.from('nf_cnpj_labels').select('cnpj_indice,label,documento').eq('bar_id', barId);
  const m = new Map<string, { indice: number; label: string }>();
  for (const l of (data || [])) {
    const digs = String(l.documento || '').replace(/\D/g, '');
    if (digs) m.set(digs, { indice: l.cnpj_indice, label: l.label });
  }
  return m;
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'ver')) return permissionErrorResponse('Sem permissão');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || Number(user.bar_id);
  const ano = Number(sp.get('ano')); const mes = Number(sp.get('mes'));
  if (!barId || !ano || !mes) return NextResponse.json({ success: false, error: 'bar_id, ano e mes obrigatórios' }, { status: 400 });

  const fin = (sb() as any).schema('financial');
  const { data: imp } = await fin.from('nfce_import').select('*').eq('bar_id', barId).eq('ano', ano).eq('mes', mes).maybeSingle();
  if (!imp) return NextResponse.json({ success: true, importado: false });
  const [{ data: cnpjs }, { data: ncms }] = await Promise.all([
    fin.from('nfce_cnpj_resumo').select('*').eq('import_id', imp.id).order('cnpj_indice'),
    fin.from('nfce_ncm_resumo').select('*').eq('import_id', imp.id).order('valor', { ascending: false }),
  ]);
  return NextResponse.json({ success: true, importado: true, import: imp, por_cnpj: cnpjs || [], por_ncm: ncms || [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'inserir')) return permissionErrorResponse('Sem permissão para importar');

  const body = await request.json().catch(() => ({} as any));
  const barId = Number(body.bar_id) || Number(user.bar_id);
  const ano = Number(body.ano); const mes = Number(body.mes);
  const ag = body.agregado;
  if (!barId || !ano || !mes || !ag) return NextResponse.json({ success: false, error: 'bar_id, ano, mes e agregado obrigatórios' }, { status: 400 });
  if (mes < 1 || mes > 12) return NextResponse.json({ success: false, error: 'mês inválido' }, { status: 400 });
  if (!Array.isArray(ag.por_cnpj) || ag.por_cnpj.length === 0) return NextResponse.json({ success: false, error: 'Nenhuma nota válida no XML' }, { status: 400 });

  const fin = (sb() as any).schema('financial');
  const labels = await labelsPorBar(fin, barId);
  const resolve = (cnpj: string) => labels.get(String(cnpj || '').replace(/\D/g, '')) || null;

  // substitui o mês: apaga import anterior (cascade limpa os resumos)
  await fin.from('nfce_import').delete().eq('bar_id', barId).eq('ano', ano).eq('mes', mes);

  const semCnpj = (ag.por_cnpj || []).filter((c: any) => !resolve(c.cnpj)).reduce((s: number, c: any) => s + Number(c.qtd_notas || 0), 0);
  const { data: imp, error: eImp } = await fin.from('nfce_import').insert({
    bar_id: barId, ano, mes, competencia: ultimoDiaMes(ano, mes),
    arquivo_nome: body.arquivo_nome ? String(body.arquivo_nome).slice(0, 200) : null,
    qtd_notas: Number(ag.qtd_notas || 0), qtd_canceladas: Number(ag.qtd_canceladas || 0), qtd_sem_cnpj: semCnpj,
    valor_total: Number(ag.valor_total || 0), valor_monofasico: Number(ag.valor_monofasico || 0),
    criado_por: user.email || user.nome || 'app',
  }).select('id').single();
  if (eImp) return NextResponse.json({ success: false, error: eImp.message }, { status: 500 });

  const cnpjRows = (ag.por_cnpj || []).map((c: any) => {
    const r = resolve(c.cnpj);
    return {
      import_id: imp.id, bar_id: barId, ano, mes, cnpj: String(c.cnpj || '').replace(/\D/g, ''),
      cnpj_indice: r?.indice ?? null, cnpj_label: r?.label ?? null,
      faturamento: Number(c.faturamento || 0), valor_monofasico: Number(c.valor_monofasico || 0), qtd_notas: Number(c.qtd_notas || 0),
    };
  });
  const ncmRows = (ag.por_ncm || []).map((n: any) => {
    const r = resolve(n.cnpj);
    return {
      import_id: imp.id, bar_id: barId, ano, mes, cnpj_indice: r?.indice ?? null,
      ncm: n.ncm ? String(n.ncm).slice(0, 10) : null, cst_cofins: n.cst_cofins ? String(n.cst_cofins).slice(0, 2) : null,
      monofasico: !!n.monofasico, valor: Number(n.valor || 0), qtd_itens: Number(n.qtd_itens || 0),
    };
  });

  const { error: eC } = await fin.from('nfce_cnpj_resumo').insert(cnpjRows);
  if (eC) { await fin.from('nfce_import').delete().eq('id', imp.id); return NextResponse.json({ success: false, error: eC.message }, { status: 500 }); }
  if (ncmRows.length) {
    // grava NCM em blocos (pode ter dezenas de linhas — barato, mas evita payload gigante)
    for (let i = 0; i < ncmRows.length; i += 500) {
      const { error: eN } = await fin.from('nfce_ncm_resumo').insert(ncmRows.slice(i, i + 500));
      if (eN) { await fin.from('nfce_import').delete().eq('id', imp.id); return NextResponse.json({ success: false, error: eN.message }, { status: 500 }); }
    }
  }

  return NextResponse.json({
    success: true, import_id: imp.id,
    qtd_notas: imp && Number(ag.qtd_notas || 0), qtd_sem_cnpj: semCnpj,
    cnpjs_resolvidos: cnpjRows.filter((r: any) => r.cnpj_indice != null).length,
    cnpjs_nao_resolvidos: cnpjRows.filter((r: any) => r.cnpj_indice == null).map((r: any) => r.cnpj),
  });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.despesas, 'inserir')) return permissionErrorResponse('Sem permissão');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || Number(user.bar_id);
  const ano = Number(sp.get('ano')); const mes = Number(sp.get('mes'));
  if (!barId || !ano || !mes) return NextResponse.json({ success: false, error: 'bar_id, ano e mes obrigatórios' }, { status: 400 });
  const fin = (sb() as any).schema('financial');
  const { error } = await fin.from('nfce_import').delete().eq('bar_id', barId).eq('ano', ano).eq('mes', mes);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
