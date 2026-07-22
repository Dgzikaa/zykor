// Helpers, tipos e constantes compartilhados da tela de Produções.
// Extraído de page.tsx (refactor 11/07/2026) — código movido VERBATIM, sem mudança de comportamento.
import { AlertTriangle } from 'lucide-react';

// ISO de "dia + N" sem fuso (date math em UTC, igual ao restante das telas de planejamento)
export const addDiasIso = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
export const fmtDM = (iso: any) => iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '—';
// segundos -> "1h 23m" / "23m 04s" (preview do tempo decorrido das produções em andamento)
export const fmtCrono = (seg: number) => {
  const s = Math.max(0, Math.round(seg || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
};
// data local (BRT do navegador) de um timestamp — casa 1:1 com a coluna "Data" do histórico
// (que usa toLocaleString). Evita o bug de virada de dia UTC: produção lançada à noite (ex.: 21h)
// fica no dia certo, não "pula" pro dia seguinte por causa do fuso.
export const isoLocal = (iso: any) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Valor em R$ do desvio de RENDIMENTO de uma execução:
// (rendimento real − rendimento esperado) × custo por kg da produção (= custo planejado ÷ rendimento esperado).
// Ex.: rendeu 5,820 vs 5,6375 kg esperado, custo R$113,10/kg → +0,1885 × 113,10 ≈ +R$21,32.
export const desvioRendReais = (e: any): number | null => {
  if (e?.rendimento_real == null || e?.rendimento_esperado == null || e?.custo_planejado == null) return null;
  const resp = Number(e.rendimento_esperado);
  if (!(resp > 0)) return null;
  const custoPorKg = Number(e.custo_planejado) / resp;
  return (Number(e.rendimento_real) - resp) * custoPorKg;
};

// ---------- helpers ----------
export const fmtBRL = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtNum = (v: any, d = 0) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
// peso/volume com unidade amigável (igual às Fichas Técnicas): g→kg, ml→L quando ≥1000
export const fmtPeso = (q: any, u: string | null) => {
  const n = Number(q || 0);
  if (u === 'g' || u === 'kg') { const g = u === 'kg' ? n * 1000 : n; return g >= 1000 ? `${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : `${g.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} g`; }
  if (u === 'ml' || u === 'L') { const ml = u === 'L' ? n * 1000 : n; return ml >= 1000 ? `${(ml / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} L` : `${ml.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ml`; }
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}${u ? ' ' + u : ''}`;
};
// Unidade de ENTRADA do peso mestre/bruto na execução: espelha o que a ficha mostra
// (kg/L quando a quantidade de referência ≥1000), pra a pessoa digitar como pesa na
// balança (1 kg) e não em grama (1000). fator = quanto multiplicar p/ voltar à base (g/ml).
export function entradaPeso(base: string | null, refQtd: number): { unidade: string; fator: number } {
  if (base === 'g') return refQtd >= 1000 ? { unidade: 'kg', fator: 1000 } : { unidade: 'g', fator: 1 };
  if (base === 'ml') return refQtd >= 1000 ? { unidade: 'L', fator: 1000 } : { unidade: 'ml', fator: 1 };
  return { unidade: base || '', fator: 1 };
}
// Rendimento (real/meta) de uma execução em unidade amigável (kg/L), igual ao input da execução:
// os valores são gravados na base (g/ml); aqui divide pelo fator (pela magnitude da meta) só p/ exibir.
export const rendAmigavel = (e: any) => {
  const ent = entradaPeso(e?.producao_unidade || null, Number(e?.rendimento_esperado || 0));
  const conv = (v: any) => v == null ? null : Number(v) / ent.fator;
  return { real: conv(e?.rendimento_real), esp: conv(e?.rendimento_esperado), un: ent.unidade || e?.producao_unidade || '' };
};
// Aviso INLINE de provável erro de unidade (g×kg, ml×L): quando o valor digitado (já em base)
// fica ~25×+ longe do esperado da ficha. Mostra o valor interpretado em unidade amigável + a
// referência da ficha, na hora de digitar — pega o "8.325 kg em vez de 8,3 kg" antes de salvar.
export const FATOR_AVISO_UNID = 25;
export function AvisoUnidade({ valorBase, esperadoBase, base }: { valorBase: number; esperadoBase: number; base: string | null }) {
  if (!(valorBase > 0) || !(esperadoBase > 0)) return null;
  const ratio = valorBase / esperadoBase;
  if (ratio < FATOR_AVISO_UNID && ratio > 1 / FATOR_AVISO_UNID) return null;
  const mult = ratio >= 1 ? `${Math.round(ratio).toLocaleString('pt-BR')}×` : `1/${Math.round(1 / ratio).toLocaleString('pt-BR')}`;
  return (
    <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 flex items-start gap-1 leading-tight">
      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
      <span>= <b>{fmtPeso(valorBase, base)}</b> · ~{mult} a ficha ({fmtPeso(esperadoBase, base)}). Confira g × kg.</span>
    </p>
  );
}
export const fmtPct = (v: any, d = 1) => v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d })}%`;
export const fmtTempo = (seg: any) => {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
};

// device_id estável por navegador/tablet — escopo dos rascunhos de produção no servidor
// (cada tablet só recupera o que ELE MESMO começou; não "adota" produção de outro device).
// Criado 1x e guardado no localStorage. Chamado só no cliente (dentro de effects/useState).
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem('zykor:device_id');
    if (!id) {
      id = (globalThis.crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.round(Math.random() * 1e9)}`);
      localStorage.setItem('zykor:device_id', id);
    }
    return id;
  } catch { return 'no-storage'; }
}
export const fmtData = (iso: any) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

