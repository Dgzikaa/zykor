// [FUNÇÃO ATIVA] Gera relatórios em PDF (semanal, mensal, executivo, CMV, eventos)
// Uso confirmado em:
// - frontend/src/app/api/relatorio/route.ts (2 endpoints)
// - backend/supabase/functions/discord-dispatcher/index.ts
// - backend/supabase/functions/unified-dispatcher/index.ts
// Última verificação: 2026-04-04

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RelatorioRequest {
  tipo: 'semanal' | 'mensal' | 'executivo' | 'cmv' | 'eventos';
  barId?: number;
  periodo?: {
    inicio: string;
    fim: string;
  };
  formato?: 'html' | 'json';
  enviarPara?: 'discord' | 'email';
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { tipo, barId = 3, periodo, formato = 'html', enviarPara }: RelatorioRequest = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const hoje = new Date()
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    const formatPercent = (value: number) => `${value.toFixed(1)}%`
    const formatDate = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')

    // Definir período
    let dataInicio: string, dataFim: string
    if (periodo) {
      dataInicio = periodo.inicio
      dataFim = periodo.fim
    } else {
      // Padrão: última semana
      const fimSemana = new Date(hoje)
      fimSemana.setDate(fimSemana.getDate() - fimSemana.getDay())
      const inicioSemana = new Date(fimSemana)
      inicioSemana.setDate(inicioSemana.getDate() - 6)
      
      dataInicio = inicioSemana.toISOString().split('T')[0]
      dataFim = fimSemana.toISOString().split('T')[0]
    }

    // Buscar dados
    const { data: eventos } = await supabase
      .from('eventos_base')
      .select('*')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .gte('data_evento', dataInicio)
      .lte('data_evento', dataFim)
      .order('data_evento', { ascending: true })

    const { data: desempenho } = await supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', barId)
      .order('ano', { ascending: false })
      .order('numero_semana', { ascending: false })
      .limit(4)

    // Calcular métricas
    const faturamentoTotal = eventos?.reduce((a, e) => a + (e.real_r || 0), 0) || 0
    const metaTotal = eventos?.reduce((a, e) => a + (e.m1_r || 0), 0) || 0
    const publicoTotal = eventos?.reduce((a, e) => a + (e.cl_real || 0), 0) || 0
    const ticketMedio = publicoTotal > 0 ? faturamentoTotal / publicoTotal : 0
    const atingimento = metaTotal > 0 ? (faturamentoTotal / metaTotal * 100) : 0
    const cmvMedio = desempenho?.[0]?.cmv_global_real || 0
    const cmoMedio = desempenho?.[0]?.cmo || 0

    // Gerar conteúdo baseado no tipo
    let dados: any = {}
    let html = ''

    switch (tipo) {
      case 'semanal':
        dados = {
          titulo: `Relatório Semanal - ${formatDate(dataInicio)} a ${formatDate(dataFim)}`,
          resumo: {
            faturamento: { valor: faturamentoTotal, meta: metaTotal, atingimento },
            publico: publicoTotal,
            ticketMedio,
            cmv: cmvMedio,
            cmo: cmoMedio,
            qtdEventos: eventos?.length || 0
          },
          eventos: eventos?.map(e => ({
            data: formatDate(e.data_evento),
            nome: e.nome,
            diaSemana: e.dia_semana,
            faturamento: e.real_r,
            meta: e.m1_r,
            atingimento: e.m1_r > 0 ? ((e.real_r || 0) / e.m1_r * 100) : 0,
            publico: e.cl_real,
            ticketMedio: e.t_medio
          })),
          destaques: [
            atingimento >= 100 && '✅ Meta semanal atingida!',
            cmvMedio <= 34 && '✅ CMV dentro da meta',
            cmvMedio > 34 && `⚠️ CMV acima: ${formatPercent(cmvMedio)}`,
            atingimento < 80 && `⚠️ Atingimento baixo: ${formatPercent(atingimento)}`
          ].filter(Boolean)
        }

        html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${dados.titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f5f5f5; color: #333; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; }
    .header h1 { font-size: 24px; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .content { padding: 30px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
    .metric { background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; }
    .metric-value { font-size: 28px; font-weight: bold; color: #1e40af; }
    .metric-label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .metric-sub { font-size: 11px; color: #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 12px; color: #475569; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .success { color: #16a34a; }
    .warning { color: #d97706; }
    .danger { color: #dc2626; }
    .destaques { background: #fefce8; border-left: 4px solid #eab308; padding: 15px; margin-top: 20px; border-radius: 4px; }
    .destaques h3 { font-size: 14px; margin-bottom: 10px; color: #854d0e; }
    .destaques ul { list-style: none; font-size: 13px; }
    .destaques li { margin-bottom: 6px; }
    .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${dados.titulo}</h1>
      <p>Ordinário Bar • Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    </div>
    
    <div class="content">
      <div class="grid">
        <div class="metric">
          <div class="metric-value">${formatCurrency(dados.resumo.faturamento.valor)}</div>
          <div class="metric-label">Faturamento</div>
          <div class="metric-sub ${dados.resumo.faturamento.atingimento >= 100 ? 'success' : 'warning'}">
            ${formatPercent(dados.resumo.faturamento.atingimento)} da meta
          </div>
        </div>
        <div class="metric">
          <div class="metric-value">${dados.resumo.publico}</div>
          <div class="metric-label">Público Total</div>
          <div class="metric-sub">${dados.resumo.qtdEventos} eventos</div>
        </div>
        <div class="metric">
          <div class="metric-value">${formatCurrency(dados.resumo.ticketMedio)}</div>
          <div class="metric-label">Ticket Médio</div>
        </div>
        <div class="metric">
          <div class="metric-value ${dados.resumo.cmv <= 34 ? 'success' : 'warning'}">${formatPercent(dados.resumo.cmv)}</div>
          <div class="metric-label">CMV</div>
          <div class="metric-sub">Meta: 34%</div>
        </div>
        <div class="metric">
          <div class="metric-value ${dados.resumo.cmo <= 20 ? 'success' : 'warning'}">${formatPercent(dados.resumo.cmo)}</div>
          <div class="metric-label">CMO</div>
          <div class="metric-sub">Meta: 20%</div>
        </div>
        <div class="metric">
          <div class="metric-value">${formatCurrency(dados.resumo.faturamento.meta)}</div>
          <div class="metric-label">Meta Semanal</div>
        </div>
      </div>

      <h3 style="margin-bottom: 10px; color: #1e293b;">📅 Eventos da Semana</h3>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Evento</th>
            <th>Faturamento</th>
            <th>Ating.</th>
            <th>Público</th>
            <th>Ticket</th>
          </tr>
        </thead>
        <tbody>
          ${dados.eventos?.map((e: any) => `
            <tr>
              <td>${e.data} (${e.diaSemana?.substring(0, 3)})</td>
              <td>${e.nome || '-'}</td>
              <td>${formatCurrency(e.faturamento || 0)}</td>
              <td class="${e.atingimento >= 100 ? 'success' : e.atingimento >= 80 ? 'warning' : 'danger'}">${formatPercent(e.atingimento)}</td>
              <td>${e.publico || 0}</td>
              <td>${formatCurrency(e.ticketMedio || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${dados.destaques?.length > 0 ? `
        <div class="destaques">
          <h3>📌 Destaques</h3>
          <ul>
            ${dados.destaques.map((d: string) => `<li>${d}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>

    <div class="footer">
      Relatório gerado automaticamente pelo Sistema Zykor (SGB)
    </div>
  </div>
</body>
</html>
        `
        break

      case 'executivo':
        // Relatório executivo resumido
        dados = {
          titulo: 'Relatório Executivo',
          kpis: [
            { nome: 'Faturamento', valor: formatCurrency(faturamentoTotal), status: atingimento >= 100 ? 'ok' : 'atencao' },
            { nome: 'Atingimento', valor: formatPercent(atingimento), status: atingimento >= 100 ? 'ok' : 'atencao' },
            { nome: 'CMV', valor: formatPercent(cmvMedio), status: cmvMedio <= 34 ? 'ok' : 'atencao' },
            { nome: 'CMO', valor: formatPercent(cmoMedio), status: cmoMedio <= 20 ? 'ok' : 'atencao' },
            { nome: 'Ticket Médio', valor: formatCurrency(ticketMedio), status: 'ok' },
            { nome: 'Público', valor: publicoTotal.toString(), status: 'ok' }
          ]
        }

        html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Executivo</title>
  <style>
    body { font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto; }
    h1 { color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
    .kpi { display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
    .kpi-name { font-weight: 500; color: #374151; }
    .kpi-value { font-size: 18px; font-weight: bold; }
    .ok { color: #16a34a; }
    .atencao { color: #d97706; }
    .footer { margin-top: 30px; color: #9ca3af; font-size: 12px; }
  </style>
</head>
<body>
  <h1>📈 Relatório Executivo</h1>
  <p style="color: #6b7280; margin-bottom: 30px;">Período: ${formatDate(dataInicio)} a ${formatDate(dataFim)}</p>
  
  ${dados.kpis.map((kpi: any) => `
    <div class="kpi">
      <span class="kpi-name">${kpi.nome}</span>
      <span class="kpi-value ${kpi.status}">${kpi.valor}</span>
    </div>
  `).join('')}
  
  <p class="footer">Gerado em ${new Date().toLocaleString('pt-BR')} • Zykor SGB</p>
</body>
</html>
        `
        break

      case 'cmv':
        // Relatório específico de CMV
        const { data: cmvData } = await supabase
          .from('cmv_semanal')
          .select('*')
          .eq('bar_id', barId)
          .order('data_inicio', { ascending: false })
          .limit(4)

        dados = {
          titulo: 'Relatório de CMV',
          atual: cmvMedio,
          meta: 34,
          historico: cmvData || [],
          status: cmvMedio <= 30 ? 'excelente' : cmvMedio <= 34 ? 'bom' : cmvMedio <= 38 ? 'atencao' : 'critico'
        }

        html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório CMV</title>
  <style>
    body { font-family: system-ui; padding: 40px; max-width: 700px; margin: 0 auto; background: #f8fafc; }
    .card { background: white; border-radius: 12px; padding: 30px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { color: #0f172a; }
    .big-number { font-size: 48px; font-weight: bold; text-align: center; margin: 20px 0; }
    .excelente { color: #16a34a; }
    .bom { color: #65a30d; }
    .atencao { color: #d97706; }
    .critico { color: #dc2626; }
    .meta { text-align: center; color: #64748b; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📊 Análise de CMV</h1>
    <div class="big-number ${dados.status}">${formatPercent(dados.atual)}</div>
    <p class="meta">Meta: ${formatPercent(dados.meta)}</p>
    <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #64748b;">
      Status: <strong>${dados.status.toUpperCase()}</strong>
    </p>
  </div>
  <p style="color: #94a3b8; font-size: 12px; text-align: center;">Zykor SGB • ${new Date().toLocaleString('pt-BR')}</p>
</body>
</html>
        `
        break

      default:
        html = `<h1>Tipo de relatório não suportado</h1>`
    }

    // Enviar para Discord se solicitado
    if (enviarPara === 'discord') {
      const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')
      if (webhookUrl) {
        // Criar embed resumido para Discord
        const embed = {
          title: dados.titulo,
          color: atingimento >= 100 ? 0x22c55e : atingimento >= 80 ? 0xeab308 : 0xef4444,
          fields: [
            { name: '💰 Faturamento', value: formatCurrency(faturamentoTotal), inline: true },
            { name: '🎯 Atingimento', value: formatPercent(atingimento), inline: true },
            { name: '📊 CMV', value: formatPercent(cmvMedio), inline: true },
            { name: '👥 Público', value: publicoTotal.toString(), inline: true },
            { name: '🎟️ Ticket Médio', value: formatCurrency(ticketMedio), inline: true },
            { name: '📅 Eventos', value: `${eventos?.length || 0}`, inline: true }
          ],
          footer: { text: `Período: ${formatDate(dataInicio)} a ${formatDate(dataFim)}` },
          timestamp: new Date().toISOString()
        }

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Zykor Relatórios',
            avatar_url: 'https://zykor.com.br/logo.png',
            embeds: [embed]
          })
        })
      }
    }

    // Retornar formato solicitado
    if (formato === 'json') {
      return new Response(
        JSON.stringify({ success: true, data: dados }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8'
      }
    })

  } catch (error) {
    console.error('Erro no relatório:', error)
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
