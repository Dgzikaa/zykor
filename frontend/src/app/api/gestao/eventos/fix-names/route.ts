import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

// Historical event data mapping
const eventosHistoricos = `
01/02	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
02/02	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
03/02	SÁBADO		ESPECIAL - "ALCIONE" - Karla Sangaletti (DJ)
04/02	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
05/02	SEGUNDA		FECHADO
06/02	TERÇA		FECHADO
07/02	QUARTA		Quarta de Bamba (Samba)
08/02	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
09/02	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
10/02	SÁBADO		FECHADO
11/02	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
12/02	SEGUNDA		FECHADO
13/02	TERÇA		CARNAVAL
14/02	QUARTA		CARNAVAL
15/02	QUINTA		CARNAVAL
16/02	SEXTA		CARNAVAL
17/02	SÁBADO		CARNAVAL
18/02	DOMINGO		CARNAVAL
19/02	SEGUNDA		FECHADO
20/02	TERÇA		FECHADO
21/02	QUARTA		Quarta de Bamba (Samba)
22/02	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
23/02	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
24/02	SÁBADO		ESPECIAL - "ZECA PAGODINHO" - Nenel Vida (DJ)
25/02	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
26/02	SEGUNDA		FECHADO
27/02	TERÇA		FECHADO
28/02	QUARTA		Quarta de Bamba (Samba)

01/03	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
02/03	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
03/03	SÁBADO		ESPECIAL - "ALCIONE" - Karla Sangaletti (DJ)
04/03	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
05/03	SEGUNDA		FECHADO
06/03	TERÇA		FECHADO
07/03	QUARTA		Quarta de Bamba (Samba)
08/03	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
09/03	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
10/03	SÁBADO		DJ SET - MC's diversos (DJ)
11/03	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
12/03	SEGUNDA		FECHADO
13/03	TERÇA		FECHADO
14/03	QUARTA		Quarta de Bamba (Samba)
15/03	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
16/03	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
17/03	SÁBADO		ESPECIAL - "ZECA PAGODINHO" - Nenel Vida (DJ)
18/03	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
19/03	SEGUNDA		FECHADO
20/03	TERÇA		FECHADO
21/03	QUARTA		Quarta de Bamba (Samba)
22/03	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
23/03	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
24/03	SÁBADO		ESPECIAL - "ALCIONE" - Karla Sangaletti (DJ)
25/03	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
26/03	SEGUNDA		FECHADO
27/03	TERÇA		FECHADO
28/03	QUARTA		Quarta de Bamba (Samba)
29/03	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
30/03	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
31/03	SÁBADO		DJ SET - MC's diversos (DJ)

01/04	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
02/04	SEGUNDA		FECHADO
03/04	TERÇA		FECHADO
04/04	QUARTA		Quarta de Bamba (Samba)
05/04	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
06/04	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
07/04	SÁBADO		ESPECIAL - "ZECA PAGODINHO" - Nenel Vida (DJ)
08/04	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
09/04	SEGUNDA		FECHADO
10/04	TERÇA		FECHADO
11/04	QUARTA		Quarta de Bamba (Samba)
12/04	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
13/04	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
14/04	SÁBADO		ESPECIAL - "ALCIONE" - Karla Sangaletti (DJ)
15/04	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
16/04	SEGUNDA		FECHADO
17/04	TERÇA		FECHADO
18/04	QUARTA		Quarta de Bamba (Samba)
19/04	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
20/04	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
21/04	SÁBADO		CARNAVAL - Bloco da Zuera (Carnaval)
22/04	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
23/04	SEGUNDA		FECHADO
24/04	TERÇA		FECHADO
25/04	QUARTA		Quarta de Bamba (Samba)
26/04	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
27/04	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
28/04	SÁBADO		DJ SET - MC's diversos (DJ)
29/04	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
30/04	SEGUNDA		FECHADO

01/05	TERÇA		FERIADO - Trabalhador
02/05	QUARTA		Quarta de Bamba (Samba)
03/05	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
04/05	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
05/05	SÁBADO		ESPECIAL - "ZECA PAGODINHO" - Nenel Vida (DJ)
06/05	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
07/05	SEGUNDA		FECHADO
08/05	TERÇA		FECHADO
09/05	QUARTA		Quarta de Bamba (Samba)
10/05	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
11/05	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
12/05	SÁBADO		DIA DAS MÃES - Especial Mães que Sambam (Samba)
13/05	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
14/05	SEGUNDA		FECHADO
15/05	TERÇA		FECHADO
16/05	QUARTA		Quarta de Bamba (Samba)
17/05	QUINTA		Sertanejo - Lia Almeida (Sertanejo)
18/05	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
19/05	SÁBADO		ESPECIAL - "ALCIONE" - Karla Sangaletti (DJ)
20/05	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
21/05	SEGUNDA		FECHADO
22/05	TERÇA		FECHADO
23/05	QUARTA		Quarta de Bamba (Samba)
24/05	QUINTA		Sertanejo - Modão e Viola - Brener Viola (Sertanejo)
25/05	SEXTA		Pagode Vira Lata - Benzadeus (Pagode)
26/05	SÁBADO		ESPECIAL - "ZECA PAGODINHO" - Nenel Vida (DJ)
27/05	DOMINGO		Uma mesa e um pagode - Doze (Pagode)
28/05	SEGUNDA		FECHADO
29/05	TERÇA		FECHADO
30/05	QUARTA		Quarta de Bamba (Samba)
31/05	QUINTA		Sertanejo - Lia Almeida (Sertanejo)

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

function parseEventName(eventoStr: string): string {
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

  return nomeEvento.trim();
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

    const { bar_id = 1, ano = 2025 } = await request.json();

    // Parse historical data to create date-to-name mapping
    const linhas = eventosHistoricos
      .trim()
      .split('\n')
      .filter(linha => linha.trim());
    const dateNameMap: Record<string, string> = {};

    for (const linha of linhas) {
      const partes = linha.split('\t').map((p: string) => p.trim());
      if (partes.length < 3) continue;

      const [dataStr, , eventoStr] = partes;

      // Skip closed days
      if (eventoStr.includes('FECHADO') || eventoStr.includes('FOLGA')) {
        continue;
      }

      const [dia, mes] = dataStr.split('/').map(Number);
      const dataCompleta = `${ano}-${mes.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;

      const nomeEvento = parseEventName(eventoStr);
      if (nomeEvento) {
        dateNameMap[dataCompleta] = nomeEvento;
      }
    }

    // Get all events from the bar in the date range

    const { data: eventos, error: fetchError } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome_evento')
      .eq('bar_id', bar_id)
      .gte('data_evento', `${ano}-02-01`)
      .lte('data_evento', `${ano}-06-30`);

    if (fetchError) {
      console.error('Error fetching events:', fetchError);
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    let updatedCount = 0;
    const updates: Array<{
      id: any;
      data_evento: any;
      old_name: any;
      new_name: string;
    }> = [];

    // Update events with correct names
    for (const evento of eventos || []) {
      const correctName = evento.data_evento ? dateNameMap[evento.data_evento] : null;

      if (correctName && correctName !== evento.nome_evento) {
        updates.push({
          id: evento.id,
          data_evento: evento.data_evento,
          old_name: evento.nome_evento,
          new_name: correctName,
        });
      }
    }

    // FORCE UPDATE ALL: Update all events with correct names from mapping
    for (const [date, correctName] of Object.entries(dateNameMap)) {
      const { error: updateError } = await supabase
        .from('eventos_base')
        .update({ nome_evento: correctName })
        .eq('bar_id', bar_id)
        .eq('data_evento', date);

      if (updateError) {
        console.error(`Error updating event ${date}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    // Apply regular updates if (unknown)
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('eventos_base')
        .update({ nome_evento: update.new_name })
        .eq('id', update.id);

      if (updateError) {
        console.error(`Error updating event ${update.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${updatedCount} event names`,
      updated_count: updatedCount,
      total_events: eventos?.length || 0,
      sample_updates: updates.slice(0, 5),
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