// Seção da produção pelo código da ficha: pd* = Bar (drinks), demais = Cozinha.
// Mesma convenção da contagem (pc = Cozinha, pd = Drinks/Bar).
export type Secao = 'Cozinha' | 'Bar';
export const secaoDeCodigo = (codigo?: string | null): Secao =>
  (codigo || '').toLowerCase().startsWith('pd') ? 'Bar' : 'Cozinha';

// Módulo canônico da página (= getModuleIdForPath('/operacional/producoes')). Editar/excluir
// do histórico respeitam a AÇÃO deste módulo (não mais role admin): quem tem o módulo com
// permissão de editar/excluir consegue; admin sempre passa. Bate 1:1 com o guard da API.
export const MOD_CONTROLE_PRODUCAO = 'producao - cmv_controle_de_producao';
// Permissão granular (fora do menu) que libera "Gerir equipe" — cadastrar/editar/remover
// responsáveis. Aparece na matriz "Acesso por módulo" da tela de Usuários (V/I/E/X).
export const MOD_GERIR_EQUIPE = 'producao - cmv_gerir_equipe';

// Parse decimal tolerante a locale: aceita vírgula OU ponto como separador. Os inputs de peso/
// rendimento/qtd são type="text" (não "number") justamente porque input number rejeita a vírgula
// em SO/navegador com locale en-US (o Gonza só conseguia digitar ponto). Aqui normalizamos.
export const pf = (v: unknown): number => parseFloat(String(v ?? '').replace(',', '.'));

export interface FichaItem {
  id: number;
  componente_tipo: 'insumo' | 'producao';
  insumo_codigo: string | null;
  insumo_id_vmarket: number | null;
  componente_codigo: string | null;
  nome_componente: string | null;
  quantidade: number;
  unidade_exib: string | null;
  preco_un: number | null;
  is_mestre: boolean;
  insumo_fc?: boolean; // insumo tem fator de correção (precisa de peso bruto → líquido)
}

// uma produção em execução (cronômetro próprio) — várias podem rodar em paralelo
export interface ActiveProd {
  localId: string;
  ficha: any;
  itens: FichaItem[];
  loadingItens: boolean;
  responsavelId: number | null;
  pesoBruto: string;
  pesoMestre: string;
  rendimentoReal: string;
  observacao: string;
  qtdReal: Record<number, string>;
  // Cronômetro por ÂNCORA DE RELÓGIO (wall-clock), não acumulador: `segundos` = tempo já "bancado"
  // (dos segmentos pausados); `rodandoDesde` = epoch ms em que o segmento atual começou a rodar
  // (null quando pausado). Tempo exibido = segundos + (rodando ? agora − rodandoDesde : 0).
  // Reconstrói do relógio → reload/deploy/aba em background não perdem nem distorcem o tempo.
  segundos: number;
  rodando: boolean;
  rodandoDesde?: number | null;
  dataProducao?: string; // retroativa: data (YYYY-MM-DD) em que a produção foi feita; vazio = hoje
  iniciadoEm?: number; // epoch ms de quando a produção foi criada (exibido no card "em andamento"). Vai no snapshot/estado → sobrevive reload e aparece no quadro do bar.
  tentouSalvar?: boolean; // já tentou salvar → destaca em vermelho os obrigatórios vazios
  idempotencyKey: string; // 1 por instância → duplo/triplo submit (internet ruim) colide no banco, não duplica
}
