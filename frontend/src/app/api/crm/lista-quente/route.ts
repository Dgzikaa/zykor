import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Dias da semana em português
const diasSemanaMap: Record<number, string> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terca',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sabado'
};

const diasSemanaLabels: Record<string, string> = {
  'domingo': 'Domingo',
  'segunda': 'Segunda-feira',
  'terca': 'Terça-feira',
  'quarta': 'Quarta-feira',
  'quinta': 'Quinta-feira',
  'sexta': 'Sexta-feira',
  'sabado': 'Sábado'
};

// Interface para os critérios de segmentação
interface CriteriosSegmentacao {
  // Janela de análise
  diasJanela: number;
  
  // Filtro por semana ISO (novo!)
  semanaAno?: number; // Ex: 2026
  semanaNumero?: number; // Ex: 12 (semana 12)
  
  // Frequência
  minVisitasTotal: number;
  maxVisitasTotal?: number;
  minVisitasDia: number;
  
  // Dia da semana
  diaSemana?: string;
  diasDiferentes?: number; // Multi-dia: cliente vai em X+ dias diferentes
  
  // Financeiros
  ticketMedioMin?: number;
  ticketMedioMax?: number;
  ticketEntradaMin?: number;
  ticketEntradaMax?: number;
  ticketConsumoMin?: number;
  ticketConsumoMax?: number;
  gastoTotalMin?: number;
  gastoTotalMax?: number;
  
  // Recência
  ultimaVisitaMinDias?: number; // Mínimo de dias desde última visita (para inativos)
  ultimaVisitaMaxDias?: number; // Máximo de dias desde última visita (para ativos recentes)
  primeiraVisitaMaxDias?: number; // Cliente novo: primeira visita nos últimos X dias
  
  // Perfil Social
  tamanhoGrupoMin?: number;
  tamanhoGrupoMax?: number;
  
  // Perfil de Consumo (percentuais)
  percentualEntradaMin?: number; // % do gasto que é entrada
  percentualConsumoMin?: number; // % do gasto que é consumo
  
  // Contato
  temEmail?: boolean;
  temTelefone?: boolean;
  
  // Aniversário
  mesAniversario?: number; // 1-12 para filtrar por mês de aniversário
}

// Função para obter data em timezone de Brasília (UTC-3)
function getHojeBrasilia(): Date {
  // Brasília está em UTC-3 (180 minutos atrás de UTC)
  // getTimezoneOffset() retorna minutos que devemos ADICIONAR ao horário local para obter UTC
  // Para Brasília: queremos UTC - 3 horas = UTC - 180 minutos
  
  const agora = new Date();
  const offsetUTC = agora.getTimezoneOffset(); // Ex: 0 para UTC, 180 para UTC-3
  const offsetBrasilia = 180; // Brasília está 180 minutos atrás de UTC (UTC-3)
  
  // Ajustar para Brasília
  const diffMinutos = offsetBrasilia - offsetUTC;
  return new Date(agora.getTime() - diffMinutos * 60 * 1000);
}

// Função para calcular início e fim de uma semana ISO
function getWeekDates(ano: number, semana: number): { inicio: string; fim: string } {
  // 4 de janeiro sempre está na primeira semana ISO
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Domingo = 7
  
  // Encontrar a primeira segunda-feira do ano ISO
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  
  // Calcular início da semana desejada
  const weekStart = new Date(firstMonday);
  weekStart.setUTCDate(firstMonday.getUTCDate() + (semana - 1) * 7);
  
  // Fim da semana (domingo)
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  
  return {
    inicio: weekStart.toISOString().split('T')[0],
    fim: weekEnd.toISOString().split('T')[0],
  };
}

// Função para obter número da semana ISO atual
function getCurrentWeekNumber(): { semana: number; ano: number } {
  const hoje = getHojeBrasilia();
  const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { semana, ano: d.getUTCFullYear() };
}

