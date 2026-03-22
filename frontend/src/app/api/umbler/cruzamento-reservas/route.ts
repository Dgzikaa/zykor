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

    // Query de cruzamento Umbler x Getin
    // Normaliza telefones pegando os últimos 11 dígitos
    const { data, error } = await supabase.rpc('get_umbler_getin_cruzamento', { p_bar_id: barId });

    // Se a função RPC não existir, fazer a query direta
    if (error) {
      // Buscar telefones da Umbler
      const { data: umblerPhones } = await supabase
        .from('umbler_conversas')
        .select('contato_telefone')
        .eq('bar_id', barId)
        .neq('contato_telefone', '')
        .not('contato_telefone', 'is', null);

      // Normalizar telefones Umbler (últimos 11 dígitos)
      const umblerNormalized = new Set(
        umblerPhones?.map(u => {
          const digits = u.contato_telefone.replace(/\D/g, '');
          return digits.slice(-11);
        }) || []
      );

      // Buscar reservas do Getin
      const { data: getinReservas } = await supabase
        .from('getin_reservas')
        .select('customer_phone, status')
        .eq('bar_id', barId)
        .neq('customer_phone', '')
        .not('customer_phone', 'is', null);

      // Cruzar dados
      let contatos_conversaram_e_reservaram = 0;
      let total_reservas = 0;
      let compareceram_seated = 0;
      let no_shows = 0;
      let confirmadas_aguardando = 0;
      let canceladas_usuario = 0;
      let canceladas_agente = 0;
      let pendentes = 0;

      const phonesCruzados = new Set<string>();

      getinReservas?.forEach(reserva => {
        const phoneNormalized = reserva.customer_phone.replace(/\D/g, '').slice(-11);
        
        if (umblerNormalized.has(phoneNormalized)) {
          if (!phonesCruzados.has(phoneNormalized)) {
            contatos_conversaram_e_reservaram++;
            phonesCruzados.add(phoneNormalized);
          }
          
          total_reservas++;
          
          switch (reserva.status) {
            case 'seated':
              compareceram_seated++;
              break;
            case 'no-show':
              no_shows++;
              break;
            case 'confirmed':
              confirmadas_aguardando++;
              break;
            case 'canceled-user':
              canceladas_usuario++;
              break;
            case 'canceled-agent':
              canceladas_agente++;
              break;
            case 'pending':
              pendentes++;
              break;
          }
        }
      });

      return NextResponse.json({
        success: true,
        dados: {
          contatos_conversaram_e_reservaram,
          total_reservas,
          compareceram_seated,
          no_shows,
          confirmadas_aguardando,
          canceladas_usuario,
          canceladas_agente,
          pendentes
        }
      });
    }

    return NextResponse.json({
      success: true,
      dados: data
    });

  } catch (error) {
    console.error('Erro ao buscar cruzamento:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno' },
      { status: 500 }
    );
  }
}
