import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MENSAGEM_NPS_PADRAO = `Olá {nome}! 👋

Sua opinião é muito importante para nós!

De 0 a 10, o quanto você recomendaria o Ordinário para um amigo?

Responda aqui: *{link_nps}*

Obrigado! 🙏`;

function normalizePhone(phone: string): string {
  if (!phone) return '';
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length === 11) return '55' + normalized;
  if (normalized.length === 10) return '55' + normalized;
  return normalized.startsWith('55') ? normalized : '55' + normalized;
}

/**
 * GET /api/umbler/nps-disparo
 * Lista destinatários potenciais para disparo de NPS
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const fonte = searchParams.get('fonte') || 'conversas'; // 'conversas' | 'reservas'
    const dias = parseInt(searchParams.get('dias') || '7');
    const limite = parseInt(searchParams.get('limite') || '100');

    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    const dataLimiteStr = dataLimite.toISOString().split('T')[0];

    let destinatarios: { telefone: string; nome?: string }[] = [];

    if (fonte === 'reservas') {
      const { data: reservas } = await supabase
        .from('getin_reservas')
        .select('customer_phone, customer_name')
        .eq('bar_id', barId)
        .neq('customer_phone', '')
        .not('customer_phone', 'is', null)
        .in('status', ['seated', 'confirmed'])
        .gte('reservation_date', dataLimiteStr)
        .limit(limite * 2); // over-fetch para dedup

      const seen = new Set<string>();
      ;(reservas || []).forEach(r => {
        const ph = normalizePhone(r.customer_phone || '');
        if (ph && !seen.has(ph)) {
          seen.add(ph);
          destinatarios.push({
            telefone: r.customer_phone || '',
            nome: r.customer_name || undefined
          });
        }
      });
      destinatarios = destinatarios.slice(0, limite);
    } else {
      const { data: conversas } = await supabase
        .from('umbler_conversas')
        .select('contato_telefone, contato_nome')
        .eq('bar_id', barId)
        .neq('contato_telefone', '')
        .not('contato_telefone', 'is', null)
        .gte('iniciada_em', dataLimite.toISOString())
        .limit(limite * 2);

      const seen = new Set<string>();
      ;(conversas || []).forEach(c => {
        const ph = normalizePhone(c.contato_telefone || '');
        if (ph && !seen.has(ph)) {
          seen.add(ph);
          destinatarios.push({
            telefone: c.contato_telefone || '',
            nome: c.contato_nome || undefined
          });
        }
      });
      destinatarios = destinatarios.slice(0, limite);
    }

    return NextResponse.json({
      success: true,
      fonte,
      total: destinatarios.length,
      destinatarios
    });
  } catch (error) {
    console.error('[NPS-DISPARO] Erro ao listar destinatários:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/umbler/nps-disparo
 * Cria campanha NPS e dispara via Umbler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      bar_id = 3,
      fonte = 'conversas',
      dias = 7,
      limite = 50,
      mensagem,
      link_nps,
      destinatarios: destinatariosBody,
      executar_agora = true
    } = body;

    const barId = parseInt(String(bar_id));

    // Verificar Umbler configurado
    const { data: config, error: configError } = await supabase
      .from('umbler_config')
      .select('channel_id')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { success: false, error: 'Umbler não configurado para este bar' },
        { status: 400 }
      );
    }

    let destinatarios: { telefone: string; nome?: string }[] =
      Array.isArray(destinatariosBody) && destinatariosBody.length > 0
        ? destinatariosBody
        : [];

    if (destinatarios.length === 0) {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - dias);
      const dataLimiteStr = dataLimite.toISOString().split('T')[0];
      const seen = new Set<string>();

      if (fonte === 'reservas') {
        const { data: reservas } = await supabase
          .from('getin_reservas')
          .select('customer_phone, customer_name')
          .eq('bar_id', barId)
          .neq('customer_phone', '')
          .not('customer_phone', 'is', null)
          .in('status', ['seated', 'confirmed'])
          .gte('reservation_date', dataLimiteStr)
          .limit(limite * 2);

        ;(reservas || []).forEach(r => {
          const ph = normalizePhone(r.customer_phone || '');
          if (ph && !seen.has(ph)) {
            seen.add(ph);
            destinatarios.push({
              telefone: r.customer_phone || '',
              nome: r.customer_name || undefined
            });
          }
        });
      } else {
        const { data: conversas } = await supabase
          .from('umbler_conversas')
          .select('contato_telefone, contato_nome')
          .eq('bar_id', barId)
          .neq('contato_telefone', '')
          .not('contato_telefone', 'is', null)
          .gte('iniciada_em', dataLimite.toISOString())
          .limit(limite * 2);

        ;(conversas || []).forEach(c => {
          const ph = normalizePhone(c.contato_telefone || '');
          if (ph && !seen.has(ph)) {
            seen.add(ph);
            destinatarios.push({
              telefone: c.contato_telefone || '',
              nome: c.contato_nome || undefined
            });
          }
        });
      }
      destinatarios = destinatarios.slice(0, limite);
    }

    if (destinatarios.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum destinatário encontrado para o período e filtros informados' },
        { status: 400 }
      );
    }

    const templateMsg = mensagem || MENSAGEM_NPS_PADRAO;
    const linkNpsFinal = link_nps || process.env.NEXT_PUBLIC_NPS_LINK || 'https://forms.gle/nps-ordinario';

    const variaveis: Record<string, string> = { link_nps: linkNpsFinal };

    const { data: campanha, error: campanhaError } = await supabase
      .from('umbler_campanhas')
      .insert({
        bar_id: barId,
        channel_id: config.channel_id,
        nome: `NPS - ${new Date().toLocaleDateString('pt-BR')}`,
        tipo: 'nps',
        template_mensagem: templateMsg,
        template_name: 'nps_pesquisa_satisfacao',
        variaveis,
        segmento_criterios: { fonte, dias, limite },
        total_destinatarios: destinatarios.length,
        status: executar_agora ? 'em_execucao' : 'rascunho'
      })
      .select()
      .single();

    if (campanhaError) {
      console.error('[NPS-DISPARO] Erro ao criar campanha:', campanhaError);
      return NextResponse.json(
        { success: false, error: campanhaError.message },
        { status: 500 }
      );
    }

    const destinatariosData = destinatarios.map(d => ({
      campanha_id: campanha.id,
      telefone: normalizePhone(d.telefone),
      nome: d.nome,
      status: 'pendente'
    }));

    await supabase.from('umbler_campanha_destinatarios').insert(destinatariosData);

    if (executar_agora) {
      const destComVar = destinatarios.map(d => ({
        ...d,
        link_nps: linkNpsFinal
      }));

      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/umbler/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          mode: 'bulk',
          campanha_id: campanha.id,
          destinatarios: destComVar,
          template_mensagem: templateMsg,
          variaveis: { ...variaveis, link_nps: linkNpsFinal },
          delay_ms: 1500
        })
      }).catch(err => console.error('[NPS-DISPARO] Erro ao iniciar disparo:', err));
    }

    return NextResponse.json({
      success: true,
      campanha_id: campanha.id,
      total_destinatarios: destinatarios.length,
      executando: executar_agora
    });
  } catch (error) {
    console.error('[NPS-DISPARO] Erro:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
