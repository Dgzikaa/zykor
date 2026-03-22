import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

interface PrevisaoInput {
  data: string;
  dia_semana: string;
  atracao?: string;
  evento_especial?: string;
}

interface HistoricoMesmoDia {
  data: string;
  faturamento: number;
  publico: number;
  atracao: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, bar_id } = body;

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Data é obrigatória' },
        { status: 400 }
      );
    }

    const dataObj = new Date(data + 'T12:00:00Z');
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const diaSemana = diasSemana[dataObj.getDay()];

    // 1. Buscar histórico do mesmo dia da semana
    const { data: historico } = await supabase
      .from('eventos_base')
      .select('data_evento, real_r, cl_real, nome, t_medio')
      .eq('bar_id', bar_id)
      .gt('real_r', 1000)
      .order('data_evento', { ascending: false })
      .limit(100);

    // Filtrar apenas mesmo dia da semana
    const historicoMesmoDia = historico?.filter(h => {
      const d = new Date(h.data_evento + 'T12:00:00Z');
      return d.getDay() === dataObj.getDay();
    }).slice(0, 8) || [];

    // 2. Buscar evento agendado para a data
    const { data: eventoAgendado } = await supabase
      .from('eventos_base')
      .select('nome, artista, cl_plan, m1_r')
      .eq('bar_id', bar_id)
      .eq('data_evento', data)
      .single();

    // 3. Calcular estatísticas
    const faturamentos = historicoMesmoDia.map(h => parseFloat(h.real_r) || 0);
    const publicos = historicoMesmoDia.map(h => h.cl_real || 0);
    
    const mediaFat = faturamentos.length > 0 
      ? faturamentos.reduce((a, b) => a + b, 0) / faturamentos.length 
      : 0;
    const mediaPax = publicos.length > 0 
      ? publicos.reduce((a, b) => a + b, 0) / publicos.length 
      : 0;
    
    // Tendência (últimas 4 vs anteriores)
    let tendencia = 0;
    if (faturamentos.length >= 4) {
      const recentes = faturamentos.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
      const anteriores = faturamentos.slice(4).length > 0
        ? faturamentos.slice(4).reduce((a, b) => a + b, 0) / faturamentos.slice(4).length
        : recentes;
      tendencia = ((recentes - anteriores) / anteriores) * 100;
    }

    // 4. Buscar padrões detectados
    const { data: padroes } = await supabase
      .from('agente_padroes_detectados')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('status', 'ativo')
      .or(`tipo.eq.tendencia_dia_semana,tipo.eq.atracao_alta_performance`);

    // 5. Calcular previsão base
    let previsaoBase = mediaFat;
    
    // Ajustar por tendência
    if (tendencia !== 0) {
      previsaoBase = previsaoBase * (1 + (tendencia / 100) * 0.3); // Aplica 30% da tendência
    }

    // Ajustar por meta planejada (se existir)
    if (eventoAgendado?.m1_r && parseFloat(eventoAgendado.m1_r) > 0) {
      const meta = parseFloat(eventoAgendado.m1_r);
      previsaoBase = (previsaoBase + meta) / 2; // Média entre histórico e meta
    }

    // 6. Gerar análise com IA (se disponível)
    let analiseIA: {
      previsao_faturamento?: number;
      previsao_publico?: number;
      confianca?: number;
      fatores_positivos?: string[];
      fatores_negativos?: string[];
      recomendacao?: string;
    } | null = null;
    
    if (GEMINI_API_KEY && historicoMesmoDia.length >= 3) {
      try {
        const prompt = `Você é um analista de dados de um bar. Baseado nos dados abaixo, faça uma previsão para ${diaSemana} ${data}.

HISTÓRICO (últimas ${historicoMesmoDia.length} ${diaSemana}s):
${historicoMesmoDia.map(h => `- ${h.data_evento}: R$ ${parseFloat(h.real_r).toFixed(2)}, ${h.cl_real} PAX, ${h.nome || 'Sem atração'}`).join('\n')}

ESTATÍSTICAS:
- Média faturamento: R$ ${mediaFat.toFixed(2)}
- Média público: ${mediaPax.toFixed(0)} PAX
- Tendência: ${tendencia > 0 ? '+' : ''}${tendencia.toFixed(1)}%

${eventoAgendado ? `EVENTO AGENDADO: ${eventoAgendado.nome}` : 'Sem evento agendado'}

Responda em JSON com:
{
  "previsao_faturamento": number,
  "previsao_publico": number,
  "confianca": number (0-100),
  "fatores_positivos": ["..."],
  "fatores_negativos": ["..."],
  "recomendacao": "..."
}`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
          {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { 
                temperature: 0.3, 
                maxOutputTokens: 500
              }
            })
          }
        );

        if (response.ok) {
          const result = await response.json();
          const texto = result.candidates?.[0]?.content?.parts?.[0]?.text;
          
          // Extrair JSON da resposta
          const jsonMatch = texto?.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analiseIA = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (error) {
        console.error('Erro ao gerar análise IA:', error);
      }
    }

    // 7. Montar resposta
    const previsaoFinal = analiseIA?.previsao_faturamento || previsaoBase;
    const publicoFinal = analiseIA?.previsao_publico || Math.round(mediaPax * (1 + (tendencia / 100) * 0.3));

    // Calcular intervalo de confiança
    const desvio = faturamentos.length > 1
      ? Math.sqrt(faturamentos.reduce((sum, f) => sum + Math.pow(f - mediaFat, 2), 0) / faturamentos.length)
      : mediaFat * 0.2;
    
    const previsaoMinima = Math.max(0, previsaoFinal - desvio);
    const previsaoMaxima = previsaoFinal + desvio;

    return NextResponse.json({
      success: true,
      data: {
        data,
        dia_semana: diaSemana,
        evento_agendado: eventoAgendado?.nome || null,
        
        previsao: {
          faturamento: Math.round(previsaoFinal),
          publico: publicoFinal,
          faturamento_minimo: Math.round(previsaoMinima),
          faturamento_maximo: Math.round(previsaoMaxima),
          confianca: analiseIA?.confianca || (historicoMesmoDia.length >= 6 ? 80 : historicoMesmoDia.length >= 3 ? 60 : 40)
        },
        
        historico: {
          media_faturamento: Math.round(mediaFat),
          media_publico: Math.round(mediaPax),
          tendencia_percentual: Math.round(tendencia * 10) / 10,
          amostras: historicoMesmoDia.length,
          ultimos_eventos: historicoMesmoDia.slice(0, 4).map(h => ({
            data: h.data_evento,
            faturamento: parseFloat(h.real_r),
            publico: h.cl_real,
            evento: h.nome
          }))
        },
        
        analise_ia: analiseIA,
        padroes_aplicados: padroes?.map(p => p.descricao) || []
      }
    });

  } catch (error) {
    console.error('Erro na previsão:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao gerar previsão' },
      { status: 500 }
    );
  }
}

// GET para listar previsões da semana
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    if (!barIdParam) {
      return NextResponse.json(
        { success: false, error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = barIdParam;
    
    const hoje = new Date();
    const previsoes: any[] = [];
    
    // Gerar previsões para os próximos 7 dias
    for (let i = 0; i < 7; i++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() + i);
      const dataStr = data.toISOString().split('T')[0];
      
      // Chamar a própria API internamente
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/agente/previsao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataStr, bar_id: parseInt(barId) })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          previsoes.push(result.data);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: previsoes
    });
    
  } catch (error) {
    console.error('Erro ao listar previsões:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao listar previsões' },
      { status: 500 }
    );
  }
}
