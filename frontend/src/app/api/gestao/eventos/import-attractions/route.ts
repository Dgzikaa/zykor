import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

interface AttractionItem {
  data: string;
  evento: string;
  artista: string;
  genero: string;
  obs: string;
}

// Mapeamento dos dados da planilha
const attractionsData = [
  // Fevereiro 2025
  {
    data: '2025-02-01',
    evento: 'Soft Open',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-04',
    evento: 'Soft Open',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-05',
    evento: 'Soft Open',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-02-06',
    evento: 'Soft Open',
    artista: 'DJ Umiranda',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-07',
    evento: 'Soft Open',
    artista: '',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-02-08',
    evento: 'Soft Open',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-11',
    evento: 'Soft Open',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-12',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-02-13',
    evento: 'Black music',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-14',
    evento: 'Samba das Dez',
    artista: '',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-02-15',
    evento: 'DJs - Hugo drop + convidados (DJ)',
    artista: 'DJ Hugo Drop',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-16',
    evento: 'Pagode do Ordi',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-02-18',
    evento: 'Caramelo Jazz Night',
    artista: '',
    genero: 'Jazz',
    obs: '',
  },
  {
    data: '2025-02-19',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-02-20',
    evento: 'Discolate',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-21',
    evento: 'Pagode Vira-lata',
    artista: '',
    genero: 'Pagode',
    obs: '',
  },
  { data: '2025-02-22', evento: 'MSN', artista: '', genero: 'DJ', obs: '' },
  {
    data: '2025-02-23',
    evento: 'Braslidades',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-25',
    evento: 'Caramelo Jazz Night',
    artista: '',
    genero: 'Jazz',
    obs: '',
  },
  {
    data: '2025-02-26',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-02-27',
    evento: 'Discolate',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-02-28',
    evento: 'Samba das Dez',
    artista: '',
    genero: 'Samba',
    obs: '',
  },

  // Março 2025
  {
    data: '2025-03-01',
    evento: 'MSN',
    artista: 'DJ Umiranda',
    genero: 'DJ',
    obs: 'Carnaval',
  },
  {
    data: '2025-03-02',
    evento: 'Pagode Vira-lata',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: 'Carnaval',
  },
  {
    data: '2025-03-03',
    evento: 'Macetada Caramelo',
    artista: '',
    genero: 'DJ',
    obs: 'Carnaval',
  },
  {
    data: '2025-03-04',
    evento: 'Volto pro Eixo',
    artista: '',
    genero: 'DJ',
    obs: 'Carnaval',
  },
  {
    data: '2025-03-06',
    evento: 'Discolate',
    artista: 'DJ Hugo Drop',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-03-07',
    evento: 'Pagode Vira-Lata',
    artista: 'Gigi',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-03-08',
    evento: 'Elas cantam o Brasil',
    artista: 'Lithie',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-03-09',
    evento: 'Algo simples',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-03-11',
    evento: 'Caramelo Jazz Night',
    artista: '',
    genero: 'Jazz',
    obs: '',
  },
  {
    data: '2025-03-12',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-03-13',
    evento: 'Discolate',
    artista: 'DJ Hugo Drop',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-03-14',
    evento: 'Pagode Vira-lata',
    artista: 'Dudu 7 Cordas',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-03-16',
    evento: 'Algo simples',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-03-18',
    evento: 'Caramelo Jazz Night',
    artista: '',
    genero: 'Jazz',
    obs: '',
  },
  {
    data: '2025-03-19',
    evento: 'Quarta de Bamba - Breno Alves',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-03-20',
    evento: 'Marvin canta + DJs',
    artista: 'Marvin',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-03-21',
    evento: 'Pagode Vira-lata',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-03-22',
    evento: 'R&Baile',
    artista: 'DJ Umiranda',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-03-23',
    evento: 'Uma Mesa e Um Pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-03-24',
    evento: 'Dia D',
    artista: 'Duzão',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-03-25',
    evento: 'Brasil x Argentina',
    artista: '',
    genero: 'DJ',
    obs: 'Jogo',
  },
  {
    data: '2025-03-26',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-03-27',
    evento: 'Discolate',
    artista: 'DJ Hugo Drop',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-03-28',
    evento: 'Pagode Vira-lata',
    artista: 'Tonzão',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-03-29',
    evento: 'Perro Caliente',
    artista: 'DJ Pequi',
    genero: 'Cubana',
    obs: '',
  },
  {
    data: '2025-03-30',
    evento: 'Algo simples',
    artista: '',
    genero: 'DJ',
    obs: '',
  },

  // Abril 2025
  {
    data: '2025-04-01',
    evento: 'Libertadores no telão',
    artista: '',
    genero: 'DJ',
    obs: 'Jogo',
  },
  {
    data: '2025-04-02',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-04-03',
    evento: 'Quinta de abril',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-04',
    evento: 'Pagode Vira-lata',
    artista: 'Dudu 7 Cordas',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-05',
    evento: 'MSN',
    artista: 'DJ Tiago Jousef',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-04-06',
    evento: 'Uma mesa e um pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-08',
    evento: 'Jogos de futebol',
    artista: 'KiPecado',
    genero: 'Pagode',
    obs: 'Jogo',
  },
  {
    data: '2025-04-09',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-04-10',
    evento: 'Quinta de abril',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-11',
    evento: 'Pagode Vira-lata',
    artista: 'Gigi',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-12',
    evento: 'MSN',
    artista: 'DJ Tiago Jousef',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-04-13',
    evento: 'Algo Simples',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-04-15',
    evento: 'Não tem futebol',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-04-16',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-04-17',
    evento: 'Quinta de abril',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-18',
    evento: 'Pagode Vira-lata',
    artista: 'Cris Maciel',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-19',
    evento: 'R&Baile',
    artista: 'DJ Umiranda',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-04-20',
    evento: 'Uma Mesa e um Pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: 'Feriado',
  },
  {
    data: '2025-04-21',
    evento: 'Feriado',
    artista: '',
    genero: 'DJ',
    obs: 'Feriado',
  },
  {
    data: '2025-04-23',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-04-24',
    evento: 'Quinta de abril',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-25',
    evento: 'Pagode Vira-lata',
    artista: 'Tonzão',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-26',
    evento: 'R&Baile',
    artista: 'DJ Umiranda',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-04-27',
    evento: 'Uma Mesa e um Pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-04-30',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: 'Feriado',
  },

  // Maio 2025
  {
    data: '2025-05-01',
    evento: 'Pagode do Trabalhador',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-05-02',
    evento: 'Pagode Vira-lata',
    artista: 'Madu',
    genero: 'Pagode',
    obs: '',
  },
  { data: '2025-05-03', evento: 'R&Baile', artista: '', genero: 'DJ', obs: '' },
  {
    data: '2025-05-04',
    evento: 'Uma mesa e um pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-05-07',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  { data: '2025-05-08', evento: 'R&Baile', artista: '', genero: 'DJ', obs: '' },
  {
    data: '2025-05-09',
    evento: 'Pagode Vira Lata',
    artista: 'Paulinho',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-05-10',
    evento: 'ESPECIAL - JORGE ARAGAO',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-05-11',
    evento: 'Uma mesa e um pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-05-14',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  { data: '2025-05-15', evento: 'R&Baile', artista: '', genero: 'DJ', obs: '' },
  {
    data: '2025-05-16',
    evento: 'Pagode Vira Lata',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-05-17',
    evento: 'ESPECIAL - BETH CARVALHO',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-05-18',
    evento: 'Um Belo Domingo',
    artista: 'Lado a lado',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-05-21',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-05-22',
    evento: 'Modão e Viola',
    artista: 'Brener Viola',
    genero: 'Sertanejo',
    obs: '',
  },
  {
    data: '2025-05-23',
    evento: 'Pagode Vira Lata - Benzadeus',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-05-24',
    evento: 'ESPECIAL - "ZECA PAGODINHO"',
    artista: 'Nenel Vida',
    genero: 'Vocal',
    obs: '',
  },
  {
    data: '2025-05-25',
    evento: 'Uma mesa e um pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-05-28',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-05-29',
    evento: 'Sertanejo',
    artista: 'Lia Almeida',
    genero: 'Sertanejo',
    obs: '',
  },
  {
    data: '2025-05-30',
    evento: 'Pagode Vira Lata',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-05-31',
    evento: 'ESPECIAL - "ALCIONE"',
    artista: 'Karla Sangaletti',
    genero: 'Vocal',
    obs: '',
  },

  // Junho 2025
  {
    data: '2025-06-01',
    evento: 'Samba da tia zélia',
    artista: 'Tia zélia',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-06-02',
    evento: 'Jet - Segunda da Resenha',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-06-04',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-06-05',
    evento: 'Modão e Viola',
    artista: '',
    genero: 'Sertanejo',
    obs: '',
  },
  {
    data: '2025-06-06',
    evento: 'Pagode Vira-Lata',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-06-08',
    evento: 'Uma e Mesa e Um Pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-06-09',
    evento: 'Jet - Segunda da Resenha',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-06-11',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-06-12',
    evento: 'Moda e Viola',
    artista: 'Grazi Maciel',
    genero: 'Sertanejo',
    obs: '',
  },
  {
    data: '2025-06-13',
    evento: 'Pagode Vira-Lata',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-06-14',
    evento: 'Sambadona',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-06-15',
    evento: 'Uma e Mesa e Um Pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-06-16',
    evento: 'Jet - Segunda da Resenha',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-06-18',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: 'Feriado',
  },
  {
    data: '2025-06-19',
    evento: 'Moda e Viola',
    artista: 'Lia Almeida',
    genero: 'Sertanejo',
    obs: 'Feriado',
  },
  {
    data: '2025-06-20',
    evento: 'Pagode Vira-Lata',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-06-21',
    evento: 'Samba Rainha',
    artista: '',
    genero: 'Samba',
    obs: '',
  },
  {
    data: '2025-06-22',
    evento: 'Uma e Mesa e Um Pagode',
    artista: '12 por 8',
    genero: 'Pagode',
    obs: '',
  },
  {
    data: '2025-06-23',
    evento: 'Jet - Segunda da Resenha',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
  {
    data: '2025-06-25',
    evento: 'Quarta de Bamba',
    artista: 'Breno Alves',
    genero: 'Samba',
    obs: 'Festival Junino',
  },
  {
    data: '2025-06-26',
    evento: 'Moda e Viola',
    artista: 'Lia Almeida',
    genero: 'Sertanejo',
    obs: 'Festival Junino',
  },
  {
    data: '2025-06-27',
    evento: 'Pagode Vira-Lata',
    artista: 'Benzadeus',
    genero: 'Pagode',
    obs: 'Festival Junino',
  },
  {
    data: '2025-06-28',
    evento: 'Sambadona',
    artista: '',
    genero: 'DJ',
    obs: 'Festival Junino',
  },
  { data: '2025-06-29', evento: 'PDJ', artista: 'PDJ', genero: '', obs: '' },
  {
    data: '2025-06-30',
    evento: 'Jet - Segunda da Resenha',
    artista: '',
    genero: 'DJ',
    obs: '',
  },
];

export async function POST() {
  try {
    // Inicializar cliente Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    // 1. Limpar todos os eventos existentes do Bar Ordinário
    const { error: deleteError } = await supabase
      .from('eventos_base')
      .delete()
      .eq('bar_id', 1);

    if (deleteError) {
      console.error('❌ Erro ao deletar eventos:', deleteError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao deletar eventos existentes',
        details: deleteError,
      });
    }

    // 2. Inserir novos eventos
    const eventosParaInserir = attractionsData.map((item: AttractionItem) => ({
      bar_id: 1,
      nome: item.evento,
      nome_evento: item.evento,
      artista: item.artista || null,
      genero: item.genero,
      observacoes: item.obs || null,
      data_evento: item.data,
      ativo: true,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    }));

    const { data: insertedEvents, error: insertError } = await supabase
      .from('eventos_base')
      .insert(eventosParaInserir)
      .select();

    if (insertError) {
      console.error('❌ Erro ao inserir novos eventos:', insertError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao inserir novos eventos',
        details: insertError,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Atrações importadas com sucesso!',
      totalImported: insertedEvents?.length || 0,
      data: insertedEvents,
    });
  } catch (error: unknown) {
    console.error('❌ Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
