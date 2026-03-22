import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

// Dados históricos de fevereiro a junho 2025
const eventosHistoricos = `
01/02	SÁBADO		Soft Família - 100 pessoas
02/02	DOMINGO		FOLGA DOMINGO
03/02	SEGUNDA		FECHADO
04/02	TERÇA		Soft - 80 pessoas
05/02	QUARTA		Soft - 200 pessoas - Samba do Breno
06/02	QUINTA		Soft - 120 pessoas - DJ Umiranda
07/02	SEXTA		Soft - 200 pessoas - Samba dos Amigos
08/02	SÁBADO		Soft - 300 pessoas - DJs Variados
09/02	DOMINGO		FECHADO DOMINGO
10/02	SEGUNDA		FECHADO
11/02	TERÇA		DJs - Imprensa (DJ)
12/02	QUARTA		Quarta de Bamba - Breno Alves (Samba)
13/02	QUINTA		Black music (DJ)
14/02	SEXTA		Samba das Dez (Samba)
15/02	SÁBADO		DJs - Hugo drop + convidados (DJ)
16/02	DOMINGO		Pagode do Ordi - Atração Surpresa (12 por 8) (Pagode)
17/02	SEGUNDA		FECHADO
18/02	TERÇA		Caramelo Jazz Night (Jazz)
19/02	QUARTA		Quarta de Bamba - Breno Alves (Samba)
20/02	QUINTA		Discolate (DJ)
21/02	SEXTA		Pagode Vira-lata (Pagode)
22/02	SÁBADO		MSN - Musica só nostálgica (DJ)
23/02	DOMINGO		Braslidades (DJ)
24/02	SEGUNDA		FECHADO
25/02	TERÇA		Caramelo Jazz Night (Jazz)
26/02	QUARTA		Quarta de Bamba - Breno Alves (Samba)
27/02	QUINTA		Discolate (DJ)
28/02	SEXTA		Samba das Dez (Samba)

01/03	SÁBADO		CARNAVAL - Bloco MSN Umiranda (Carnaval)
02/03	DOMINGO		CARNAVAL - Pagode Vira lata Doze por Oito (Carnaval)
03/03	SEGUNDA		CARNAVAL - Macetada Caramelo (Carnaval)
04/03	TERÇA		CARNAVAL - Volto pro Eixo (Carnaval)
05/03	QUARTA		QUARTA FEIRA DE CINZAS
06/03	QUINTA		Discolate - 2 DJs Fortes - Hugo e Underlove (DJ)
07/03	SEXTA		Pagode Vira-Lata - Gigi (Pagode)
08/03	SÁBADO		Elas cantam o Brasil - Lithie (DJ)
09/03	DOMINGO		Algo simples - Brasilidades (DJ)
10/03	SEGUNDA		FECHADO
11/03	TERÇA		Caramelo Jazz Night (Jazz)
12/03	QUARTA		Quarta de Bamba - Breno Alves (Samba)
13/03	QUINTA		Discolate - 2 DJs Fortes - Hugo e Chicco (DJ)
14/03	SEXTA		Pagode Vira-lata - Dudu7 (Pagode)
15/03	SÁBADO		TBC (DJ)
16/03	DOMINGO		Algo simples (DJ)
17/03	SEGUNDA		FECHADO
18/03	TERÇA		Caramelo Jazz Night (Jazz)
19/03	QUARTA		Quarta de Bamba - Breno Alves (Samba)
20/03	QUINTA		Marvin canta + DJs (DJ)
21/03	SEXTA		Pagode Vira-lata - Benza (Pagode)
22/03	SÁBADO		R&Baile -  Laady B + Umiranda + Israel Paixão (DJ)
23/03	DOMINGO		Uma Mesa e Um Pagode (Pagode)
24/03	SEGUNDA		Dia D - Pagode do Duzo v1 (Especial)
25/03	TERÇA		Brasil x Argentina (DJ)
26/03	QUARTA		Quarta de Bamba - Breno Alves (Samba)
27/03	QUINTA		Discolate - Dj Hugo Drop e Chicco Aquino (DJ)
28/03	SEXTA		Pagode Vira-lata com Tonzão (Pagode)
29/03	SÁBADO		Perro Caliente - Noite de música latina com Cubanos + Dj Pequi e convidados (DJ)
30/03	DOMINGO		Algo simples (DJ)
31/03	SEGUNDA		FECHADO

01/04	TERÇA		Libertadores no telão (DJ)
02/04	QUARTA		Quarta de Bamba - Breno Alves (Samba)
03/04	QUINTA		Quinta de abril com BenzaDeus (Pagode)
04/04	SEXTA		Pagode Vira-lata - Dudu 7 - Divulgar: Toda semana (Pagode)
05/04	SÁBADO		Noite do MSN - Dj Tiago Jousef (DJ)
06/04	DOMINGO		Uma mesa e um pagode(Sympla) - Divulgar: 15 dias (Pagode)
07/04	SEGUNDA		FECHADO
08/04	TERÇA		Jogos de futebol - Kipecado (Pagode)
09/04	QUARTA		Quarta de Bamba - Breno Alves (Samba)
10/04	QUINTA		Quinta de abril com BenzaDeus (Pagode)
11/04	SEXTA		Pagode Vira-lata - Gigi - Divulgar: Toda semana (Pagode)
12/04	SÁBADO		Noite do MSN - Dj Tiago Jousef (DJ)
13/04	DOMINGO		Algo Simples (DJ)
14/04	SEGUNDA		FECHADO
15/04	TERÇA		Não tem futebol (DJ)
16/04	QUARTA		Quarta de Bamba - Breno Alves (Samba)
17/04	QUINTA		Quinta de abril com BenzaDeus (Pagode)
18/04	SEXTA		Pagode Vira-lata - Cris Maciel - Divulgar: Toda semana (Pagode)
19/04	SÁBADO		R&Baile - Umiranda & time (DJ)
20/04	DOMINGO		Uma Mesa e um Pagode - Véspera de Feriado (Pagode)
21/04	SEGUNDA		Feriado - aberto (DJ)
22/04	TERÇA		FECHADO
23/04	QUARTA		Quarta de Bamba - Breno Alves (Samba)
24/04	QUINTA		Quinta de abril com BenzaDeus (Pagode)
25/04	SEXTA		Pagode Vira-lata - Benzadeus/tonzão - Divulgar: Toda semana (Pagode)
26/04	SÁBADO		R&Baile - Umiranda & time (DJ)
27/04	DOMINGO		TBD - Um samba ou um Pagode - Doze? (Pagode)
28/04	SEGUNDA		FECHADO
29/04	TERÇA		FECHADO
30/04	QUARTA		Quarta de Bamba - Breno Alves | Véspera de Feriado (Samba)

01/05	QUINTA		Pagode do Trabalhador com Benza (Pagode)
02/05	SEXTA		Pagode Vira-lata - Madu (Pagode)
03/05	SÁBADO		R&Baile (DJ)
04/05	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
05/05	SEGUNDA		FECHADO
06/05	TERÇA		FECHADO
07/05	QUARTA		Quarta de Bamba (Samba)
08/05	QUINTA		R&Baile (DJ)
09/05	SEXTA		Pagode Vira Lata - PAULINHO (Pagode)
10/05	SÁBADO		ESPECIAL - JORGE ARAGAO (DJ)
11/05	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
12/05	SEGUNDA		FECHADO
13/05	TERÇA		FECHADO
14/05	QUARTA		Quarta de Bamba (Samba)
15/05	QUINTA		R&Baile (DJ)
16/05	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
17/05	SÁBADO		ESPECIAL - BETH CARVALHO (DJ)
18/05	DOMINGO		Um Belo Domingo - Pagode Lado a Lado (Pagode)
19/05	SEGUNDA		FECHADO
20/05	TERÇA		FECHADO
21/05	QUARTA		Quarta de Bamba (Samba)
22/05	QUINTA		Sertanejo - Modão e Viola - Brener Viola (Sertanejo)
23/05	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
24/05	SÁBADO		ESPECIAL - "ZECA PAGODINHO" - Nenel Vida (DJ)
25/05	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
26/05	SEGUNDA		FECHADO
27/05	TERÇA		FECHADO
28/05	QUARTA		Quarta de Bamba (Samba)
29/05	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
30/05	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
31/05	SÁBADO		ESPECIAL - "ALCIONE" - Karla Sangaletti (DJ)

01/06	DOMINGO		Evento - Samba da tia Zélia (Samba)
02/06	SEGUNDA		Jet - Segunda da Resenha (Samba)
03/06	TERÇA		FECHADO
04/06	QUARTA		Quarta de Bamba
05/06	QUINTA		Modão e Viola - Sertanejo - Precisa confirmar
06/06	SEXTA		Pagode Vira-Lata: Benzadeus
07/06	SÁBADO		Homenagem a alguém (a definir)
08/06	DOMINGO		Uma e Mesa e Um Pagode - Precisa confirmar
09/06	SEGUNDA		Jet - Segunda da Resenha (Samba)
10/06	TERÇA		FECHADO
11/06	QUARTA		Quarta de Bamba (Samba)
12/06	QUINTA		Moda e Viola - Sertanejo - Afogar as mágoas ou casal sertanejo - Grazi Maciel (Sertanejo)
13/06	SEXTA		Pagode Vira-Lata: Benzadeus (Pagode)
14/06	SÁBADO		Sambadona  (DJ)
15/06	DOMINGO		Uma e Mesa e Um Pagode - Precisa confirmar (Pagode)
16/06	SEGUNDA		Jet - Segunda da Resenha (Samba)
17/06	TERÇA		FECHADO
18/06	QUARTA		Quarta de Bamba - VESPERA (Samba)
19/06	QUINTA		Moda e Viola - Sertanejo - FERIADO - Lia Almeida (Sertanejo)
20/06	SEXTA		Pagode Vira-Lata: Benzadeus (Pagode)
21/06	SÁBADO		Samba Rainha (Samba)
22/06	DOMINGO		Uma e Mesa e Um Pagode - Precisa confirmar (Pagode)
23/06	SEGUNDA		Jet - Segunda da Resenha (Samba)
24/06	TERÇA		FECHADO
25/06	QUARTA		Festival Junino - Quarta de Bamba (Samba)
26/06	QUINTA		Festival Junino - Moda e Viola - Sertanejo - Lia Almeida (Sertanejo)
27/06	SEXTA		 Festival Junino- Pagode Vira-Lata: Benzadeus (Pagode)
28/06	SÁBADO		Festival Junino - Sambadona (Samba)
29/06	DOMINGO		PDJ - Pagode do Jorgin (Pagode)
30/06	SEGUNDA		Jet - Segunda da Resenha (Samba)
`;

