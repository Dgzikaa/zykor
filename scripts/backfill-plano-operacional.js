/**
 * Backfill do "Plano Operacional Semanal - Ordinário" -> operations.operacao_dia (+ _funcao)
 *
 * Companheiro de scripts/backfill-escala-ordi.js. Mesma decisão (Rodrigo, 12/08/2026): o
 * Zykor vira a fonte, a planilha é aposentada, setembro já é desenhado no sistema.
 *
 * O LAYOUT MUDOU AO LONGO DE 2026 — por isso nada aqui é por número de linha fixo:
 *   - JANEIRO não tem "Headcount Ops" (Segurança sobe de 21 para 20)
 *   - "Custo Proj do Dia" só existe de MAIO em diante
 *   - a linha 5 é "Couvert" até ABRIL e vira "Entrada" em MAIO
 *   - JAN–ABR têm 3 colunas por dia (TOTAL|FIXOS|FREELAS); MAI–AGO têm 4 (+Custo)
 *   - os blocos de dia NÃO têm passo fixo: há "RESUMO SEMANAL" intercalado
 * Então: as linhas são localizadas por RÓTULO na coluna A, e cada bloco de dia é
 * detectado por uma data na linha 2 + dia da semana na linha 3.
 *
 * DUAS CORREÇÕES aplicadas de propósito (a planilha erra, o Zykor não repete):
 *   1. "SÁBADO - NOITE" vem datado com o DOMINGO. Aqui a data é corrigida pro sábado.
 *   2. O público da planilha sai de um ticket travado no de SEGUNDA. O valor histórico é
 *      importado como estava (é o que eles planejaram de fato), mas o recálculo daqui pra
 *      frente usa o ticket do dia certo — ver a migração do schema.
 *
 * FIXOS: a coluna FIXOS da planilha era digitada à mão e divergia da escala em quase toda
 * função (só garçom batia). A decisão foi "a escala manda", então o fixo NÃO vem daqui —
 * `fixos_escala` é contado de operations.escala_dia. Só o TOTAL planejado vem da planilha.
 *
 * USO: node scripts/backfill-plano-operacional.js <json-do-download> [--sql <arquivo>]
 */

const fs = require('fs');
const XLSX = require('C:/Projects/zykor/frontend/node_modules/xlsx');

const BAR_ID = 3;
const ABAS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO 2026', 'AGOSTO 2026'];

/** Rótulo da linha (coluna A) -> código da função. Aceita as variações do ano. */
const FUNCOES = {
  'garçom': 'garcom', 'garcom': 'garcom',
  'cumim': 'cumim',
  'host': 'host',
  'asg': 'asg',
  'bartender': 'bartender',
  'barback': 'barback', 'barback/boquetas': 'barback',
  'cozinha': 'cozinha', 'cozinha operação': 'cozinha',
  'segurança': 'seguranca', 'seguranca': 'seguranca',
  'brigadista': 'brigadista',
};

/** Rótulo -> coluna de contexto em operacao_dia. */
const CONTEXTO = {
  'programação musical': 'programacao_musical',
  'programação esportiva': 'programacao_esportiva',
  'couvert': 'entrada', 'entrada': 'entrada',
  'promoção do dia': 'promocao',
  'plano de chão': 'plano_chao',
  'briefing': 'pilula_treinamento', 'pílula de treinamento': 'pilula_treinamento',
  'observações': 'observacoes',
};

