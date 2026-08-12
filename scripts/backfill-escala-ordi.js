/**
 * Backfill da ESCALA ORDI! (Google Sheets) -> operations.escala_dia
 *
 * BACKFILL DE UMA VEZ, não sync: a decisão (Rodrigo, 12/08/2026) é o Zykor virar a fonte
 * da verdade e a planilha ser aposentada. Setembro/2026 em diante já é desenhado no sistema.
 *
 * FORMATO DA PLANILHA (aba viva, ano inteiro de 2026):
 *   - 52 semanas na horizontal, 22 colunas cada = 7 dias x (Entra, Sai, Total) + total da semana
 *   - vertical: linhas de SEÇÃO (col A vazia, col B = "GARÇOM", "CUMIM"...) seguidas das pessoas
 *     (col A = índice dentro da seção, col B = primeiro nome)
 *   - marcadores no lugar do horário: FOLGA, FÉRIAS e — só na Liderança — ABRE / FECHA
 *   - o intervalo (1h ou 2h) não é coluna: é a diferença entre (sai - entra) e o total
 *
 * TURNO: o Plano Operacional só parte o SÁBADO em DIA/NOITE. Validado contra a planilha —
 * sábado 08/08 tinha 4 garçons entrando 11:00 e 5 entrando 17:00, e o plano marcava
 * SÁBADO-DIA=4 / SÁBADO-NOITE=5. Nos outros dias o turno é 'unico'.
 *
 * USO:
 *   node scripts/backfill-escala-ordi.js <arquivo-csv-ou-json> [--sql <dir>] [--stats]
 *
 * O arquivo de entrada é o export CSV da aba viva (ou o JSON {content} em base64 do
 * download do Drive). Emite SQL em lotes para aplicar via migração/MCP.
 */

const fs = require('fs');
const path = require('path');

const BAR_ID = 3;
const PRIMEIRA_SEGUNDA = new Date(Date.UTC(2025, 11, 29)); // semana 1 começa 29/12/2025
const SEMANAS = 52;
const COLS_POR_SEMANA = 22;
const COL_INICIO = 2; // A = índice, B = nome

/**
 * CORTE DO BACKFILL. Da semana 39 (21/09/2026) em diante cada semana da planilha é cópia
 * byte a byte da anterior — template auto-preenchido, não escala planejada (medido: 100%
 * de células idênticas à semana anterior, 14 semanas seguidas; a 38 já é 97%).
 * Importar isso criaria escala fantasma justo nos meses que o time vai planejar no Zykor.
 */
const DATA_LIMITE = '2026-09-13';

/** Seção da planilha -> código da função (bate com operacao_funcao.aliases_escala). */
const SECAO_PARA_FUNCAO = {
  'GARÇOM': 'garcom',
  'CUMIM': 'cumim',
  'RECEPÇÃO': 'host',
  'ASG': 'asg',
  'BARTENDER/BACK DRINKS': 'bartender',
  'BARBACK': 'barback',
  'COZINHA': 'cozinha',
  'SEGURANÇA': 'seguranca',
  'BRIGADA': 'brigadista',
  'LIDERANÇA': 'lideranca',
  'PRODUÇÃO': 'producao',
};

/**
 * Marcadores conhecidos. Além dos óbvios, a planilha usa BANCO (banco de horas),
 * INTERMEDIÁRIO (turno quebrado), MANUTENÇÃO e PRODUÇÃO (alocado fora da operação),
 * e ABRE/FECHA só na Liderança.
 */
const MARCADORES = [
  'FOLGA', 'FÉRIAS', 'FERIAS', 'ABRE', 'FECHA', 'ATESTADO', 'AFASTADO', 'FD', 'FO',
  'BANCO', 'INTERMEDIÁRIO', 'INTERMEDIARIO', 'MANUTENÇÕES', 'MANUTENÇÃO', 'PRODUÇÃO',
];

/**
 * Lixo de planilha que NÃO pode virar linha: erro de fórmula e duração negativa.
 * Importar isso como "marcador" criaria escala fantasma que ninguém consegue explicar depois.
 */
