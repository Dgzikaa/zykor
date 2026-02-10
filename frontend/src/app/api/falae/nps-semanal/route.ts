import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Obter número da semana ISO
function getWeekNumber(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear();
  return { semana, ano };
}

// Calcular datas de uma semana ISO
function getWeekDates(ano: number, semana: number): { inicio: string; fim: string } {
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  
  const weekStart = new Date(firstMonday);
  weekStart.setUTCDate(firstMonday.getUTCDate() + (semana - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  
  return {
    inicio: weekStart.toISOString().split('T')[0],
    fim: weekEnd.toISOString().split('T')[0],
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const semana = searchParams.get('semana') ? parseInt(searchParams.get('semana')!) : null;
    const ano = searchParams.get('ano') ? parseInt(searchParams.get('ano')!) : null;
    
    // Se não passou semana/ano, pegar semana atual
    const hoje = new Date();
    const { semana: semanaAtual, ano: anoAtual } = getWeekNumber(hoje);
    
    const semanaFinal = semana || semanaAtual;
    const anoFinal = ano || anoAtual;
    
    const { inicio, fim } = getWeekDates(anoFinal, semanaFinal);

    // Buscar respostas da semana
    const { data: respostas, error } = await supabase
      .from('falae_respostas')
      .select('nps, created_at, criterios')
      .eq('bar_id', barId)
      .gte('created_at', inicio)
      .lte('created_at', fim + 'T23:59:59');

    if (error) {
      console.error('Erro ao buscar respostas:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    // Calcular NPS
    const total = respostas?.length || 0;
    const promotores = respostas?.filter(r => r.nps >= 9).length || 0;
    const detratores = respostas?.filter(r => r.nps <= 6).length || 0;
    const npsScore = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : null;
    const mediaNps = total > 0 ? Math.round((respostas.reduce((acc, r) => acc + r.nps, 0) / total) * 10) / 10 : null;

    // Calcular médias por critério
    const criteriosTotais: Record<string, { soma: number; count: number }> = {};
    
    respostas?.forEach(r => {
      if (r.criterios && Array.isArray(r.criterios)) {
        r.criterios.forEach((c: any) => {
          if (c.type === 'Rating' && c.name) {
            const nota = parseFloat(c.name);
            if (!isNaN(nota)) {
              const nick = c.nick || 'Geral';
              if (!criteriosTotais[nick]) {
                criteriosTotais[nick] = { soma: 0, count: 0 };
              }
              criteriosTotais[nick].soma += nota;
              criteriosTotais[nick].count++;
            }
          }
        });
      }
    });

    // Extrair métricas específicas
    const ambiente = criteriosTotais['AMBIENTE'] || criteriosTotais['Ambiente'];
    const atendimento = criteriosTotais['ATENDIMENTO'] || criteriosTotais['Atendimento'];
    const produtos = criteriosTotais['QUALIDADE DOS NOSSOS PRODUTOS'] || criteriosTotais['Produtos'];

    return NextResponse.json({
      semana: semanaFinal,
      ano: anoFinal,
      periodo: { inicio, fim },
      nps: {
        score: npsScore,
        media: mediaNps,
        total_respostas: total,
        promotores,
        detratores,
      },
      criterios: {
        ambiente: ambiente ? Math.round((ambiente.soma / ambiente.count) * 10) / 10 : null,
        atendimento: atendimento ? Math.round((atendimento.soma / atendimento.count) * 10) / 10 : null,
        produtos: produtos ? Math.round((produtos.soma / produtos.count) * 10) / 10 : null,
      },
    });

  } catch (error) {
    console.error('Erro na API de NPS semanal:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
