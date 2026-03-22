import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserAuth, isAdmin } from '@/lib/auth-helper';

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ========================================
// 📅 IMPORTAR EVENTOS DO GOOGLE SHEETS
// ========================================
export async function POST(request: NextRequest) {
  try {
    const user = await getUserAuth(request);

    // Verificar permissões
    if (!user || !isAdmin(user)) {
      return NextResponse.json(
        {
          error: 'Apenas administradores podem importar eventos',
        },
        { status: 403 }
      );
    }

    const { bar_id } = user;

    const body = await request.json();
    const { dados, substituir_existentes = false } = body;

    if (!dados || !Array.isArray(dados)) {
      return NextResponse.json(
        {
          error: 'Dados inválidos. Esperado array de eventos',
        },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let eventosImportados = 0;
    let eventosAtualizados = 0;
    const erros: string[] = [];

    for (const evento of dados) {
      try {
        // Validar campos obrigatórios
        if (!evento.data_evento || !evento.nome) {
          erros.push(
            `Evento ${evento.nome || 'sem nome'}: campos obrigatórios faltando`
          );
          continue;
        }

        const dadosEvento = {
          bar_id,
          data_evento: evento.data_evento,
          nome: evento.nome,
          descricao: evento.descricao || null,
          tipo_evento: evento.tipo_evento || 'musica_ao_vivo',
          categoria: evento.categoria || 'outros',
          genero_musical: evento.genero_musical || 'outros',
          sub_genero: evento.sub_genero || null,
          nome_artista: evento.nome_artista || null,
          nome_banda: evento.nome_banda || null,
          tipo_artista: evento.tipo_artista || null,
          origem: evento.origem || 'local',
          popularidade: evento.popularidade || 'local',
          couvert_artistico: parseFloat(evento.couvert_artistico) || null,
          valor_show: parseFloat(evento.valor_show) || null,
          ingresso_antecipado: parseFloat(evento.ingresso_antecipado) || null,
          ingresso_portaria: parseFloat(evento.ingresso_portaria) || null,
          capacidade_maxima: parseInt(evento.capacidade_maxima) || null,
          sympla_event_id: evento.sympla_event_id || null,
          yuzer_operation_id: evento.yuzer_operation_id || null,
          plataforma_venda: evento.plataforma_venda || null,
          tags: evento.tags || {},
          horario_inicio: evento.horario_inicio || '20:00',
          horario_fim: evento.horario_fim || '02:00',
          status: evento.status || 'confirmado',
          divulgacao_ativa: evento.divulgacao_ativa !== false,
          observacoes: evento.observacoes || null,
          // Métricas do Sympla
          sympla_total_ingressos: parseInt(evento.sympla_total_ingressos) || 0,
          sympla_total_checkins: parseInt(evento.sympla_total_checkins) || 0,
          sympla_faturamento_liquido:
            parseFloat(evento.sympla_faturamento_liquido) || 0,
          // Métricas do Yuzer
          yuzer_faturamento_bilheteria:
            parseFloat(evento.yuzer_faturamento_bilheteria) || 0,
          yuzer_faturamento_bar: parseFloat(evento.yuzer_faturamento_bar) || 0,
          yuzer_total_ingressos: parseInt(evento.yuzer_total_ingressos) || 0,
          // Dados das APIs preservados
          dados_sympla: evento.dados_sympla || {},
          dados_yuzer: evento.dados_yuzer || {},
        };

        // Verificar se já existe
        const { data: existente } = await supabase
          .from('eventos_base')
          .select('id')
          .eq('bar_id', bar_id)
          .eq('data_evento', dadosEvento.data_evento)
          .eq('nome', dadosEvento.nome)
          .single();

        if (existente && !substituir_existentes) {
          continue;
        }

        // Inserir ou atualizar
        let error;
        if (existente) {
          const result = await supabase
            .from('eventos_base')
            .update(dadosEvento)
            .eq('id', existente.id);
          error = result.error;
        } else {
          const result = await supabase.from('eventos_base').insert(dadosEvento);
          error = result.error;
        }

        if (error) {
          erros.push(`Evento ${evento.nome}: ${error.message}`);
          continue;
        }

        if (existente) {
          eventosAtualizados++;
        } else {
          eventosImportados++;
        }
      } catch (error: unknown) {
        erros.push(`Evento ${evento.nome}: ${(error as any).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Importação de eventos concluída',
      resultados: {
        eventos_importados: eventosImportados,
        eventos_atualizados: eventosAtualizados,
        total_processados: eventosImportados + eventosAtualizados,
        erros: erros.length,
        detalhes_erros: erros,
      },
    });
  } catch (error: unknown) {
    console.error('❌ Erro na importação de eventos:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: (error as any).message,
      },
      { status: 500 }
    );
  }
}

// ========================================
// 📋 TEMPLATE DE DADOS PARA IMPORTAÇÃO
// ========================================
export async function GET() {
  const template = {
    exemplo: 'Estrutura de dados para importação de eventos',
    formato: [
      {
        data_evento: '2025-06-01',
        nome: 'Samba da tia Zélia',
        descricao: 'Evento especial de samba',
        tipo_evento: 'musica_ao_vivo',
        categoria: 'brasileira',
        genero_musical: 'samba',
        sub_genero: null,
        nome_artista: 'Tia Zélia',
        nome_banda: 'Grupo da Tia Zélia',
        tipo_artista: 'banda_local',
        origem: 'local',
        popularidade: 'conhecido',
        couvert_artistico: null,
        valor_show: null,
        ingresso_antecipado: null,
        ingresso_portaria: null,
        capacidade_maxima: 200,
        sympla_event_id: null,
        yuzer_operation_id: null,
        plataforma_venda: null,
        tags: {
          evento_especial: true,
          dia_semana: 'domingo',
        },
        horario_inicio: '18:00',
        horario_fim: '00:00',
        status: 'confirmado',
        divulgacao_ativa: true,
        observacoes: 'Importado da planilha de eventos',
      },
    ],
    instrucoes: {
      campos_obrigatorios: ['data_evento', 'nome'],
      campos_opcionais: [
        'descricao',
        'tipo_evento',
        'categoria',
        'genero_musical',
        'nome_artista',
        'horario_inicio',
        'horario_fim',
        'capacidade_maxima',
        'observacoes',
      ],
      formato_datas: 'YYYY-MM-DD',
      formato_horarios: 'HH:MM',
      substituir_existentes:
        'false por padrão, true para sobrescrever eventos existentes',
      tipos_evento: ['musica_ao_vivo', 'show', 'festa', 'promocao', 'especial'],
      categorias: ['brasileira', 'eletronica', 'internacional', 'outros'],
      generos_musicais: [
        'samba',
        'pagode',
        'funk',
        'sertanejo',
        'rock',
        'jazz',
        'dj_set',
        'outros',
      ],
      tipos_artista: ['banda_local', 'banda_conhecida', 'dj', 'solo', 'duo'],
    },
  };

  return NextResponse.json(template);
}