function extrairGenero(texto: string): string {
  const generos = {
    '(DJ)': 'dj_set',
    '(Samba)': 'samba',
    '(Pagode)': 'pagode',
    '(Jazz)': 'jazz',
    '(Carnaval)': 'carnaval',
    '(Especial)': 'evento_especial',
    '(Sertanejo)': 'sertanejo',
  };

  for (const [pattern, genero] of Object.entries(generos)) {
    if (texto.includes(pattern)) {
      return genero;
    }
  }

  // Detectar por palavras-chave se não tiver parênteses
  const textoLower = texto.toLowerCase();
  if (textoLower.includes('dj') || textoLower.includes('music'))
    return 'dj_set';
  if (textoLower.includes('samba')) return 'samba';
  if (textoLower.includes('pagode')) return 'pagode';
  if (textoLower.includes('jazz')) return 'jazz';
  if (textoLower.includes('sertanejo') || textoLower.includes('viola'))
    return 'sertanejo';
  if (textoLower.includes('carnaval') || textoLower.includes('bloco'))
    return 'carnaval';
  if (textoLower.includes('especial') || textoLower.includes('homenagem'))
    return 'evento_especial';

  return 'outros';
}

function extrairCapacidade(texto: string): number | null {
  const match = texto.match(/(\d+)\s*pessoas/);
  return match ? parseInt(match[1]) : null;
}

