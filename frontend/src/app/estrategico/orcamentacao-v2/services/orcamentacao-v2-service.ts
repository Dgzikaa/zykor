import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OrcamentoMapItem,
  OrcamentoMes,
  OrcamentoLinhaResultado,
  OrcamentoBlocoResultado,
  LancamentoOrfao,
} from '../types';

const STATUS_PAGO = ['PAGO', 'LIQUIDADO', 'PAGO_PARCIAL'];

interface ContaAzulLancamento {
  contaazul_id: string;
  bar_id: number;
  tipo: string;
  status: string;
  data_competencia: string;
  data_pagamento: string | null;
  valor_bruto: number | string;
  valor_pago: number | string | null;
  categoria_nome: string | null;
  descricao: string | null;
  excluido_em: string | null;
}

interface BpLinhaRow {
  bloco: string;
  linha: string;
  valor_mensal: number | string | null;
  percentual_receita: number | string | null;
}

interface EventoBaseRow {
  data_evento: string;
  real_r: number | string | null;
}

const normalize = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export async function getOrcamentacaoMes(
  supabase: SupabaseClient,
  barId: number,
  ano: number,
  mes: number,
  versaoBp: string = 'Mai26'
): Promise<OrcamentoMes> {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fimDate = new Date(ano, mes, 0); // último dia do mês
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(fimDate.getDate()).padStart(2, '0')}`;

  const [mapResult, bpResult, lancResult, eventosResult] = await Promise.all([
    supabase
      .from('orcamento_subcategoria_map')
      .select('*')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    supabase
      .from('bp_linha')
      .select('bloco, linha, valor_mensal, percentual_receita')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('versao', versaoBp)
      .eq('ativo', true),
    supabase
      .from('bronze_contaazul_lancamentos')
      .select('contaazul_id, bar_id, tipo, status, data_competencia, data_pagamento, valor_bruto, valor_pago, categoria_nome, descricao, excluido_em')
      .eq('bar_id', barId)
      .gte('data_competencia', inicio)
      .lte('data_competencia', fim)
      .is('excluido_em', null),
    supabase
      .from('eventos_base')
      .select('data_evento, real_r')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .gte('data_evento', inicio)
      .lte('data_evento', fim),
  ]);

  const mapeamento = (mapResult.data || []) as OrcamentoMapItem[];
  const bpLinhas = (bpResult.data || []) as BpLinhaRow[];
  const lancamentos = (lancResult.data || []) as ContaAzulLancamento[];
  const eventos = (eventosResult.data || []) as EventoBaseRow[];

  const bpMap = new Map<string, { valor: number; pct: number | null }>();
  bpLinhas.forEach(b => {
    bpMap.set(`${b.bloco}|${b.linha}`, {
      valor: Number(b.valor_mensal || 0),
      pct: b.percentual_receita !== null ? Number(b.percentual_receita) : null,
    });
  });

  const receitaEventos = eventos.reduce((acc, e) => acc + Number(e.real_r || 0), 0);

  // Indexar lançamentos por categoria normalizada
  const lancPorCategoria = new Map<string, ContaAzulLancamento[]>();
  lancamentos.forEach(l => {
    const cat = normalize(l.categoria_nome || 'sem_categoria');
    const arr = lancPorCategoria.get(cat) || [];
    arr.push(l);
    lancPorCategoria.set(cat, arr);
  });

  const blocoOrdem = [
    'Receitas',
    'Despesas Variaveis',
    'CMV',
    'Mao-de-Obra',
    'Despesas Comerciais',
    'Despesas Administrativas',
    'Despesas Operacionais',
    'Despesas Ocupacao',
    'Contratos',
  ];

  const categoriasUsadas = new Set<string>();

  const blocos: OrcamentoBlocoResultado[] = [];

  for (const bloco of blocoOrdem) {
    const linhasBloco = mapeamento.filter(m => m.bloco === bloco);
    if (linhasBloco.length === 0) continue;

    const linhasResultado: OrcamentoLinhaResultado[] = [];

    for (const map of linhasBloco) {
      const bp = bpMap.get(`${map.bloco}|${map.linha}`);
      const bpValor = bp?.valor ?? 0;
      const bpPct = bp?.pct ?? null;

      let realizado = 0;
      let projetado = 0;
      let lancCount = 0;

      // Caso especial: receita Bar -> vem de eventos_base
      if (map.bloco === 'Receitas' && map.linha === 'Faturamento Bar') {
        realizado = receitaEventos;
        projetado = 0;
      } else {
        for (const catRef of map.contaazul_categorias) {
          const lancsCat = lancPorCategoria.get(normalize(catRef)) || [];
          for (const l of lancsCat) {
            categoriasUsadas.add(normalize(l.categoria_nome || ''));
            const valor = Math.abs(Number(l.valor_bruto || 0));
            lancCount++;
            const sign = map.tipo === 'receita' || map.tipo === 'contrato' ? 1 : -1;
            if (STATUS_PAGO.includes(l.status)) {
              realizado += sign * valor;
            } else {
              projetado += sign * valor;
            }
          }
        }
      }

      const variacaoAbs = realizado - bpValor;
      const variacaoPct = bpValor !== 0 ? (variacaoAbs / Math.abs(bpValor)) * 100 : 0;

      linhasResultado.push({
        bloco: map.bloco,
        linha: map.linha,
        ordem: map.ordem,
        tipo: map.tipo,
        eh_percentual: map.eh_percentual,
        bp_valor: bpValor,
        bp_percentual: bpPct,
        realizado,
        projetado,
        variacao_abs: variacaoAbs,
        variacao_pct: variacaoPct,
        lancamentos_count: lancCount,
        observacao: map.observacao,
        contaazul_categorias: map.contaazul_categorias,
      });
    }

    linhasResultado.sort((a, b) => a.ordem - b.ordem);

    const subtotal_bp = linhasResultado.reduce((s, l) => s + (l.bp_valor || 0), 0);
    const subtotal_realizado = linhasResultado.reduce((s, l) => s + l.realizado, 0);
    const subtotal_projetado = linhasResultado.reduce((s, l) => s + l.projetado, 0);

    blocos.push({ bloco, linhas: linhasResultado, subtotal_bp, subtotal_realizado, subtotal_projetado });
  }

  // Calcular totais
  const receita_bp = blocos.find(b => b.bloco === 'Receitas')?.subtotal_bp || 0;
  const receita_realizado = blocos.find(b => b.bloco === 'Receitas')?.subtotal_realizado || 0;
  const receita_projetado = blocos.find(b => b.bloco === 'Receitas')?.subtotal_projetado || 0;

  const despesa_bp = blocos.filter(b => b.bloco !== 'Receitas').reduce((s, b) => s + b.subtotal_bp, 0);
  const despesa_realizado = blocos.filter(b => b.bloco !== 'Receitas').reduce((s, b) => s + b.subtotal_realizado, 0);
  const despesa_projetado = blocos.filter(b => b.bloco !== 'Receitas').reduce((s, b) => s + b.subtotal_projetado, 0);

  const ebitda_bp = receita_bp + despesa_bp; // despesas já vêm negativas
  const ebitda_realizado = receita_realizado + despesa_realizado;
  const ebitda_projetado = receita_projetado + despesa_projetado;

  const margem_bp = receita_bp > 0 ? (ebitda_bp / receita_bp) * 100 : 0;
  const margem_realizado = receita_realizado > 0 ? (ebitda_realizado / receita_realizado) * 100 : 0;
  const margem_projetado = receita_projetado > 0 ? (ebitda_projetado / receita_projetado) * 100 : 0;

  // Categorias órfãs: lançamentos cuja categoria não bateu com nenhum mapping
  const orfaosMap = new Map<string, { count: number; valor: number; exemplos: { descricao: string; valor: number; data: string }[] }>();
  for (const [cat, lancs] of lancPorCategoria.entries()) {
    if (categoriasUsadas.has(cat)) continue;
    const orig = lancs[0]?.categoria_nome || cat;
    const valor = lancs.reduce((s, l) => s + Math.abs(Number(l.valor_bruto || 0)), 0);
    const exemplos = lancs.slice(0, 3).map(l => ({
      descricao: (l.descricao || '').substring(0, 60),
      valor: Math.abs(Number(l.valor_bruto || 0)),
      data: l.data_competencia,
    }));
    orfaosMap.set(orig, { count: lancs.length, valor, exemplos });
  }
  const orfaos: LancamentoOrfao[] = Array.from(orfaosMap.entries())
    .map(([categoria_nome, info]) => ({
      categoria_nome,
      count: info.count,
      valor_total: info.valor,
      exemplos: info.exemplos,
    }))
    .sort((a, b) => b.valor_total - a.valor_total);

  const now = new Date();
  const isAtual = now.getFullYear() === ano && now.getMonth() + 1 === mes;
  const isFuturo = ano > now.getFullYear() || (ano === now.getFullYear() && mes > now.getMonth() + 1);
  const label = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

  return {
    ano,
    mes,
    label,
    is_atual: isAtual,
    is_futuro: isFuturo,
    blocos,
    totais: {
      receita_bp,
      receita_realizado,
      receita_projetado,
      despesa_bp,
      despesa_realizado,
      despesa_projetado,
      ebitda_bp,
      ebitda_realizado,
      ebitda_projetado,
      margem_bp,
      margem_realizado,
      margem_projetado,
    },
    orfaos,
  };
}

export async function getOrcamentacaoPeriodo(
  supabase: SupabaseClient,
  barId: number,
  anoInicio: number,
  mesInicio: number,
  numMeses: number,
  versaoBp: string = 'Mai26'
): Promise<OrcamentoMes[]> {
  const promises: Promise<OrcamentoMes>[] = [];
  for (let i = 0; i < numMeses; i++) {
    const d = new Date(anoInicio, mesInicio - 1 + i, 1);
    promises.push(getOrcamentacaoMes(supabase, barId, d.getFullYear(), d.getMonth() + 1, versaoBp));
  }
  return Promise.all(promises);
}