// Função para buscar dados com paginação
async function fetchAllData(supabase: any, tableName: string, columns: string, filters: any = {}) {
  let allData: any[] = [];
  let from = 0;
  const limit = 1000;
  const MAX_ITERATIONS = 200;
  let iterations = 0;
  
  while (iterations < MAX_ITERATIONS) {
    iterations++;
    
    let query = supabase
      .from(tableName)
      .select(columns)
      .range(from, from + limit - 1);
    
    Object.entries(filters).forEach(([key, value]) => {
      if (key.includes('gte_')) {
        query = query.gte(key.replace('gte_', ''), value);
      } else if (key.includes('lte_')) {
        query = query.lte(key.replace('lte_', ''), value);
      } else if (key.includes('eq_')) {
        query = query.eq(key.replace('eq_', ''), value);
      }
    });
    
    const { data, error } = await query;
    
    if (error) {
      console.error(`❌ Erro ao buscar ${tableName}:`, error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allData.push(...data);
    
    if (data.length < limit) break;
    
    from += limit;
  }
  
  return allData;
}

// Função para normalizar telefone
function normalizarTelefone(telefone: string | null): string {
  if (!telefone) return '';
  return telefone.replace(/\D/g, '').slice(-9);
}

// Função para extrair nome
function extrairNome(registro: any): string {
  const nome = registro.cliente_nome || '';
  if (!nome || nome.trim() === '') return '';
  return nome.trim()
    .toLowerCase()
    .split(' ')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Interface para cliente processado
interface ClienteProcessado {
  nome: string;
  email: string;
  telefone: string;
  telefoneNorm: string;
  dataAniversario: Date | null;
  visitas: { data: Date; entrada: number; consumo: number; total: number; pessoas: number }[];
  diasSemana: Record<string, number>;
  primeiraVisita: Date | null;
  ultimaVisita: Date | null;
  totalGasto: number;
  totalEntrada: number;
  totalConsumo: number;
  ticketMedio: number;
  ticketEntrada: number;
  ticketConsumo: number;
  mediaPessoas: number;
  diasDiferentesFrequentados: number;
  percentualEntrada: number;
  percentualConsumo: number;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    // Parâmetros básicos
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const formatoParam = searchParams.get('formato') || 'json';
    const apenasResumo = searchParams.get('apenas_resumo') === 'true';
    
    // Extrair todos os critérios
    const criterios: CriteriosSegmentacao = {
      diasJanela: parseInt(searchParams.get('dias_janela') || '90'),
      semanaAno: searchParams.get('semana_ano') ? parseInt(searchParams.get('semana_ano')!) : undefined,
      semanaNumero: searchParams.get('semana_numero') ? parseInt(searchParams.get('semana_numero')!) : undefined,
      minVisitasTotal: parseInt(searchParams.get('min_visitas_total') || '2'),
      maxVisitasTotal: searchParams.get('max_visitas_total') ? parseInt(searchParams.get('max_visitas_total')!) : undefined,
      minVisitasDia: parseInt(searchParams.get('min_visitas_dia') || '1'),
      diaSemana: searchParams.get('dia_semana') || undefined,
      diasDiferentes: searchParams.get('dias_diferentes') ? parseInt(searchParams.get('dias_diferentes')!) : undefined,
      ticketMedioMin: searchParams.get('ticket_medio_min') ? parseFloat(searchParams.get('ticket_medio_min')!) : undefined,
      ticketMedioMax: searchParams.get('ticket_medio_max') ? parseFloat(searchParams.get('ticket_medio_max')!) : undefined,
      ticketEntradaMin: searchParams.get('ticket_entrada_min') ? parseFloat(searchParams.get('ticket_entrada_min')!) : undefined,
      ticketEntradaMax: searchParams.get('ticket_entrada_max') ? parseFloat(searchParams.get('ticket_entrada_max')!) : undefined,
      ticketConsumoMin: searchParams.get('ticket_consumo_min') ? parseFloat(searchParams.get('ticket_consumo_min')!) : undefined,
      ticketConsumoMax: searchParams.get('ticket_consumo_max') ? parseFloat(searchParams.get('ticket_consumo_max')!) : undefined,
      gastoTotalMin: searchParams.get('gasto_total_min') ? parseFloat(searchParams.get('gasto_total_min')!) : undefined,
      gastoTotalMax: searchParams.get('gasto_total_max') ? parseFloat(searchParams.get('gasto_total_max')!) : undefined,
      ultimaVisitaMinDias: searchParams.get('ultima_visita_min_dias') ? parseInt(searchParams.get('ultima_visita_min_dias')!) : undefined,
      ultimaVisitaMaxDias: searchParams.get('ultima_visita_max_dias') ? parseInt(searchParams.get('ultima_visita_max_dias')!) : undefined,
      primeiraVisitaMaxDias: searchParams.get('primeira_visita_max_dias') ? parseInt(searchParams.get('primeira_visita_max_dias')!) : undefined,
      tamanhoGrupoMin: searchParams.get('tamanho_grupo_min') ? parseFloat(searchParams.get('tamanho_grupo_min')!) : undefined,
      tamanhoGrupoMax: searchParams.get('tamanho_grupo_max') ? parseFloat(searchParams.get('tamanho_grupo_max')!) : undefined,
      percentualEntradaMin: searchParams.get('percentual_entrada_min') ? parseFloat(searchParams.get('percentual_entrada_min')!) : undefined,
      percentualConsumoMin: searchParams.get('percentual_consumo_min') ? parseFloat(searchParams.get('percentual_consumo_min')!) : undefined,
      temEmail: searchParams.get('tem_email') === 'true' ? true : (searchParams.get('tem_email') === 'false' ? false : undefined),
      temTelefone: searchParams.get('tem_telefone') === 'true' ? true : (searchParams.get('tem_telefone') === 'false' ? false : undefined),
      mesAniversario: searchParams.get('mes_aniversario') ? parseInt(searchParams.get('mes_aniversario')!) : undefined,
    };

    // Usar timezone de Brasília para cálculos de data
    const hojeBrasilia = getHojeBrasilia();
    
    // Calcular data limite baseado na janela OU semana específica
    let dataLimiteStr: string;
    let dataFimStr: string | undefined;
    let filtrandoPorSemana = false;
    
    if (criterios.semanaAno && criterios.semanaNumero) {
      // Filtrar por semana específica
      const { inicio, fim } = getWeekDates(criterios.semanaAno, criterios.semanaNumero);
      dataLimiteStr = inicio;
      dataFimStr = fim;
      filtrandoPorSemana = true;
    } else {
      // Usar janela de dias
      const dataLimite = new Date(hojeBrasilia);
      dataLimite.setDate(hojeBrasilia.getDate() - criterios.diasJanela);
      dataLimiteStr = dataLimite.toISOString().split('T')[0];
    }
    
    // Buscar todos os registros com dados completos
    const filtros: Record<string, any> = {
      'eq_bar_id': barId,
      'gte_data_visita': dataLimiteStr
    };
    
    // Se filtrando por semana, adicionar limite de data_fim
    if (filtrandoPorSemana && dataFimStr) {
      filtros['lte_data_visita'] = dataFimStr;
    }
    
    const todosRegistros = await fetchAllData(
      supabase,
      'visitas',
      'cliente_nome, cliente_email, cliente_fone, cliente_dtnasc, data_visita, valor_couvert, valor_pagamentos, pessoas',
      filtros
    );

    // Mapear clientes únicos por telefone normalizado OU por nome (para quem não tem telefone)
    const clientesMap = new Map<string, ClienteProcessado>();
    let registrosSemIdentificador = 0;
    let registrosComTelefone = 0;
    let registrosSemTelefone = 0;
    
    todosRegistros.forEach(registro => {
      const telefoneNorm = normalizarTelefone(registro.cliente_fone);
      const nomeRegistro = (registro.cliente_nome || '').trim().toLowerCase();
      
      // Usar telefone como chave principal, ou nome normalizado como fallback
      let chaveCliente = '';
      if (telefoneNorm && telefoneNorm.length >= 8) {
        chaveCliente = `tel_${telefoneNorm}`;
        registrosComTelefone++;
      } else if (nomeRegistro && nomeRegistro.length > 2) {
        // Usar nome como fallback para clientes sem telefone
        chaveCliente = `nome_${nomeRegistro}`;
        registrosSemTelefone++;
      } else {
        // Ignorar registros sem identificador válido
        registrosSemIdentificador++;
        return;
      }
      
      const nome = extrairNome(registro);
      const email = registro.cliente_email || '';
      const telefone = registro.cliente_fone || '';
      const entrada = parseFloat(registro.valor_couvert || 0);
      const pagamentos = parseFloat(registro.valor_pagamentos || 0);
      const consumo = pagamentos - entrada;
      const pessoas = parseFloat(registro.pessoas || 1);
      const dataVisita = new Date(registro.data_visita + 'T12:00:00Z');
      
      // Data de nascimento (coluna cliente_dtnasc — se existir na tabela)
      const dataNascimento = registro.cliente_dtnasc ? new Date(registro.cliente_dtnasc + 'T12:00:00Z') : null;
      
      if (!clientesMap.has(chaveCliente)) {
        clientesMap.set(chaveCliente, {
          nome: nome || 'Cliente',
          email: email,
          telefone: telefone,
          telefoneNorm: telefoneNorm,
          dataAniversario: dataNascimento,
          visitas: [],
          diasSemana: { 'domingo': 0, 'segunda': 0, 'terca': 0, 'quarta': 0, 'quinta': 0, 'sexta': 0, 'sabado': 0 },
          primeiraVisita: null,
          ultimaVisita: null,
          totalGasto: 0,
          totalEntrada: 0,
          totalConsumo: 0,
          ticketMedio: 0,
          ticketEntrada: 0,
          ticketConsumo: 0,
          mediaPessoas: 0,
          diasDiferentesFrequentados: 0,
          percentualEntrada: 0,
          percentualConsumo: 0,
        });
      }
      
      const cliente = clientesMap.get(chaveCliente)!;
      
      // Atualizar dados básicos
      if (cliente.nome === 'Cliente' && nome) cliente.nome = nome;
      if (!cliente.email && email) cliente.email = email;
      if (!cliente.telefone && telefone) cliente.telefone = telefone;
      if (!cliente.dataAniversario && dataNascimento) cliente.dataAniversario = dataNascimento;
      
      // Registrar visita
      cliente.visitas.push({ data: dataVisita, entrada, consumo, total: pagamentos, pessoas });
      
      // Contar dia da semana
      const diaSemanaNum = dataVisita.getUTCDay();
      const diaSemana = diasSemanaMap[diaSemanaNum];
      cliente.diasSemana[diaSemana]++;
      
      // Atualizar totais
      cliente.totalGasto += pagamentos;
      cliente.totalEntrada += entrada;
      cliente.totalConsumo += consumo;
      
      // Atualizar datas
      if (!cliente.primeiraVisita || dataVisita < cliente.primeiraVisita) {
        cliente.primeiraVisita = dataVisita;
      }
      if (!cliente.ultimaVisita || dataVisita > cliente.ultimaVisita) {
        cliente.ultimaVisita = dataVisita;
      }
    });
    
    // Calcular métricas derivadas para cada cliente
    clientesMap.forEach(cliente => {
      const totalVisitas = cliente.visitas.length;
      if (totalVisitas > 0) {
        cliente.ticketMedio = cliente.totalGasto / totalVisitas;
        cliente.ticketEntrada = cliente.totalEntrada / totalVisitas;
        cliente.ticketConsumo = cliente.totalConsumo / totalVisitas;
        cliente.mediaPessoas = cliente.visitas.reduce((sum, v) => sum + v.pessoas, 0) / totalVisitas;
        cliente.diasDiferentesFrequentados = Object.values(cliente.diasSemana).filter(v => v > 0).length;
        cliente.percentualEntrada = cliente.totalGasto > 0 ? (cliente.totalEntrada / cliente.totalGasto) * 100 : 0;
        cliente.percentualConsumo = cliente.totalGasto > 0 ? (cliente.totalConsumo / cliente.totalGasto) * 100 : 0;
      }
    });

    // Aplicar todos os filtros
    let clientesFiltrados = Array.from(clientesMap.values());
    
    // Filtro: Mínimo de visitas total
    clientesFiltrados = clientesFiltrados.filter(c => c.visitas.length >= criterios.minVisitasTotal);
    
    // Filtro: Máximo de visitas total
    if (criterios.maxVisitasTotal !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.visitas.length <= criterios.maxVisitasTotal!);
    }
    
    // Filtro: Dias diferentes frequentados
    if (criterios.diasDiferentes !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.diasDiferentesFrequentados >= criterios.diasDiferentes!);
    }
    
    // Filtro: Ticket Médio
    if (criterios.ticketMedioMin !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.ticketMedio >= criterios.ticketMedioMin!);
    }
    if (criterios.ticketMedioMax !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.ticketMedio <= criterios.ticketMedioMax!);
    }
    
    // Filtro: Ticket Entrada
    if (criterios.ticketEntradaMin !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.ticketEntrada >= criterios.ticketEntradaMin!);
    }
    if (criterios.ticketEntradaMax !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.ticketEntrada <= criterios.ticketEntradaMax!);
    }
    
    // Filtro: Ticket Consumo
    if (criterios.ticketConsumoMin !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.ticketConsumo >= criterios.ticketConsumoMin!);
    }
    if (criterios.ticketConsumoMax !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.ticketConsumo <= criterios.ticketConsumoMax!);
    }
    
    // Filtro: Gasto Total
    if (criterios.gastoTotalMin !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.totalGasto >= criterios.gastoTotalMin!);
    }
    if (criterios.gastoTotalMax !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.totalGasto <= criterios.gastoTotalMax!);
    }
    
    // Filtro: Recência - última visita (usando meia-noite de Brasília para consistência)
    if (criterios.ultimaVisitaMinDias !== undefined) {
      // Cliente inativo: última visita há mais de X dias
      // Usar início do dia (meia-noite) para corte preciso
      const hojeBrasiliaCorte = getHojeBrasilia();
      hojeBrasiliaCorte.setHours(0, 0, 0, 0);
      const dataCorte = new Date(hojeBrasiliaCorte);
      dataCorte.setDate(dataCorte.getDate() - criterios.ultimaVisitaMinDias);
      clientesFiltrados = clientesFiltrados.filter(c => c.ultimaVisita && c.ultimaVisita < dataCorte);
    }
    if (criterios.ultimaVisitaMaxDias !== undefined) {
      // Cliente recente: última visita nos últimos X dias
      // Usar início do dia (meia-noite) para corte preciso
      const hojeBrasiliaCorte = getHojeBrasilia();
      hojeBrasiliaCorte.setHours(0, 0, 0, 0);
      const dataCorte = new Date(hojeBrasiliaCorte);
      dataCorte.setDate(dataCorte.getDate() - criterios.ultimaVisitaMaxDias);
      clientesFiltrados = clientesFiltrados.filter(c => c.ultimaVisita && c.ultimaVisita >= dataCorte);
    }
    
    // Filtro: Cliente Novo (primeira visita nos últimos X dias)
    if (criterios.primeiraVisitaMaxDias !== undefined) {
      const hojeBrasiliaCorte = getHojeBrasilia();
      hojeBrasiliaCorte.setHours(0, 0, 0, 0);
      const dataCorte = new Date(hojeBrasiliaCorte);
      dataCorte.setDate(dataCorte.getDate() - criterios.primeiraVisitaMaxDias);
      clientesFiltrados = clientesFiltrados.filter(c => c.primeiraVisita && c.primeiraVisita >= dataCorte);
    }
    
    // Filtro: Tamanho do grupo
    if (criterios.tamanhoGrupoMin !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.mediaPessoas >= criterios.tamanhoGrupoMin!);
    }
    if (criterios.tamanhoGrupoMax !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.mediaPessoas <= criterios.tamanhoGrupoMax!);
    }
    
    // Filtro: Percentual de entrada/consumo
    if (criterios.percentualEntradaMin !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.percentualEntrada >= criterios.percentualEntradaMin!);
    }
    if (criterios.percentualConsumoMin !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => c.percentualConsumo >= criterios.percentualConsumoMin!);
    }
    
    // Filtro: Tem email/telefone
    if (criterios.temEmail === true) {
      clientesFiltrados = clientesFiltrados.filter(c => c.email && c.email.includes('@'));
    }
    if (criterios.temTelefone === true) {
      clientesFiltrados = clientesFiltrados.filter(c => c.telefone && c.telefone.length >= 8);
    }
    
    // Filtro: Mês de aniversário
    if (criterios.mesAniversario !== undefined) {
      clientesFiltrados = clientesFiltrados.filter(c => {
        if (!c.dataAniversario) return false;
        const mesAniversario = new Date(c.dataAniversario).getMonth() + 1; // getMonth() retorna 0-11
        return mesAniversario === criterios.mesAniversario;
      });
    }

    // Se foi especificado um dia da semana, filtrar por ele
    if (criterios.diaSemana) {
      const diaNormalizado = criterios.diaSemana.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace('-feira', '');
      
      clientesFiltrados = clientesFiltrados.filter(c => c.diasSemana[diaNormalizado] >= criterios.minVisitasDia);
      
      // Ordenar por número de visitas no dia
      clientesFiltrados.sort((a, b) => b.diasSemana[diaNormalizado] - a.diasSemana[diaNormalizado]);
      
      const listaExportacao = clientesFiltrados.map(cliente => ({
        Nome: cliente.nome,
        Email: cliente.email,
        Telefone: cliente.telefone,
        Aniversario: cliente.dataAniversario ? cliente.dataAniversario.toISOString().split('T')[0] : '',
        VisitasNoDia: cliente.diasSemana[diaNormalizado],
        TotalVisitas: cliente.visitas.length,
        TicketMedio: Math.round(cliente.ticketMedio * 100) / 100,
        GastoTotal: Math.round(cliente.totalGasto * 100) / 100,
        MediaPessoas: Math.round(cliente.mediaPessoas * 10) / 10,
        UltimaVisita: cliente.ultimaVisita?.toISOString().split('T')[0] || '',
      }));
      
      // Retornar CSV se solicitado
      if (formatoParam === 'csv') {
        const csvHeader = 'Nome,Email,Telefone,Aniversario\n';
        const csvRows = listaExportacao.map(c => 
          `"${c.Nome}","${c.Email}","${c.Telefone}","${c.Aniversario}"`
        ).join('\n');
        
        return new NextResponse(csvHeader + csvRows, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="segmento-${diaNormalizado}-${hojeBrasilia.toISOString().split('T')[0]}.csv"`
          }
        });
      }
      
      // CSV Completo
      if (formatoParam === 'csv_completo') {
        const csvHeader = 'Nome,Email,Telefone,Aniversario,VisitasNoDia,TotalVisitas,TicketMedio,GastoTotal,MediaPessoas,UltimaVisita\n';
        const csvRows = listaExportacao.map(c => 
          `"${c.Nome}","${c.Email}","${c.Telefone}","${c.Aniversario}",${c.VisitasNoDia},${c.TotalVisitas},${c.TicketMedio},${c.GastoTotal},${c.MediaPessoas},"${c.UltimaVisita}"`
        ).join('\n');
        
        return new NextResponse(csvHeader + csvRows, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="segmento-completo-${diaNormalizado}-${hojeBrasilia.toISOString().split('T')[0]}.csv"`
          }
        });
      }
      
      return NextResponse.json({
        success: true,
        data: {
          diaSemana: diasSemanaLabels[diaNormalizado] || diaNormalizado,
          criteriosAplicados: criterios,
          totalClientes: listaExportacao.length,
          clientes: listaExportacao
        }
      });
    }
    
    // Se apenas resumo, retornar resumo por dia da semana
    // MAS se formato é CSV, exportar todos os clientes sem filtro de dia
    if (!criterios.diaSemana && (formatoParam === 'csv' || formatoParam === 'csv_completo')) {
      // Ordenar por total de visitas
      clientesFiltrados.sort((a, b) => b.visitas.length - a.visitas.length);
      
      const listaExportacao = clientesFiltrados.map(cliente => ({
        Nome: cliente.nome,
        Email: cliente.email,
        Telefone: cliente.telefone,
        Aniversario: cliente.dataAniversario ? cliente.dataAniversario.toISOString().split('T')[0] : '',
        TotalVisitas: cliente.visitas.length,
        TicketMedio: Math.round(cliente.ticketMedio * 100) / 100,
        GastoTotal: Math.round(cliente.totalGasto * 100) / 100,
        MediaPessoas: Math.round(cliente.mediaPessoas * 10) / 10,
        UltimaVisita: cliente.ultimaVisita?.toISOString().split('T')[0] || '',
        DiasFrequentados: cliente.diasDiferentesFrequentados,
      }));
      
      if (formatoParam === 'csv') {
        const csvHeader = 'Nome,Email,Telefone,Aniversario\n';
        const csvRows = listaExportacao.map(c => 
          `"${c.Nome}","${c.Email}","${c.Telefone}","${c.Aniversario}"`
        ).join('\n');
        
        return new NextResponse(csvHeader + csvRows, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="lista-clientes-${hojeBrasilia.toISOString().split('T')[0]}.csv"`
          }
        });
      }
      
      // CSV Completo
      if (formatoParam === 'csv_completo') {
        const csvHeader = 'Nome,Email,Telefone,Aniversario,TotalVisitas,TicketMedio,GastoTotal,MediaPessoas,UltimaVisita,DiasFrequentados\n';
        const csvRows = listaExportacao.map(c => 
          `"${c.Nome}","${c.Email}","${c.Telefone}","${c.Aniversario}",${c.TotalVisitas},${c.TicketMedio},${c.GastoTotal},${c.MediaPessoas},"${c.UltimaVisita}",${c.DiasFrequentados}`
        ).join('\n');
        
        return new NextResponse(csvHeader + csvRows, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="lista-clientes-completa-${hojeBrasilia.toISOString().split('T')[0]}.csv"`
          }
        });
      }
    }
    
    if (apenasResumo || !criterios.diaSemana) {
      const resumoPorDia: Record<string, any> = {};
      
      // Calcular total de clientes por dia SEM filtros (apenas com janela de tempo)
      const todosClientesSemFiltros = Array.from(clientesMap.values());
      
      // Encontrar a última data de cada dia da semana na janela
      const ultimaDataPorDia: Record<string, Date | null> = {};
      Object.keys(diasSemanaLabels).forEach(dia => {
        const diaSemanaNum = Object.keys(diasSemanaMap).find(k => diasSemanaMap[parseInt(k)] === dia);
        if (diaSemanaNum) {
          const datasDoDia = todosRegistros
            .filter(r => new Date(r.data_visita + 'T12:00:00Z').getUTCDay() === parseInt(diaSemanaNum))
            .map(r => new Date(r.data_visita + 'T12:00:00Z'));
          ultimaDataPorDia[dia] = datasDoDia.length > 0 ? new Date(Math.max(...datasDoDia.map(d => d.getTime()))) : null;
        }
      });
      
      Object.keys(diasSemanaLabels).forEach(dia => {
        // Clientes que foram no dia (sem filtros de segmentação)
        const todosClientesDoDia = todosClientesSemFiltros.filter(c => c.diasSemana[dia] >= 1);
        
        // Clientes que foram especificamente na última ocorrência do dia
        const ultimaData = ultimaDataPorDia[dia];
        const clientesUltimaOcorrencia = ultimaData 
          ? todosClientesSemFiltros.filter(c => 
              c.visitas.some(v => 
                v.data.toISOString().split('T')[0] === ultimaData.toISOString().split('T')[0]
              )
            )
          : [];
        
        // Clientes que foram no dia E passam pelos filtros de segmentação
        const clientesDoDia = clientesFiltrados.filter(c => c.diasSemana[dia] >= criterios.minVisitasDia);
        clientesDoDia.sort((a, b) => b.diasSemana[dia] - a.diasSemana[dia]);
        
        resumoPorDia[dia] = {
          label: diasSemanaLabels[dia],
          totalClientes: clientesDoDia.length, // Clientes filtrados
          totalClientesSemFiltro: todosClientesDoDia.length, // Total sem filtros (qualquer ocorrência)
          totalClientesUltimaOcorrencia: clientesUltimaOcorrencia.length, // NOVO: Clientes da última vez
          ultimaOcorrencia: ultimaData ? ultimaData.toISOString().split('T')[0] : null,
          ticketMedioSegmento: clientesDoDia.length > 0 
            ? Math.round(clientesDoDia.reduce((sum, c) => sum + c.ticketMedio, 0) / clientesDoDia.length) 
            : 0,
          gastoTotalSegmento: Math.round(clientesDoDia.reduce((sum, c) => sum + c.totalGasto, 0)),
          exemplos: clientesDoDia.slice(0, 3).map(c => ({
            nome: c.nome,
            visitas: c.diasSemana[dia],
            ticketMedio: Math.round(c.ticketMedio)
          }))
        };
      });
      
      // Estatísticas gerais do segmento
      const estatisticas = {
        totalClientes: clientesFiltrados.length,
        ticketMedioGeral: clientesFiltrados.length > 0 
          ? Math.round(clientesFiltrados.reduce((sum, c) => sum + c.ticketMedio, 0) / clientesFiltrados.length) 
          : 0,
        gastoTotalGeral: Math.round(clientesFiltrados.reduce((sum, c) => sum + c.totalGasto, 0)),
        visitasMedias: clientesFiltrados.length > 0 
          ? Math.round(clientesFiltrados.reduce((sum, c) => sum + c.visitas.length, 0) / clientesFiltrados.length * 10) / 10 
          : 0,
        comEmail: clientesFiltrados.filter(c => c.email && c.email.includes('@')).length,
        comTelefone: clientesFiltrados.filter(c => c.telefone && c.telefone.length >= 8).length,
      };
      
      return NextResponse.json({
        success: true,
        data: {
          criteriosAplicados: criterios,
          dataLimite: dataLimiteStr,
          estatisticas,
          resumoPorDia,
          criteriosDisponiveis: {
            frequencia: {
              dias_janela: 'Janela de análise em dias (padrão: 90)',
              min_visitas_total: 'Mínimo de visitas totais (padrão: 2)',
              max_visitas_total: 'Máximo de visitas totais',
              min_visitas_dia: 'Mínimo de visitas no dia específico (padrão: 1)',
              dias_diferentes: 'Mínimo de dias diferentes frequentados',
            },
            financeiros: {
              ticket_medio_min: 'Ticket médio mínimo (R$)',
              ticket_medio_max: 'Ticket médio máximo (R$)',
              ticket_entrada_min: 'Ticket entrada mínimo (R$)',
              ticket_entrada_max: 'Ticket entrada máximo (R$)',
              ticket_consumo_min: 'Ticket consumo mínimo (R$)',
              ticket_consumo_max: 'Ticket consumo máximo (R$)',
              gasto_total_min: 'Gasto total mínimo (R$)',
              gasto_total_max: 'Gasto total máximo (R$)',
            },
            recencia: {
              ultima_visita_min_dias: 'Última visita há pelo menos X dias (para inativos)',
              ultima_visita_max_dias: 'Última visita há no máximo X dias (para ativos)',
              primeira_visita_max_dias: 'Primeira visita nos últimos X dias (clientes novos)',
            },
            perfilSocial: {
              tamanho_grupo_min: 'Tamanho médio do grupo mínimo',
              tamanho_grupo_max: 'Tamanho médio do grupo máximo',
            },
            contato: {
              tem_email: 'true/false - Filtrar por ter email',
              tem_telefone: 'true/false - Filtrar por ter telefone',
            },
            dia: {
              dia_semana: 'segunda, terca, quarta, quinta, sexta, sabado, domingo',
            },
            formato: {
              formato: 'json (padrão), csv (simples), csv_completo (todos os campos)',
              apenas_resumo: 'true/false - Retorna apenas resumo por dia',
            }
          }
        }
      });
    }
    
  } catch (error: any) {
    console.error('❌ Erro na API de segmentação:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao gerar segmentação' },
      { status: 500 }
    );
  }
}

