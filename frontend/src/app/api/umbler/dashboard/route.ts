import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    // Métricas gerais
    const { data: metricas, error: metricasError } = await supabase.rpc('get_umbler_metricas', { p_bar_id: barId });

    // Se a função RPC não existir, fazer queries diretas
    let metricasData;
    if (metricasError) {
      // Total de conversas
      const { count: totalConversas } = await supabase
        .from('umbler_conversas')
        .select('*', { count: 'exact', head: true })
        .eq('bar_id', barId);

      // Total de mensagens
      const { count: totalMensagens } = await supabase
        .from('umbler_mensagens')
        .select('*', { count: 'exact', head: true })
        .eq('bar_id', barId);

      // Contatos únicos
      const { data: contatosUnicos } = await supabase
        .from('umbler_conversas')
        .select('contato_telefone')
        .eq('bar_id', barId)
        .neq('contato_telefone', '')
        .not('contato_telefone', 'is', null);

      const uniquePhones = new Set(contatosUnicos?.map(c => c.contato_telefone) || []);

      // Período das conversas
      const { data: periodo } = await supabase
        .from('umbler_conversas')
        .select('iniciada_em')
        .eq('bar_id', barId)
        .order('iniciada_em', { ascending: true })
        .limit(1);

      const { data: periodoRecente } = await supabase
        .from('umbler_conversas')
        .select('iniciada_em')
        .eq('bar_id', barId)
        .order('iniciada_em', { ascending: false })
        .limit(1);

      // Status das conversas
      const { data: statusData } = await supabase
        .from('umbler_conversas')
        .select('status')
        .eq('bar_id', barId);

      const statusCount: Record<string, number> = {};
      statusData?.forEach(item => {
        statusCount[item.status] = (statusCount[item.status] || 0) + 1;
      });

      metricasData = {
        total_conversas: totalConversas || 0,
        total_mensagens: totalMensagens || 0,
        contatos_unicos: uniquePhones.size,
        conversa_mais_antiga: periodo?.[0]?.iniciada_em || null,
        conversa_mais_recente: periodoRecente?.[0]?.iniciada_em || null,
        status_conversas: Object.entries(statusCount).map(([status, quantidade]) => ({
          status,
          quantidade
        })).sort((a, b) => b.quantidade - a.quantidade)
      };
    } else {
      metricasData = metricas;
    }

    // Top contatos
    const { data: topContatos } = await supabase
      .from('umbler_conversas')
      .select('contato_nome, contato_telefone, iniciada_em')
      .eq('bar_id', barId)
      .neq('contato_telefone', '')
      .not('contato_telefone', 'is', null);

    // Agrupar por telefone
    const contatosMap: Record<string, {
      contato_nome: string;
      contato_telefone: string;
      total_conversas: number;
      primeira_conversa: string;
      ultima_conversa: string;
    }> = {};

    topContatos?.forEach(conversa => {
      const telefone = conversa.contato_telefone;
      if (!contatosMap[telefone]) {
        contatosMap[telefone] = {
          contato_nome: conversa.contato_nome || '',
          contato_telefone: telefone,
          total_conversas: 0,
          primeira_conversa: conversa.iniciada_em,
          ultima_conversa: conversa.iniciada_em
        };
      }
      contatosMap[telefone].total_conversas++;
      if (conversa.contato_nome) {
        contatosMap[telefone].contato_nome = conversa.contato_nome;
      }
      if (conversa.iniciada_em < contatosMap[telefone].primeira_conversa) {
        contatosMap[telefone].primeira_conversa = conversa.iniciada_em;
      }
      if (conversa.iniciada_em > contatosMap[telefone].ultima_conversa) {
        contatosMap[telefone].ultima_conversa = conversa.iniciada_em;
      }
    });

    const topContatosList = Object.values(contatosMap)
      .sort((a, b) => b.total_conversas - a.total_conversas)
      .slice(0, 20);

    // Último sync
    const { data: ultimoSync } = await supabase
      .from('umbler_webhook_logs')
      .select('created_at')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false })
      .limit(1);

    return NextResponse.json({
      success: true,
      metricas: metricasData,
      top_contatos: topContatosList,
      ultimo_sync: ultimoSync?.[0]?.created_at || null
    });

  } catch (error) {
    console.error('Erro ao buscar dashboard Umbler:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