const LIXO = [/^#\w+!?$/, /^-\d{1,2}:\d{2}/];

function parseCSV(s) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** "09:30" -> 9.5 ; "08:48" -> 8.8 ; aceita HH:MM:SS. Negativo é lixo -> null. */
function horasParaDecimal(txt) {
  const m = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec((txt || '').trim());
  if (!m) return null;
  return Math.round((Number(m[1]) + Number(m[2]) / 60) * 100) / 100;
}

/**
 * "15:00" -> "15:00:00". Aceita HH:MM:SS porque parte das células vem com segundos
 * (o Sheets exporta assim quando a célula é hora de verdade em vez de texto) — sem isso
 * elas cairiam como "marcador" e virariam FOLGA fantasma.
 */
function paraHora(txt) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec((txt || '').trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

function dataDoDia(semanaIdx, diaIdx) {
  const d = new Date(PRIMEIRA_SEGUNDA.getTime());
  d.setUTCDate(d.getUTCDate() + semanaIdx * 7 + diaIdx);
  return d;
}

const iso = (d) => d.toISOString().slice(0, 10);
const ddmm = (d) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

function extrair(rows) {
  const L2 = rows[1] || [];
  const linhas = [];
  const avisos = [];
  const desconhecidas = new Set();
  const descartadas = [];
  const marcadoresVistos = new Set();
  let conferencias = { ok: 0, divergentes: [] };

  let secaoAtual = null;
  let funcaoAtual = null;
  // Posição da pessoa dentro da seção. Desambigua homônimo: a seção CUMIM tem DOIS
  // "ALEXANDRE" e sem isso o segundo sobrescreveria o primeiro no upsert — o bar
  // apareceria com 1 cumim a menos no dia, erro silencioso na contagem de fixos.
  let slot = 0;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const idx = (row[0] || '').trim();
    const nome = (row[1] || '').trim();
    if (!nome) continue;

    // Linha de seção: col A vazia. Ignora a legenda "1:00".."4:00" do topo.
    if (!idx) {
      if (/^\d{1,2}:00$/.test(nome)) continue;
      secaoAtual = nome.toUpperCase();
      funcaoAtual = SECAO_PARA_FUNCAO[secaoAtual] || null;
      if (!funcaoAtual) desconhecidas.add(secaoAtual);
      slot = 0;
      continue;
    }
    if (!funcaoAtual) continue;
    slot += 1;

    for (let w = 0; w < SEMANAS; w++) {
      const base = COL_INICIO + w * COLS_POR_SEMANA;
      for (let d = 0; d < 7; d++) {
        const c = base + d * 3;
        const bruto = (row[c] || '').trim();
        if (!bruto) continue; // pessoa ainda não contratada / já saiu
        if (LIXO.some(re => re.test(bruto))) { descartadas.push({ nome, bruto }); continue; }

        const data = dataDoDia(w, d);
        if (iso(data) > DATA_LIMITE) continue;
        // Confere a data calculada contra o cabeçalho da planilha (uma vez por semana).
        if (r === 5 && d === 0) {
          const naPlanilha = (L2[base] || '').trim();
          if (naPlanilha && !naPlanilha.startsWith(ddmm(data))) {
            conferencias.divergentes.push({ semana: w + 1, planilha: naPlanilha, calculado: ddmm(data) });
          } else if (naPlanilha) conferencias.ok++;
        }

        const entra = paraHora(bruto);
        let marcador = null;
        if (!entra) {
          const up = bruto.toUpperCase();
          marcador = MARCADORES.find(m => up.startsWith(m)) || up;
          marcadoresVistos.add(marcador);
        }

        const sai = paraHora(row[c + 1] || '');
        const horas = horasParaDecimal(row[c + 2] || '');

        // Só o sábado é partido em DIA/NOITE no Plano Operacional.
        const ehSabado = data.getUTCDay() === 6;
        const turno = (ehSabado && entra) ? (Number(entra.slice(0, 2)) < 14 ? 'dia' : 'noite') : 'unico';

        linhas.push({
          data: iso(data),
          funcao: funcaoAtual,
          pessoa: nome,
          entra, sai, horas, marcador, turno, slot,
        });
      }
    }
  }

  return { linhas, avisos, descartadas, desconhecidas: [...desconhecidas], marcadores: [...marcadoresVistos], conferencias };
}

const esc = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

/** Código curto por função — encurta ~5 chars em cada uma das 13 mil linhas. */
const CURTO = {
  garcom: 'g', cumim: 'c', host: 'h', asg: 'a', bartender: 'b', barback: 'k',
  cozinha: 'z', seguranca: 's', brigadista: 'r', lideranca: 'l', producao: 'p',
};

/**
 * SQL COMPACTO — para aplicar via MCP, onde o texto do comando é caro.
 *
 * Em vez de um tuple VALUES por linha (~85 chars), manda um blob delimitado com uma linha
 * de 25 chars por registro e deixa o Postgres expandir:
 *     AAAAMMDD|f|slot|HHMM|HHMM|horas|MARCADOR
 *
 * O nome da pessoa NÃO vai em cada linha: (função, slot) identifica a pessoa, e o de-para
 * com os ~49 nomes viaja uma vez por lote numa CTE. Só isso corta ~100 KB.
 * O turno também não vai: é derivado no SQL pela mesma regra do parser (sábado + entrada < 14h).
 */
function gerarSQLCompacto(linhas, tamanhoLote = 2500) {
  // de-para (função curta, slot) -> nome, deduplicado
  const pessoas = new Map();
  linhas.forEach(l => pessoas.set(`${CURTO[l.funcao]}|${l.slot}`, { c: CURTO[l.funcao], codigo: l.funcao, s: l.slot, nome: l.pessoa }));
  const cte = [...pessoas.values()]
    .map(p => `(${esc(p.c)},${esc(p.codigo)},${p.s},${esc(p.nome)})`).join(',');

  const hhmm = (t) => (t ? t.slice(0, 2) + t.slice(3, 5) : '');
  const lotes = [];
  for (let i = 0; i < linhas.length; i += tamanhoLote) {
    const blob = linhas.slice(i, i + tamanhoLote).map(l =>
      [l.data.replace(/-/g, ''), CURTO[l.funcao], l.slot, hhmm(l.entra), hhmm(l.sai),
       l.horas === null ? '' : l.horas, l.marcador || ''].join('|')
    ).join('\n');

    lotes.push(
`with pessoa(c, codigo, slot, nome) as (values ${cte}),
bruto as (
  select split_part(l,'|',1) d, split_part(l,'|',2) f, split_part(l,'|',3)::smallint s,
         nullif(split_part(l,'|',4),'') e, nullif(split_part(l,'|',5),'') x,
         nullif(split_part(l,'|',6),'') h, nullif(split_part(l,'|',7),'') m
  from unnest(string_to_array($blob$
${blob}
$blob$, chr(10))) l
  where btrim(l) <> ''
)
insert into operations.escala_dia
  (bar_id, data, funcao_id, pessoa_nome, slot, entra, sai, horas, marcador, turno, origem)
select ${BAR_ID},
       to_date(b.d,'YYYYMMDD'),
       fn.id,
       p.nome,
       b.s,
       (substr(b.e,1,2)||':'||substr(b.e,3,2))::time,
       (substr(b.x,1,2)||':'||substr(b.x,3,2))::time,
       b.h::numeric,
       b.m,
       -- mesma regra do parser: só o sábado é partido em DIA/NOITE
       (case when extract(dow from to_date(b.d,'YYYYMMDD')) = 6 and b.e is not null
             then case when substr(b.e,1,2)::int < 14 then 'dia' else 'noite' end
             else 'unico' end)::operations.operacao_turno,
       'planilha'
from bruto b
join pessoa p on p.c = b.f and p.slot = b.s
join operations.operacao_funcao fn on fn.bar_id = ${BAR_ID} and fn.codigo = p.codigo
on conflict (bar_id, data, funcao_id, slot) do update
   set pessoa_nome = excluded.pessoa_nome, entra = excluded.entra, sai = excluded.sai,
       horas = excluded.horas, marcador = excluded.marcador, turno = excluded.turno,
       origem = 'planilha', atualizado_em = now();`
    );
  }
  return lotes;
}

function gerarSQL(linhas, tamanhoLote = 1200) {
  const lotes = [];
  for (let i = 0; i < linhas.length; i += tamanhoLote) {
    const fatia = linhas.slice(i, i + tamanhoLote);
    const values = fatia.map(l =>
      `(${esc(l.data)},${esc(l.funcao)},${esc(l.pessoa)},${l.slot},${esc(l.entra)},${esc(l.sai)},${l.horas === null ? 'null' : l.horas},${esc(l.marcador)},${esc(l.turno)})`
    ).join(',\n  ');

    lotes.push(
`insert into operations.escala_dia
  (bar_id, data, funcao_id, pessoa_nome, slot, entra, sai, horas, marcador, turno, origem)
select ${BAR_ID}, v.data::date, f.id, v.pessoa, v.slot::smallint, v.entra::time, v.sai::time,
       v.horas::numeric, v.marcador, v.turno::operations.operacao_turno, 'planilha'
from (values
  ${values}
) as v(data, funcao, pessoa, slot, entra, sai, horas, marcador, turno)
join operations.operacao_funcao f on f.bar_id = ${BAR_ID} and f.codigo = v.funcao
on conflict (bar_id, data, funcao_id, slot) do update
   set pessoa_nome = excluded.pessoa_nome, entra = excluded.entra, sai = excluded.sai,
       horas = excluded.horas, marcador = excluded.marcador, turno = excluded.turno,
       origem = 'planilha', atualizado_em = now();`
    );
  }
  return lotes;
}

// ---------------------------------------------------------------------------
function main() {
  const arq = process.argv[2];
  if (!arq) { console.error('uso: node scripts/backfill-escala-ordi.js <csv|json> [--sql <dir>]'); process.exit(1); }

  let texto = fs.readFileSync(arq, 'utf8');
  if (texto.trimStart().startsWith('{')) {
    const j = JSON.parse(texto);
    texto = Buffer.from(j.content, 'base64').toString('utf8');
  }

  const rows = parseCSV(texto);
  const { linhas, descartadas, desconhecidas, marcadores, conferencias } = extrair(rows);

  const porFuncao = {};
  const comHorario = linhas.filter(l => l.entra).length;
  linhas.forEach(l => { porFuncao[l.funcao] = (porFuncao[l.funcao] || 0) + 1; });
  const datas = linhas.map(l => l.data).sort();

  console.log('=== BACKFILL ESCALA ORDI ===');
  console.log('linhas geradas .....', linhas.length);
  console.log('  com horário ......', comHorario);
  console.log('  só marcador ......', linhas.length - comHorario);
  console.log('período ............', datas[0], '->', datas[datas.length - 1]);
  console.log('datas conferidas ...', conferencias.ok, 'ok,', conferencias.divergentes.length, 'divergentes');
  if (conferencias.divergentes.length) console.log('  DIVERGENTES:', JSON.stringify(conferencias.divergentes.slice(0, 5)));
  console.log('marcadores .........', marcadores.join(', '));
  console.log('descartadas (lixo) .', descartadas.length, descartadas.length ? JSON.stringify(descartadas.slice(0,4)) : '');
  if (desconhecidas.length) console.log('SEÇÕES SEM FUNÇÃO ..', desconhecidas.join(', '));
  console.log('por função .........', JSON.stringify(porFuncao));

  const iSql = process.argv.indexOf('--sql');
  if (iSql > -1) {
    const dir = process.argv[iSql + 1];
    fs.mkdirSync(dir, { recursive: true });
    const compacto = process.argv.includes('--compacto');
    const lotes = compacto ? gerarSQLCompacto(linhas) : gerarSQL(linhas);
    lotes.forEach((sql, i) => {
      fs.writeFileSync(path.join(dir, `escala_lote_${String(i + 1).padStart(2, '0')}.sql`), sql);
    });
    console.log('\nSQL gerado .........', lotes.length, 'lotes em', dir);
  }
}

main();