const norm = (s) => String(s || '').trim().toLowerCase();
const cel = (ws, col, lin) => ws[XLSX.utils.encode_col(col) + lin];
const txt = (c) => (c ? String(c.w ?? c.v).trim() : '');
const num = (c) => {
  if (!c) return null;
  if (typeof c.v === 'number') return c.v;
  const n = Number(String(c.w ?? c.v).replace(/[R$\s.]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Data da célula (serial do Excel ou texto dd/mm[/aaaa]). Ano default = 2026. */
function paraData(c, anoPadrao = 2026) {
  if (!c) return null;
  if (typeof c.v === 'number') {
    const d = XLSX.SSF.parse_date_code(c.v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(String(c.w ?? c.v).trim());
  if (!m) return null;
  let ano = m[3] ? Number(m[3]) : anoPadrao;
  if (ano < 100) ano += 2000;
  return new Date(Date.UTC(ano, Number(m[2]) - 1, Number(m[1])));
}

const iso = (d) => d.toISOString().slice(0, 10);

function extrairAba(wb, nome) {
  const ws = wb.Sheets[nome];
  if (!ws) return { dias: [], aviso: `aba ${nome} não existe` };
  const R = XLSX.utils.decode_range(ws['!ref']);

  // 1) mapa rótulo -> linha (coluna A)
  const linhaDe = {};
  for (let r = 1; r <= 40; r++) {
    const c = ws['A' + r];
    if (c) linhaDe[norm(c.v)] = r;
  }

  // 2) tem coluna de Custo? (só de MAIO em diante) — define a largura do bloco
  let temCusto = false;
  for (let c = 2; c <= Math.min(R.e.c, 60); c++) {
    if (norm(txt(cel(ws, c, 12))) === 'custo') { temCusto = true; break; }
  }

  // 3) cada coluna com data na linha 2 + dia da semana na linha 3 inicia um bloco de dia
  const dias = [];
  for (let c = 2; c <= R.e.c; c++) {
    const data = paraData(cel(ws, c, 2));
    const diaSemana = txt(cel(ws, c, 3));
    if (!data || !diaSemana) continue;
    if (norm(txt(cel(ws, c, 12))) !== 'total') continue; // bloco de verdade tem header TOTAL

    // Turno pelo rótulo. CUIDADO: só o PRIMEIRO sábado do mês costuma vir rotulado
    // "SÁBADO - NOITE"; nas demais semanas o segundo bloco vem escrito só "SÁBADO".
    // Por isso o rótulo aqui é só uma dica — a desambiguação final é por POSIÇÃO,
    // depois do loop (2 blocos na mesma data => 1º = dia, 2º = noite).
    const ds = norm(diaSemana);
    let turno = 'unico';
    if (/s[áa]bado/.test(ds) && /noite/.test(ds)) turno = 'noite';
    else if (/s[áa]bado/.test(ds) && /dia/.test(ds)) turno = 'dia';
    if (turno !== 'unico' && data.getUTCDay() !== 6) {
      // recua até o sábado (corrige a data errada da planilha: NOITE vinha com o domingo)
      while (data.getUTCDay() !== 6) data.setUTCDate(data.getUTCDate() - 1);
    }

    const dia = { data: iso(data), turno, coluna: c, funcoes: {}, fixos: {} };

    // contexto
    for (const [rot, campo] of Object.entries(CONTEXTO)) {
      const l = linhaDe[rot];
      if (l) { const v = txt(cel(ws, c, l)); if (v) dia[campo] = v; }
    }
    if (linhaDe['expect faturamento']) dia.faturamento = num(cel(ws, c, linhaDe['expect faturamento']));
    if (linhaDe['expectativa de público']) dia.publico = num(cel(ws, c, linhaDe['expectativa de público']));
    if (linhaDe['pico/lugares']) dia.pico = num(cel(ws, c, linhaDe['pico/lugares']));

    // TOTAL e FIXOS por função.
    //
    // O FIXOS É IMPORTADO como override (fixos_manual), e não descartado como na primeira
    // versão. Motivo: a contagem da escala diverge MUITO do que a planilha digitava — no ano,
    // garçom 1.280 contra 1.776, segurança 84 contra 271. Usar a escala no histórico inflava
    // o freela e o custo (03/08 dava R$ 320 onde a planilha diz R$ 130, porque a segurança
    // fixa daquele dia não estava escalada).
    //
    // Regra que ficou: o PASSADO é registro — reproduz o que eles planejaram, com os números
    // que usaram. O FUTURO é automático — dia novo nasce sem override e a escala manda.
    for (const [rot, codigo] of Object.entries(FUNCOES)) {
      const l = linhaDe[rot];
      if (!l) continue;
      const total = num(cel(ws, c, l));
      if (total !== null && total >= 0) dia.funcoes[codigo] = Math.round(total);
      const fixos = num(cel(ws, c + 1, l));
      if (fixos !== null && fixos >= 0) dia.fixos[codigo] = Math.round(fixos);
    }

    dias.push(dia);
  }

  // Desambiguação por POSIÇÃO: se a mesma data tem 2 blocos, o da esquerda é o turno DIA
  // e o da direita é NOITE — independente de como o rótulo foi escrito naquela semana.
  const porData = {};
  dias.forEach(d => (porData[d.data] = porData[d.data] || []).push(d));
  Object.values(porData).forEach(lista => {
    if (lista.length < 2) return;
    lista.sort((a, b) => a.coluna - b.coluna);
    lista.forEach((d, i) => { d.turno = i === 0 ? 'dia' : 'noite'; });
  });

  return { dias, temCusto };
}

const esc = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

function gerarSQL(dias) {
  const valoresDia = dias.map(d =>
    `(${esc(d.data)},${esc(d.turno)},${d.faturamento ?? 'null'},${d.publico ?? 'null'},${d.pico ?? 'null'},` +
    `${esc(d.programacao_musical)},${esc(d.programacao_esportiva)},${esc(d.entrada)},${esc(d.promocao)},` +
    `${esc(d.plano_chao)},${esc(d.pilula_treinamento)},${esc(d.observacoes)})`
  ).join(',\n  ');

  // TOTAL + FIXOS por (dia, turno, função). Códigos presentes só num dos dois viram null no outro.
  const valoresFun = [];
  dias.forEach(d => {
    const cods = new Set([...Object.keys(d.funcoes), ...Object.keys(d.fixos)]);
    cods.forEach(cod => {
      const total = d.funcoes[cod];
      const fixos = d.fixos[cod];
      valoresFun.push(`(${esc(d.data)},${esc(d.turno)},${esc(cod)},${total ?? 'null'},${fixos ?? 'null'})`);
    });
  });

  return `-- =============================================================================
-- BACKFILL do Plano Operacional (abas JANEIRO..AGOSTO 2026) — 12/08/2026
-- =============================================================================
-- Gerado por scripts/backfill-plano-operacional.js. Idempotente (upsert por chave natural).
--
-- O FIXOS da planilha NÃO entra: era digitado à mão e divergia da escala em quase toda
-- função (só garçom batia). Decisão: a escala manda. \`fixos_escala\` é contado da
-- operations.escala_dia logo abaixo.
-- =============================================================================

-- 1) o dia planejado
insert into operations.operacao_dia
  (bar_id, data, turno, faturamento_previsto, publico_calculado, pico_calculado,
   programacao_musical, programacao_esportiva, entrada, promocao, plano_chao,
   pilula_treinamento, observacoes)
select ${BAR_ID}, v.data::date, v.turno::operations.operacao_turno,
       v.fat, v.publico, v.pico, v.musical, v.esportiva, v.entrada, v.promocao,
       v.chao, v.pilula, v.obs
from (values
  ${valoresDia}
) as v(data, turno, fat, publico, pico, musical, esportiva, entrada, promocao, chao, pilula, obs)
on conflict (bar_id, data, turno) do update
   set faturamento_previsto = excluded.faturamento_previsto,
       publico_calculado    = excluded.publico_calculado,
       pico_calculado       = excluded.pico_calculado,
       programacao_musical  = excluded.programacao_musical,
       programacao_esportiva= excluded.programacao_esportiva,
       entrada              = excluded.entrada,
       promocao             = excluded.promocao,
       plano_chao           = excluded.plano_chao,
       pilula_treinamento   = excluded.pilula_treinamento,
       observacoes          = excluded.observacoes,
       atualizado_em        = now();

-- 2) TOTAL e FIXOS planejados por função
--
-- O FIXOS entra como fixos_manual (override), não como fixos_escala. A contagem da escala
-- diverge muito do que a planilha digitava — no ano, garçom 1.280 contra 1.776 e segurança
-- 84 contra 271 — e usar a escala no histórico inflava o custo: 03/08 dava R\$ 320 onde a
-- planilha diz R\$ 130, porque a segurança fixa daquele dia não estava escalada (a escala de
-- segurança para em 02/08).
--
-- Regra: o PASSADO é registro, reproduz o que foi planejado com os números usados na época.
-- O FUTURO é automático — dia criado pela tela nasce sem override e a escala manda.
insert into operations.operacao_dia_funcao (operacao_dia_id, funcao_id, total_calculado, fixos_manual)
select d.id, f.id, v.total, v.fixos
from (values
  ${valoresFun.join(',\n  ')}
) as v(data, turno, codigo, total, fixos)
join operations.operacao_dia d
  on d.bar_id = ${BAR_ID} and d.data = v.data::date and d.turno = v.turno::operations.operacao_turno
join operations.operacao_funcao f on f.bar_id = ${BAR_ID} and f.codigo = v.codigo
on conflict (operacao_dia_id, funcao_id) do update
   set total_calculado = excluded.total_calculado,
       fixos_manual    = excluded.fixos_manual,
       atualizado_em   = now();

-- 3) fixos_escala = contagem da escala (quem tem horário no dia; FOLGA/FÉRIAS não contam).
--    O sábado casa por turno; os demais dias são 'unico' nas duas pontas.
--    Subquery correlacionada, não UPDATE..FROM lateral: o Postgres não deixa a lateral
--    do FROM referenciar a própria tabela alvo do UPDATE (42P10).
update operations.operacao_dia_funcao df
   set fixos_escala = (
         select count(*)
         from operations.escala_dia e
         join operations.operacao_dia d2 on d2.id = df.operacao_dia_id
         where e.bar_id    = d2.bar_id
           and e.data      = d2.data
           and e.funcao_id = df.funcao_id
           and e.entra is not null
           and (d2.turno = 'unico' or e.turno = d2.turno)
       ),
       atualizado_em = now()
where exists (
  select 1 from operations.operacao_dia d
  where d.id = df.operacao_dia_id and d.bar_id = ${BAR_ID}
);
`;
}

function main() {
  const arq = process.argv[2];
  if (!arq) { console.error('uso: node scripts/backfill-plano-operacional.js <json> [--sql <arquivo>]'); process.exit(1); }
  const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const wb = XLSX.read(Buffer.from(j.content, 'base64'), { type: 'buffer' });

  let todos = [];
  ABAS.forEach(nome => {
    const { dias, aviso } = extrairAba(wb, nome);
    if (aviso) { console.log(nome.padEnd(12), aviso); return; }
    console.log(nome.padEnd(12), String(dias.length).padStart(3), 'dias  ',
      dias.length ? dias[0].data + ' -> ' + dias[dias.length - 1].data : '');
    todos = todos.concat(dias);
  });

  // dedup por (data, turno) — meses vizinhos repetem a virada de semana; o ÚLTIMO vence
  const mapa = new Map();
  todos.forEach(d => mapa.set(d.data + '|' + d.turno, d));
  const dias = [...mapa.values()].sort((a, b) => (a.data + a.turno).localeCompare(b.data + b.turno));

  const comFat = dias.filter(d => d.faturamento).length;
  const turnos = dias.reduce((a, d) => { a[d.turno] = (a[d.turno] || 0) + 1; return a; }, {});
  console.log('\ntotal .............', dias.length, 'dias únicos (dedup por data+turno)');
  console.log('período ...........', dias[0]?.data, '->', dias[dias.length - 1]?.data);
  console.log('com faturamento ...', comFat);
  console.log('turnos ............', JSON.stringify(turnos));
  console.log('linhas de função ..', dias.reduce((a, d) => a + Object.keys(d.funcoes).length, 0));

  const i = process.argv.indexOf('--sql');
  if (i > -1) { fs.writeFileSync(process.argv[i + 1], gerarSQL(dias)); console.log('\nSQL:', process.argv[i + 1]); }
}

main();