function extrairArtista(texto: string): string {
  // Remove partes específicas para extrair o artista
  const artistaTexto = texto
    .replace(/\s*-\s*\d+\s*pessoas/, '') // Remove "- X pessoas"
    .replace(/\s*\([^)]+\)/, '') // Remove gênero entre parênteses
    .replace(/.*?-\s*/, '') // Remove parte antes do primeiro " - "
    .replace(/\s*-\s*Divulgar:.*/, '') // Remove instruções de divulgação
    .replace(/\s*-\s*Precisa confirmar.*/, '') // Remove "Precisa confirmar"
    .replace(/\s*-\s*VESPERA.*/, '') // Remove "VESPERA"
    .replace(/\s*-\s*FERIADO.*/, '') // Remove "FERIADO"
    .replace(/\s*\|\s*.*/, '') // Remove parte após pipe |
    .trim();

  // Se sobrou alguma coisa útil, retorna, senão vazio
  if (
    artistaTexto &&
    artistaTexto.length > 3 &&
    !artistaTexto.includes('TBC') &&
    !artistaTexto.includes('TBD')
  ) {
    return artistaTexto;
  }

  return '';
}

function parseEventos(
  dados: string,
  barId: number,
  ano: number = 2025
): any[] {
  const linhas = dados
    .trim()
    .split('\n')
    .filter(linha => linha.trim());
  const eventos: any[] = [];

  for (const linha of linhas) {
    const partes = linha.split('\t').map((p: string) => p.trim());
    if (partes.length < 3) continue;

    const [dataStr, diaSemana, eventoStr] = partes;

    // Pular dias fechados
    if (eventoStr.includes('FECHADO') || eventoStr.includes('FOLGA')) {
      continue;
    }

    // Construir data completa com validação
    const [dia, mes] = dataStr.split('/').map(Number);

    // Validar se a data é válida antes de criar
    const diasNoMes = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    // Ajustar para ano bissexto
    if (ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)) {
      diasNoMes[1] = 29;
    }

    if (dia > diasNoMes[mes - 1]) {
      console.warn(
        `⚠️  Data inválida ignorada: ${dia}/${mes}/${ano} (mês ${mes} só tem ${diasNoMes[mes - 1]} dias)`
      );
      continue;
    }

    const dataEvento = `${ano}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;

    // VERSÃO ULTRA SIMPLES: Só aplicar as transformações básicas
    let nomeEvento = eventoStr.trim();

    // Step 1: Remove parentheses at the end
    nomeEvento = nomeEvento.replace(/\s*\([^)]+\)\s*$/, '');

    // Step 2: Handle specific prefixes
    if (nomeEvento.startsWith('Evento - ')) {
      nomeEvento = nomeEvento.substring('Evento - '.length);
    } else if (nomeEvento.startsWith('Festival Junino - ')) {
      nomeEvento = nomeEvento.substring('Festival Junino - '.length);
    } else if (nomeEvento.includes('ESPECIAL - "')) {
      const start = nomeEvento.indexOf('"') + 1;
      const end = nomeEvento.indexOf('"', start);
      if (start > 0 && end > start) {
        nomeEvento = nomeEvento.substring(start, end);
      }
    }

    // Step 3: Split on common delimiters
    if (nomeEvento.includes(': ')) {
      nomeEvento = nomeEvento.split(':')[0];
    } else if (nomeEvento.includes(' - ')) {
      nomeEvento = nomeEvento.split(' - ')[0];
    }

    nomeEvento = nomeEvento.trim();

    // Fallback if empty
    if (!nomeEvento) {
      nomeEvento = `Evento ${dataStr}`;
    }
    const genero = extrairGenero(eventoStr);
    const capacidade = extrairCapacidade(eventoStr);
    const artista = extrairArtista(eventoStr);

    // Definir horários padrão baseados no tipo de evento
    let horarioInicio = '20:00';
    let horarioFim = '02:00';

    if (diaSemana === 'DOMINGO') {
      horarioInicio = '18:00';
      horarioFim = '00:00';
    } else if (diaSemana === 'SEGUNDA' || diaSemana === 'TERÇA') {
      horarioInicio = '19:00';
      horarioFim = '01:00';
    }

    eventos.push({
      bar_id: barId,
      data_evento: dataEvento,
      nome_evento: nomeEvento,
      descricao: eventoStr.includes('Divulgar') ? eventoStr : null,
      tipo_evento: 'musica_ao_vivo',
      categoria: genero === 'dj_set' ? 'eletronica' : 'brasileira',
      genero_musical: genero,
      sub_genero: null,
      nome_artista:
        artista && !artista.toLowerCase().includes('dj') ? artista : null,
      nome_banda:
        artista && !artista.toLowerCase().includes('dj') ? artista : null,
      tipo_artista: artista
        ? artista.toLowerCase().includes('dj')
          ? 'dj'
          : 'banda_local'
        : null,
      origem: 'local',
      popularidade: eventoStr.includes('ESPECIAL') ? 'conhecido' : 'local',
      couvert_artistico: null,
      valor_show: null,
      ingresso_antecipado: null,
      ingresso_portaria: null,
      capacidade_maxima: capacidade,
      sympla_evento_id: eventoStr.includes('Sympla') ? 'pendente' : null,
      plataforma_venda: eventoStr.includes('Sympla') ? 'sympla' : null,
      tags: {
        dia_semana: diaSemana.toLowerCase(),
        evento_recorrente: [
          'Quarta de Bamba',
          'Pagode Vira-lata',
          'R&Baile',
          'Uma mesa e um pagode',
        ].some(recorrente => nomeEvento.includes(recorrente)),
        evento_especial:
          eventoStr.includes('ESPECIAL') ||
          eventoStr.includes('CARNAVAL') ||
          eventoStr.includes('Festival'),
        divulgacao_necessaria: eventoStr.includes('Divulgar'),
        confirmacao_pendente:
          eventoStr.includes('Precisa confirmar') ||
          eventoStr.includes('TBC') ||
          eventoStr.includes('TBD'),
      },
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      status: 'confirmado',
      divulgacao_ativa:
        !eventoStr.includes('Precisa confirmar') &&
        !eventoStr.includes('TBC') &&
        !eventoStr.includes('TBD'),
      observacoes:
        eventoStr.includes('Divulgar') ||
        eventoStr.includes('Precisa confirmar')
          ? eventoStr
          : null,
    });
  }

  return eventos;
}

export async function POST(request: NextRequest) {
  try {
    // Inicializar cliente Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('❌ Erro ao fazer parse do JSON:', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Body da requisição não é um JSON válido',
        },
        { status: 400 }
      );
    }

    const {
      bar_id,
      bar_name,
      ano = 2025,
      confirmar_substituicao = false,
    } = body;

    if (!bar_id && !bar_name) {
      console.error('❌ bar_id ou bar_name não fornecido');
      return NextResponse.json(
        {
          success: false,
          error: 'bar_id ou bar_name é obrigatório',
        },
        { status: 400 }
      );
    }

    // Verificar se o bar existe
    let query = supabase.from('bars').select('id, nome');

    if (bar_id) {
      query = query.eq('id', bar_id);
    } else if (bar_name) {
      query = query.ilike('nome', `%${bar_name}%`);
    }

    const { data: barData, error: barError } = await query.single();

    if (barError || !barData) {
      console.error('❌ Bar não encontrado:', barError);
      const identifier = bar_id ? `ID ${bar_id}` : `nome "${bar_name}"`;
      return NextResponse.json(
        {
          success: false,
          error: `Bar com ${identifier} não encontrado`,
        },
        { status: 404 }
      );
    }

    // Parse dos eventos usando o ID do bar encontrado
    const barIdFinal = barData.id;
    const eventosParaImportar = parseEventos(
      eventosHistoricos,
      barIdFinal,
      ano
    );

    if (!confirmar_substituicao) {
      // Primeiro, verificar se já existem eventos no período
      const { data: eventosExistentes } = await supabase
        .from('eventos_base')
        .select('id, data_evento')
        .eq('bar_id', barIdFinal)
        .gte('data_evento', `${ano}-02-01`)
        .lte('data_evento', `${ano}-06-30`);

      if (eventosExistentes && eventosExistentes.length > 0) {
        return NextResponse.json({
          success: false,
          error: 'Já existem eventos no período. Confirme a substituição.',
          eventos_existentes: eventosExistentes.length,
          eventos_para_importar: eventosParaImportar.length,
          requer_confirmacao: true,
        });
      }
    } else {
      // Deletar eventos existentes no período
      await supabase
        .from('eventos_base')
        .delete()
        .eq('bar_id', barIdFinal)
        .gte('data_evento', `${ano}-02-01`)
        .lte('data_evento', `${ano}-06-30`);
    }

    // Inserir em lotes para evitar timeouts
    const BATCH_SIZE = 50;
    let totalInseridos = 0;

    for (let i = 0; i < eventosParaImportar.length; i += BATCH_SIZE) {
      const lote = eventosParaImportar.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase
        .from('eventos_base')
        .insert(lote)
        .select();

      if (error) {
        console.error(
          `❌ Erro ao inserir lote ${Math.floor(i / BATCH_SIZE) + 1}:`,
          error
        );
        console.error(
          'Evento que causou erro:',
          JSON.stringify(lote[0], null, 2)
        );
        return NextResponse.json(
          {
            success: false,
            error: `Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`,
            details: error,
            eventos_inseridos_antes_do_erro: totalInseridos,
          },
          { status: 500 }
        );
      }

      totalInseridos += data?.length || 0;
    }

    return NextResponse.json({
      success: true,
      message: `${eventosParaImportar.length} eventos importados com sucesso!`,
      eventos_importados: totalInseridos,
      resumo: {
        fevereiro: eventosParaImportar.filter((e: any) =>
          e.data_evento.includes('-02-')
        ).length,
        marco: eventosParaImportar.filter((e: any) =>
          e.data_evento.includes('-03-')
        ).length,
        abril: eventosParaImportar.filter((e: any) =>
          e.data_evento.includes('-04-')
        ).length,
        maio: eventosParaImportar.filter((e: any) =>
          e.data_evento.includes('-05-')
        ).length,
        junho: eventosParaImportar.filter((e: any) =>
          e.data_evento.includes('-06-')
        ).length,
      },
      generos_detectados: [
        ...new Set(eventosParaImportar.map((e: any) => e.genero_musical)),
      ],
      artistas_detectados: [
        ...new Set(
          eventosParaImportar
            .map((e: any) => e.nome_artista)
            .filter(Boolean)
        ),
      ],
    });
  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
      },
      { status: 500 }
    );
  }
}
