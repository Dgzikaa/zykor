import { AgentResponse } from './types';

export async function chamarAgenteSQLExpert(pergunta: string, barId: number): Promise<AgentResponse | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/agente-sql-expert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        bar_id: barId,
        pergunta: pergunta,
        tipo: 'consulta'
      })
    });

    if (!response.ok) {
      console.error('[Agente] Erro ao chamar agente-sql-expert:', await response.text());
      return null;
    }

    const data = await response.json();
    
    if (data.success && data.sql?.explicacao) {
      return {
        success: true,
        response: `🔍 **Análise Avançada**\n\n${data.sql.explicacao}${data.execucao?.resultado ? `\n\n**Resultado:** ${JSON.stringify(data.execucao.resultado, null, 2).substring(0, 500)}` : ''}`,
        agent: 'Agente SQL Expert',
        suggestions: data.sql.sugestoes_adicionais ? [data.sql.sugestoes_adicionais] : ['Ver faturamento', 'Analisar clientes', 'CMV semanal']
      };
    }
    
    return null;
  } catch (e) {
    console.error('[Agente] Erro ao chamar agente-sql-expert:', e);
    return null;
  }
}
