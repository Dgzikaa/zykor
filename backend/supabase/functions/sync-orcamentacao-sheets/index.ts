/**
 * Edge Function: Sincronizar Orçamentação do Google Sheets
 * 
 * Busca dados de orçamentação da planilha de desempenho/orçamentação
 * Planilha: 1WRnwl_F_tgqvQmHIyQUFtiWQVujTBk2TDL-ii0JjfAY
 * Aba: Orçamentação (gid=1354671906)
 * 
 * Estrutura esperada da planilha:
 * - Coluna A: Categoria
 * - Colunas B-M: Meses (Jan-Dez) com valores planejados
 * 
 * Roda automaticamente via cron job diário
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64url } from 'https://deno.land/std@0.168.0/encoding/base64url.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ID da planilha de orçamentação/desempenho
const SPREADSHEET_ID = '1WRnwl_F_tgqvQmHIyQUFtiWQVujTBk2TDL-ii0JjfAY';
const ABA_ORCAMENTACAO = 'Orçamentação';

// Mapeamento de mês (coluna) para número
const MESES_MAP: Record<string, number> = {
  'jan': 1, 'janeiro': 1,
  'fev': 2, 'fevereiro': 2,
  'mar': 3, 'março': 3, 'marco': 3,
  'abr': 4, 'abril': 4,
  'mai': 5, 'maio': 5,
  'jun': 6, 'junho': 6,
  'jul': 7, 'julho': 7,
  'ago': 8, 'agosto': 8,
  'set': 9, 'setembro': 9,
  'out': 10, 'outubro': 10,
  'nov': 11, 'novembro': 11,
  'dez': 12, 'dezembro': 12,
};

// ==================== AUTH SERVICE ACCOUNT ====================

async function gerarJWT(clientEmail: string, privateKeyPem: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const pemContent = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = base64url(new Uint8Array(signature));
  return `${unsignedToken}.${signatureB64}`;
}

async function obterAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = await gerarJWT(clientEmail, privateKey);
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao obter access token: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.access_token;
}

// ==================== HELPERS ====================

function parseMonetario(valor: string | null | undefined): number {
  if (!valor) return 0;
  let str = valor.toString().trim();
  if (str === '' || str === '-' || str === 'R$ -' || str.includes('#REF') || str.includes('#N/A')) return 0;
  
  const isNegativo = str.includes('(') && str.includes(')') || str.startsWith('-');
  const limpo = str
    .replace(/R\$/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/\s/g, '')
    .replace(/\u00A0/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  
  const num = parseFloat(limpo);
  if (isNaN(num)) return 0;
  return isNegativo && num > 0 ? -num : num;
}

function parsePercentual(valor: string | null | undefined): number {
  if (!valor) return 0;
  const limpo = valor.toString().replace('%', '').replace(',', '.').trim();
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : num;
}

function detectarMes(coluna: string): number | null {
  if (!coluna) return null;
  const lower = coluna.toLowerCase().trim();
  
  // Verificar se contém nome do mês
  for (const [nome, numero] of Object.entries(MESES_MAP)) {
    if (lower.includes(nome)) {
      return numero;
    }
  }
  
  return null;
}

// Detecta se a coluna é do tipo PLANEJADO (não PROJEÇÃO ou REALIZADO)
function isPlanejado(coluna: string): boolean {
  if (!coluna) return false;
  const lower = coluna.toLowerCase().trim();
  return lower.includes('planejado') || lower === 'planejado';
}

function detectarAno(coluna: string): number | null {
  if (!coluna) return null;
  
  // Procurar por 4 dígitos (ano)
  const match = coluna.match(/20\d{2}/);
  if (match) {
    return parseInt(match[0]);
  }
  
  return null;
}

function normalizarCategoria(categoria: string): string {
  if (!categoria) return '';
  
  return categoria
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ')
    .trim();
}

// Mapeamento de categorias da planilha para categorias do sistema
const CATEGORIAS_PLANILHA_MAP: Record<string, string> = {
  'RECEITA BRUTA': 'RECEITA BRUTA',
  'RECEITA': 'RECEITA BRUTA',
  'FATURAMENTO': 'RECEITA BRUTA',
  'FATURAMENTO META': 'RECEITA BRUTA',  // Na planilha aparece como "Faturamento Meta" - esta é a receita bruta real
  // 'REAL FIXO': 'RECEITA BRUTA',  // Removido - Real Fixo NÃO é receita bruta
  'CONTRATOS': 'CONTRATOS',
  'CONTRATO': 'CONTRATOS',
  'IMPOSTO': 'IMPOSTO/TX MAQ/COMISSAO',
  'TAXA MAQUININHA': 'IMPOSTO/TX MAQ/COMISSAO',
  'COMISSAO': 'IMPOSTO/TX MAQ/COMISSAO',
  'CMV': 'CMV',
  'CUSTO MERCADORIA': 'CMV',
  'CUSTO-EMPRESA FUNCIONARIOS': 'CUSTO-EMPRESA FUNCIONÁRIOS',
  'SALARIO': 'CUSTO-EMPRESA FUNCIONÁRIOS',
  'FOLHA': 'CUSTO-EMPRESA FUNCIONÁRIOS',
  'ADICIONAIS': 'ADICIONAIS',
  'FREELA ATENDIMENTO': 'FREELA ATENDIMENTO',
  'FREELA BAR': 'FREELA BAR',
  'FREELA COZINHA': 'FREELA COZINHA',
  'FREELA LIMPEZA': 'FREELA LIMPEZA',
  'FREELA SEGURANCA': 'FREELA SEGURANÇA',
  'PRO LABORE': 'PRO LABORE',
  'ESCRITORIO CENTRAL': 'Escritório Central',
  'ADMINISTRATIVO': 'Administrativo Ordinário',
  'RECURSOS HUMANOS': 'RECURSOS HUMANOS',
  'RH': 'RECURSOS HUMANOS',
  'VALE TRANSPORTE': 'VALE TRANSPORTE',
  'VT': 'VALE TRANSPORTE',
  'MARKETING': 'Marketing',
  'ATRACOES': 'Atrações Programação',
  'PROGRAMACAO': 'Atrações Programação',
  'PRODUCAO EVENTOS': 'Produção Eventos',
  'MATERIAIS OPERACAO': 'Materiais Operação',
  'EQUIPAMENTOS OPERACAO': 'Equipamentos Operação',
  'LIMPEZA DESCARTAVEIS': 'Materiais de Limpeza e Descartáveis',
  'UTENSILIOS': 'Utensílios',
  'ALUGUEL': 'ALUGUEL/CONDOMÍNIO/IPTU',
  'CONDOMINIO': 'ALUGUEL/CONDOMÍNIO/IPTU',
  'IPTU': 'ALUGUEL/CONDOMÍNIO/IPTU',
  'AGUA': 'ÁGUA',
  'GAS': 'GÁS',
  'LUZ': 'LUZ',
  'ENERGIA': 'LUZ',
  'INTERNET': 'INTERNET',
  'MANUTENCAO': 'Manutenção',
};

function mapearCategoria(categoriaPlanilha: string): string | null {
  const normalizada = normalizarCategoria(categoriaPlanilha);
  
  // Busca exata primeiro
  if (CATEGORIAS_PLANILHA_MAP[normalizada]) {
    return CATEGORIAS_PLANILHA_MAP[normalizada];
  }
  
  // Busca parcial
  for (const [chave, valor] of Object.entries(CATEGORIAS_PLANILHA_MAP)) {
    if (normalizada.includes(chave) || chave.includes(normalizada)) {
      return valor;
    }
  }
  
  // Retorna a categoria original se não encontrar mapeamento
  return categoriaPlanilha;
}

// ==================== SHEETS ====================

async function buscarDadosSheets(range: string, spreadsheetId: string, accessToken: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao acessar planilha: ${response.status} - ${err}`);
  }
  const data = await response.json();
  return data.values || [];
}

async function listarAbas(spreadsheetId: string, accessToken: string): Promise<{ title: string; sheetId: number }[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erro ao listar abas: ${response.status} - ${err}`);
  }
  const data = await response.json();
  return data.sheets?.map((s: any) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId
  })) || [];
}

// ==================== PROCESSAMENTO ====================

interface DadoOrcamento {
  bar_id: number;
  ano: number;
  mes: number;
  categoria_nome: string;
  valor_planejado: number;
  valor_realizado?: number;  // Valor realizado da planilha (para RECEITA BRUTA)
  tipo: 'receita' | 'despesa';
}

function processarPlanilha(linhas: any[][], barId: number, anoDefault: number): DadoOrcamento[] {
  if (linhas.length < 10) {
    console.log('⚠️ Planilha com menos de 10 linhas');
    return [];
  }

  // Estrutura real da planilha (baseado na análise):
  // Linha 0: vazia ou com anos
  // Linha 1: Real Fixo (RECEITA BRUTA) - ANTES do cabeçalho!
  // ...
  // Linha 5: números dos meses (8, 9, 10, 11, 12, 1, 2...)
  // Linha 6: tipos (REALIZADO, PLANEJADO, PROJEÇÃO)
  // Linha 7: períodos (SIMULAÇÃO SET 25, SIMULAÇÃO OUT 25, etc.)
  // Linha 8+: dados com categorias na coluna C

  // 1. Encontrar a linha que contém "PLANEJADO"
  let linhaTipos = -1;
  for (let i = 0; i < Math.min(15, linhas.length); i++) {
    const linha = linhas[i] || [];
    for (let j = 0; j < linha.length; j++) {
      const cell = (linha[j] || '').toString().toLowerCase().trim();
      if (cell === 'planejado') {
        linhaTipos = i;
        console.log(`📋 Linha de tipos (PLANEJADO/PROJEÇÃO/REALIZADO) encontrada na linha ${i}`);
        break;
      }
    }
    if (linhaTipos >= 0) break;
  }

  if (linhaTipos < 0) {
    console.log('⚠️ Linha com "PLANEJADO" não encontrada');
    return [];
  }

  // 2. A linha de períodos pode estar ANTES ou DEPOIS da linha de tipos
  // Vamos procurar a linha que contém "SIMULAÇÃO" ou nomes de meses
  let linhaPeriodos = linhaTipos + 1;
  
  // Verificar se a linha abaixo contém períodos
  const linhaAbaixo = linhas[linhaTipos + 1] || [];
  const linhaAcima = linhas[linhaTipos - 1] || [];
  
  let temPeriodoAbaixo = false;
  let temPeriodoAcima = false;
  
  for (let j = 0; j < linhaAbaixo.length; j++) {
    const cell = (linhaAbaixo[j] || '').toString().toLowerCase();
    if (cell.includes('simulação') || cell.includes('simulacao')) {
      temPeriodoAbaixo = true;
      break;
    }
  }
  
  for (let j = 0; j < linhaAcima.length; j++) {
    const cell = (linhaAcima[j] || '').toString().toLowerCase();
    if (cell.includes('simulação') || cell.includes('simulacao')) {
      temPeriodoAcima = true;
      break;
    }
  }
  
  if (temPeriodoAbaixo) {
    linhaPeriodos = linhaTipos + 1;
    console.log(`📋 Períodos encontrados na linha ${linhaPeriodos} (abaixo dos tipos)`);
  } else if (temPeriodoAcima) {
    linhaPeriodos = linhaTipos - 1;
    console.log(`📋 Períodos encontrados na linha ${linhaPeriodos} (acima dos tipos)`);
  } else {
    console.log(`⚠️ Linha de períodos não encontrada, usando linha ${linhaPeriodos}`);
  }
  
  // A linha de números de meses
  const linhaMeses = linhaTipos - 1;

  const tipos = linhas[linhaTipos] || [];
  const periodos = linhas[linhaPeriodos] || [];
  const meses = linhas[linhaMeses] || [];

  console.log(`📊 Linha ${linhaMeses} (meses): ${meses.slice(20, 35).join(' | ')}`);
  console.log(`📊 Linha ${linhaTipos} (tipos): ${tipos.slice(20, 35).join(' | ')}`);
  console.log(`📊 Linha ${linhaPeriodos} (períodos): ${periodos.slice(20, 35).join(' | ')}`);

  // 3. Mapear colunas de PLANEJADO para cada mês
  const colunasPlanejado: { colIdx: number; mes: number; ano: number }[] = [];
  
  for (let i = 0; i < tipos.length; i++) {
    const tipoCell = (tipos[i] || '').toString().toLowerCase().trim();
    if (tipoCell === 'planejado') {
      // O período está na mesma coluna ou NO MÁXIMO 3 colunas à esquerda
      // Cada grupo de mês tem 3 colunas: REALIZADO, PLANEJADO, PROJEÇÃO
      // O período fica na primeira coluna do grupo
      let periodoStr = '';
      for (let j = i; j >= Math.max(0, i - 3); j--) {  // Mudou de 5 para 3
        const p = (periodos[j] || '').toString().trim();
        if (p && detectarMes(p) !== null) {
          periodoStr = p;
          break;
        }
      }
      
      // Se não encontrou na linha de períodos, tentar na linha de meses (números)
      let mes: number | null = null;
      let ano = anoDefault;
      
      if (periodoStr) {
        mes = detectarMes(periodoStr);
        // Tentar extrair ano do período
        const anoMatch = periodoStr.match(/\b(\d{2})\b/);
        if (anoMatch) {
          const ano2dig = parseInt(anoMatch[1]);
          ano = ano2dig < 50 ? 2000 + ano2dig : 1900 + ano2dig;
        }
      } else {
        // Usar a linha de meses (números)
        for (let j = i; j >= Math.max(0, i - 5); j--) {
          const m = (meses[j] || '').toString().trim();
          if (m && /^\d+$/.test(m)) {
            mes = parseInt(m);
            if (mes >= 1 && mes <= 12) {
              // Inferir ano baseado no mês
              // Se mês >= 7 (julho+), provavelmente é o ano base
              // Se mês <= 6, provavelmente é o próximo ano
              ano = mes <= 6 ? anoDefault + 1 : anoDefault;
              break;
            }
          }
        }
      }
      
      if (mes !== null && mes >= 1 && mes <= 12) {
        // Verificar se já existe uma coluna para este mês/ano (evitar duplicatas)
        const jaExiste = colunasPlanejado.some(c => c.mes === mes && c.ano === ano);
        if (!jaExiste) {
          colunasPlanejado.push({ colIdx: i, mes, ano });
          console.log(`  ✓ Coluna ${i}: PLANEJADO → Mês ${mes}/${ano} (período: ${periodoStr || 'N/A'})`);
        } else {
          console.log(`  ⚠️ Coluna ${i}: PLANEJADO duplicada para ${mes}/${ano}, ignorando`);
        }
      }
    }
  }

  if (colunasPlanejado.length === 0) {
    console.log('⚠️ Nenhuma coluna PLANEJADO detectada');
    return [];
  }

  console.log(`📊 Total de ${colunasPlanejado.length} colunas PLANEJADO encontradas`);
  
  // DEBUG: Log todas as colunas PLANEJADO detectadas
  console.log(`📊 Colunas detectadas:`);
  for (const col of colunasPlanejado) {
    console.log(`   Col ${col.colIdx} → ${col.mes}/${col.ano}`);
  }

  // 4. Processar TODAS as linhas (incluindo as antes do cabeçalho, como "Real Fixo")
  const dados: DadoOrcamento[] = [];
  const categoriasReceita = ['RECEITA BRUTA', 'CONTRATOS', 'OUTRAS RECEITAS', 'FATURAMENTO'];
  const linhasProcessadas = new Set<number>();

  // Processar linhas de dados (após cabeçalho)
  const linhaInicioDados = linhaPeriodos + 1;
  for (let rowIdx = linhaInicioDados; rowIdx < linhas.length; rowIdx++) {
    linhasProcessadas.add(rowIdx);
    const registros = processarLinha(linhas[rowIdx], rowIdx, colunasPlanejado, barId, categoriasReceita);
    dados.push(...registros);
  }

  // Processar linhas ANTES do cabeçalho (como "Real Fixo" na linha 1)
  for (let rowIdx = 0; rowIdx < linhaMeses; rowIdx++) {
    if (linhasProcessadas.has(rowIdx)) continue;
    const registros = processarLinha(linhas[rowIdx], rowIdx, colunasPlanejado, barId, categoriasReceita);
    if (registros.length > 0) {
      console.log(`  📌 Linha ${rowIdx} processada: ${registros.length} registros`);
    }
    dados.push(...registros);
  }

  console.log(`📊 Total de ${dados.length} registros processados`);
  return dados;
}

// Versão com debug que retorna também as colunas detectadas
function processarPlanilhaComDebug(linhas: any[][], barId: number, anoDefault: number): { dados: DadoOrcamento[], colunasDebug: any[] } {
  const dados = processarPlanilha(linhas, barId, anoDefault);
  
  // Recalcular colunas para debug
  let linhaTipos = -1;
  for (let i = 0; i < Math.min(15, linhas.length); i++) {
    const linha = linhas[i] || [];
    for (let j = 0; j < linha.length; j++) {
      const cell = (linha[j] || '').toString().toLowerCase().trim();
      if (cell === 'planejado') {
        linhaTipos = i;
        break;
      }
    }
    if (linhaTipos >= 0) break;
  }
  
  if (linhaTipos < 0) {
    return { dados, colunasDebug: [] };
  }
  
  // Detectar linha de períodos
  let linhaPeriodos = linhaTipos + 1;
  const linhaAbaixo = linhas[linhaTipos + 1] || [];
  const linhaAcima = linhas[linhaTipos - 1] || [];
  
  for (let j = 0; j < linhaAbaixo.length; j++) {
    const cell = (linhaAbaixo[j] || '').toString().toLowerCase();
    if (cell.includes('simulação') || cell.includes('simulacao')) {
      linhaPeriodos = linhaTipos + 1;
      break;
    }
  }
  for (let j = 0; j < linhaAcima.length; j++) {
    const cell = (linhaAcima[j] || '').toString().toLowerCase();
    if (cell.includes('simulação') || cell.includes('simulacao')) {
      linhaPeriodos = linhaTipos - 1;
      break;
    }
  }
  
  const tipos = linhas[linhaTipos] || [];
  const periodos = linhas[linhaPeriodos] || [];
  const linhaMeses = linhaTipos - 1;
  const meses = linhas[linhaMeses] || [];
  
  const colunasDebug: any[] = [];
  
  for (let i = 0; i < tipos.length; i++) {
    const tipoCell = (tipos[i] || '').toString().toLowerCase().trim();
    if (tipoCell === 'planejado') {
      let periodoStr = '';
      for (let j = i; j >= Math.max(0, i - 3); j--) {
        const p = (periodos[j] || '').toString().trim();
        if (p && detectarMes(p) !== null) {
          periodoStr = p;
          break;
        }
      }
      
      let mes: number | null = null;
      let ano = anoDefault;
      
      if (periodoStr) {
        mes = detectarMes(periodoStr);
        const anoMatch = periodoStr.match(/\b(\d{2})\b/);
        if (anoMatch) {
          const ano2dig = parseInt(anoMatch[1]);
          ano = ano2dig < 50 ? 2000 + ano2dig : 1900 + ano2dig;
        }
      } else {
        for (let j = i; j >= Math.max(0, i - 3); j--) {
          const m = (meses[j] || '').toString().trim();
          if (m && /^\d+$/.test(m)) {
            mes = parseInt(m);
            if (mes >= 1 && mes <= 12) {
              ano = mes <= 6 ? anoDefault + 1 : anoDefault;
              break;
            }
          }
        }
      }
      
      colunasDebug.push({
        colIdx: i,
        tipo: tipos[i],
        periodo: periodoStr || 'N/A',
        mes,
        ano
      });
    }
  }
  
  return { dados, colunasDebug };
}

function processarLinha(
  linha: any[] | undefined,
  rowIdx: number,
  colunasPlanejado: { colIdx: number; mes: number; ano: number }[],
  barId: number,
  categoriasReceita: string[]
): DadoOrcamento[] {
  if (!linha) return [];

  // Buscar categoria na coluna C (índice 2) ou B (índice 1)
  let categoriaPlanilha = '';
  for (const colIdx of [2, 1, 0]) {
    const val = linha[colIdx]?.toString().trim() || '';
    if (val && val !== '-' && !val.startsWith('#') && val.length > 2) {
      categoriaPlanilha = val;
      break;
    }
  }

  if (!categoriaPlanilha) return [];

  const categoriaMapeada = mapearCategoria(categoriaPlanilha);
  if (!categoriaMapeada) return [];

  // Determinar tipo (receita ou despesa)
  const categoriaNorm = normalizarCategoria(categoriaMapeada);
  const tipo: 'receita' | 'despesa' = categoriasReceita.some(r => categoriaNorm.includes(normalizarCategoria(r))) 
    ? 'receita' 
    : 'despesa';

  const registros: DadoOrcamento[] = [];

  // Categorias que devem ter o valor REALIZADO capturado da planilha
  const categoriasComRealizado = ['RECEITA BRUTA', 'FATURAMENTO META'];
  const deveCapturarRealizado = categoriasComRealizado.some(c => 
    normalizarCategoria(categoriaMapeada).includes(normalizarCategoria(c))
  );

  // Processar cada coluna PLANEJADO
  for (const { colIdx, mes, ano } of colunasPlanejado) {
    const valorStr = linha[colIdx];
    if (!valorStr) continue;

    const valorStrTrimmed = valorStr.toString().trim();
    if (!valorStrTrimmed || valorStrTrimmed === '#REF!' || valorStrTrimmed === '#N/A' || valorStrTrimmed === '-') continue;

    // Detectar se é percentual ou valor monetário
    const isPercentual = valorStrTrimmed.includes('%');
    const valor = isPercentual ? parsePercentual(valorStrTrimmed) : parseMonetario(valorStrTrimmed);

    if (valor === 0) continue;

    const registro: DadoOrcamento = {
      bar_id: barId,
      ano,
      mes,
      categoria_nome: categoriaMapeada,
      valor_planejado: valor,
      tipo
    };

    // Para RECEITA BRUTA, capturar também o REALIZADO (1 coluna DEPOIS do PLANEJADO/PROJETADO)
    // Estrutura da planilha: AL = PROJETADO, AM = REALIZADO
    if (deveCapturarRealizado) {
      const valorRealizadoStr = linha[colIdx + 1];
      if (valorRealizadoStr) {
        const valorRealizadoTrimmed = valorRealizadoStr.toString().trim();
        if (valorRealizadoTrimmed && valorRealizadoTrimmed !== '#REF!' && valorRealizadoTrimmed !== '#N/A' && valorRealizadoTrimmed !== '-') {
          const valorRealizado = parseMonetario(valorRealizadoTrimmed);
          if (valorRealizado > 0) {
            registro.valor_realizado = valorRealizado;
            console.log(`  💰 ${categoriaMapeada} ${mes}/${ano}: Realizado = ${valorRealizado.toLocaleString('pt-BR')}`);
          }
        }
      }
    }

    registros.push(registro);
  }

  return registros;
}

// ==================== HANDLER ====================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const { bar_id, ano, aba } = body;
    const anoEspecifico = ano || new Date().getFullYear();
    const abaEspecifica = aba || ABA_ORCAMENTACAO;

    console.log(`🔄 Sync Orçamentação Sheets iniciando...`);
    console.log(`  Planilha: ${SPREADSHEET_ID}`);
    console.log(`  Aba: ${abaEspecifica}`);
    console.log(`  Ano: ${anoEspecifico}`);

    // Buscar todos os bares ativos
    const { data: todosOsBares } = await supabase
      .from('bars')
      .select('id, nome')
      .eq('ativo', true);

    if (!todosOsBares?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum bar ativo encontrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baresParaProcessar = bar_id 
      ? todosOsBares.filter(b => b.id === bar_id) 
      : todosOsBares;

    console.log(`📊 Processando ${baresParaProcessar.length} bar(es)...`);

    const resultadosPorBar: any[] = [];

    for (const bar of baresParaProcessar) {
      console.log(`\n🏪 ${bar.nome} (ID: ${bar.id})`);

      try {
        // Buscar credenciais do Google Sheets
        const { data: credenciais, error: credError } = await supabase
          .from('api_credentials')
          .select('configuracoes')
          .eq('sistema', 'google_sheets')
          .eq('bar_id', bar.id)
          .eq('ativo', true)
          .single();

        if (credError || !credenciais) {
          console.log(`⚠️ ${bar.nome}: Credenciais Google Sheets não encontradas`);
          resultadosPorBar.push({
            bar_id: bar.id,
            bar_nome: bar.nome,
            success: false,
            error: 'Credenciais Google Sheets não configuradas'
          });
          continue;
        }

        const config = credenciais.configuracoes || {};
        const clientEmail = config.client_email;
        const privateKey = config.private_key;
        // Usar planilha de orçamentação específica ou fallback para a planilha padrão de desempenho
        const spreadsheetId = config.orcamentacao_spreadsheet_id || SPREADSHEET_ID;

        if (!clientEmail || !privateKey) {
          console.log(`⚠️ ${bar.nome}: Service account não configurado`);
          resultadosPorBar.push({
            bar_id: bar.id,
            bar_nome: bar.nome,
            success: false,
            error: 'Service account não configurado'
          });
          continue;
        }

        // Autenticar com service account
        console.log(`🔑 Autenticando com service account...`);
        const accessToken = await obterAccessToken(clientEmail, privateKey);
        console.log(`✅ Autenticado!`);

        // Listar abas disponíveis
        const abas = await listarAbas(spreadsheetId, accessToken);
        console.log(`📋 Abas disponíveis: ${abas.map(a => a.title).join(', ')}`);

        // Encontrar aba de orçamentação
        const abaOrcamento = abas.find(a => 
          a.title.toLowerCase().includes('orcament') || 
          a.title.toLowerCase().includes('orçament') ||
          a.title.toLowerCase() === abaEspecifica.toLowerCase()
        );

        if (!abaOrcamento) {
          console.log(`⚠️ ${bar.nome}: Aba de orçamentação não encontrada`);
          resultadosPorBar.push({
            bar_id: bar.id,
            bar_nome: bar.nome,
            success: false,
            error: `Aba '${abaEspecifica}' não encontrada. Abas disponíveis: ${abas.map(a => a.title).join(', ')}`
          });
          continue;
        }

        // Buscar dados da aba - expandir range para incluir todas as colunas (até AZ)
        console.log(`📊 Buscando dados da aba "${abaOrcamento.title}"...`);
        const linhas = await buscarDadosSheets(`'${abaOrcamento.title}'!A1:AZ100`, spreadsheetId, accessToken);
        console.log(`📥 ${linhas.length} linhas encontradas, ${linhas[0]?.length || 0} colunas`);

        if (linhas.length < 2) {
          resultadosPorBar.push({
            bar_id: bar.id,
            bar_nome: bar.nome,
            success: false,
            error: 'Planilha vazia ou sem dados suficientes'
          });
          continue;
        }

        // Processar dados
        const { dados, colunasDebug } = processarPlanilhaComDebug(linhas, bar.id, anoEspecifico);
        console.log(`📊 ${dados.length} registros processados`);

        if (dados.length === 0) {
          resultadosPorBar.push({
            bar_id: bar.id,
            bar_nome: bar.nome,
            success: true,
            registros: 0,
            mensagem: 'Nenhum dado de orçamentação encontrado na planilha',
            aba_usada: abaOrcamento.title,
            total_linhas: linhas.length
          });
          continue;
        }

        // Upsert no banco
        let inseridos = 0;
        let erros = 0;

        for (const dado of dados) {
          // Construir objeto de upsert
          const upsertData: Record<string, any> = {
            bar_id: dado.bar_id,
            ano: dado.ano,
            mes: dado.mes,
            categoria_nome: dado.categoria_nome,
            subcategoria: '',  // String vazia ao invés de null para o constraint funcionar
            valor_planejado: dado.valor_planejado,
            tipo: dado.tipo,
            atualizado_em: new Date().toISOString()
          };

          // Adicionar valor_realizado se existir (para RECEITA BRUTA)
          if (dado.valor_realizado !== undefined) {
            upsertData.valor_realizado = dado.valor_realizado;
          }

          const { error } = await supabase
            .from('orcamentacao')
            .upsert(upsertData, {
              onConflict: 'bar_id,ano,mes,categoria_nome,subcategoria',
              ignoreDuplicates: false  // Atualizar se existir
            });

          if (error) {
            console.error(`❌ Erro ao inserir ${dado.categoria_nome} ${dado.mes}/${dado.ano}:`, error.message);
            erros++;
          } else {
            inseridos++;
          }
        }

        console.log(`✅ ${bar.nome}: ${inseridos} registros sincronizados, ${erros} erros`);
        resultadosPorBar.push({
          bar_id: bar.id,
          bar_nome: bar.nome,
          success: true,
          registros: inseridos,
          erros,
          categorias: [...new Set(dados.map(d => d.categoria_nome))].slice(0, 10)
        });

      } catch (e: any) {
        console.error(`❌ ${bar.nome}:`, e.message);
        resultadosPorBar.push({
          bar_id: bar.id,
          bar_nome: bar.nome,
          success: false,
          error: e.message
        });
      }
    }

    // Registrar log de sync (ignora erro se tabela não existir)
    try {
      await supabase
        .from('sync_logs')
        .insert({
          tipo: 'orcamentacao_sheets',
          status: 'sucesso',
          detalhes: { resultados_por_bar: resultadosPorBar },
          created_at: new Date().toISOString()
        });
    } catch (e) {
      console.log('Nota: Tabela sync_logs não existe ou erro ao inserir');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Orçamentação sincronizada do Google Sheets',
        resultados_por_bar: resultadosPorBar,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