// POST para salvar segmentos personalizados
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await request.json();
    
    const { bar_id, nome_segmento, descricao, criterios } = body;
    
    if (!bar_id || !nome_segmento || !criterios) {
      return NextResponse.json(
        { success: false, error: 'bar_id, nome_segmento e criterios são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Salvar o segmento na tabela crm_segmentacao
    const { data, error } = await supabase
      .from('crm_segmentacao')
      .insert({
        bar_id,
        nome: nome_segmento,
        descricao: descricao || '',
        criterios: criterios,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erro ao salvar segmento:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar segmento: ' + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        segmento: data,
        mensagem: `Segmento "${nome_segmento}" salvo com sucesso!`
      }
    });
    
  } catch (error: any) {
    console.error('❌ Erro ao salvar segmento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao salvar segmento' },
      { status: 500 }
    );
  }
}

// GET para listar segmentos salvos (quando chamado com ?listar_segmentos=true)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    const segmentoId = searchParams.get('id');
    const barId = searchParams.get('bar_id');
    
    if (!segmentoId || !barId) {
      return NextResponse.json(
        { success: false, error: 'id e bar_id são obrigatórios' },
        { status: 400 }
      );
    }
    
    const { error } = await supabase
      .from('crm_segmentacao')
      .delete()
      .eq('id', segmentoId)
      .eq('bar_id', barId);
    
    if (error) {
      return NextResponse.json(
        { success: false, error: 'Erro ao deletar segmento: ' + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      mensagem: 'Segmento deletado com sucesso'
    });
    
  } catch (error: any) {
    console.error('❌ Erro ao deletar segmento:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao deletar segmento' },
      { status: 500 }
    );
  }
}
