import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tbl } from '@/lib/supabase/table-schemas';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Gerar HTML para o relatório
function gerarHTMLRelatorio(dados: {
  periodo: string;
  resumo: {
    faturamento: number;
    meta: number;
    atingimento: number;
    clientes: number;
    ticketMedio: number;
    cmv: number;
  };
  insights: { categoria: string; insight: string; prioridade: number }[];
  topProdutos: { nome: string; valor: number; qtd: number }[];
}): string {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('pt-BR').format(Math.round(value));

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Zykor - ${dados.periodo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; background: white; }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .section { margin-bottom: 30px; }
    .section-title { 
      font-size: 18px; 
      font-weight: 600; 
      color: #333;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #eee;
    }
    .metrics-grid { 
      display: grid; 
      grid-template-columns: repeat(3, 1fr); 
      gap: 16px; 
    }
    .metric-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .metric-value { 
      font-size: 24px; 
      font-weight: 700; 
      color: #333;
      margin-bottom: 4px;
    }
    .metric-value.success { color: #22c55e; }
    .metric-value.warning { color: #f59e0b; }
    .metric-value.danger { color: #ef4444; }
    .metric-label { 
      font-size: 12px; 
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .insight-list { list-style: none; }
    .insight-item {
      padding: 12px 16px;
      margin-bottom: 8px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
      background: #f8f9fa;
    }
    .insight-item.priority-1 { border-left-color: #ef4444; background: #fef2f2; }
    .insight-item.priority-2 { border-left-color: #f59e0b; background: #fffbeb; }
    .insight-item.priority-3 { border-left-color: #22c55e; background: #f0fdf4; }
    .insight-category { 
      font-size: 10px; 
      text-transform: uppercase; 
      color: #666;
      letter-spacing: 0.5px;
    }
    .insight-text { font-size: 14px; color: #333; margin-top: 4px; }
    .products-table { width: 100%; border-collapse: collapse; }
    .products-table th, .products-table td { 
      padding: 12px 16px; 
      text-align: left; 
      border-bottom: 1px solid #eee;
    }
    .products-table th { 
      background: #f8f9fa; 
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
    }
    .products-table td { font-size: 14px; }
    .rank { 
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #667eea;
      color: white;
      font-size: 12px;
      font-weight: 600;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 12px;
      color: #999;
    }
    @media print {
      body { background: white; }
      .container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Relatório de Performance</h1>
      <p>Período: ${dados.periodo} | Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
    </div>

    <div class="section">
      <h2 class="section-title">📈 Métricas Principais</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">${formatCurrency(dados.resumo.faturamento)}</div>
          <div class="metric-label">Faturamento</div>
        </div>
        <div class="metric-card">
          <div class="metric-value ${dados.resumo.atingimento >= 100 ? 'success' : dados.resumo.atingimento >= 80 ? 'warning' : 'danger'}">
            ${dados.resumo.atingimento.toFixed(1)}%
          </div>
          <div class="metric-label">Meta Atingida</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${formatNumber(dados.resumo.clientes)}</div>
          <div class="metric-label">Clientes</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${formatCurrency(dados.resumo.ticketMedio)}</div>
          <div class="metric-label">Ticket Médio</div>
        </div>
        <div class="metric-card">
          <div class="metric-value ${dados.resumo.cmv <= 34 ? 'success' : dados.resumo.cmv <= 36 ? 'warning' : 'danger'}">
            ${dados.resumo.cmv.toFixed(1)}%
          </div>
          <div class="metric-label">CMV</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${formatCurrency(dados.resumo.meta)}</div>
          <div class="metric-label">Meta</div>
        </div>
      </div>
    </div>

    ${dados.insights.length > 0 ? `
    <div class="section">
      <h2 class="section-title">💡 Insights e Alertas</h2>
      <ul class="insight-list">
        ${dados.insights.map(i => `
          <li class="insight-item priority-${i.prioridade}">
            <div class="insight-category">${i.categoria}</div>
            <div class="insight-text">${i.insight}</div>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    ${dados.topProdutos.length > 0 ? `
    <div class="section">
      <h2 class="section-title">🏆 Top Produtos</h2>
      <table class="products-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Produto</th>
            <th>Valor</th>
            <th>Quantidade</th>
          </tr>
        </thead>
        <tbody>
          ${dados.topProdutos.slice(0, 10).map((p, i) => `
            <tr>
              <td><span class="rank">${i + 1}</span></td>
              <td>${p.nome}</td>
              <td>${formatCurrency(p.valor)}</td>
              <td>${formatNumber(p.qtd)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="footer">
      <p>🤖 Gerado automaticamente pelo Zykor Agent</p>
      <p>Sistema de Gestão de Bares - ${new Date().getFullYear()}</p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('barId') || '3';
    const periodo = searchParams.get('periodo') || 'semana';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    
    const dataInicio = periodo === 'mes' 
      ? inicioMes.toISOString().split('T')[0]
      : inicioSemana.toISOString().split('T')[0];

    // Buscar dados do período
    const { data: eventos } = await tbl(supabase, 'eventos_base')
      .select('real_r, m1_r, cl_real')
      .eq('bar_id', parseInt(barId))
      .eq('ativo', true)
      .gte('data_evento', dataInicio);

    const faturamento = eventos?.reduce((acc, e) => acc + (e.real_r || 0), 0) || 0;
    const meta = eventos?.reduce((acc, e) => acc + (e.m1_r || 0), 0) || 0;
    const clientes = eventos?.reduce((acc, e) => acc + (e.cl_real || 0), 0) || 0;
    const atingimento = meta > 0 ? (faturamento / meta * 100) : 0;
    const ticketMedio = clientes > 0 ? faturamento / clientes : 0;

    // Buscar CMV
    const { data: cmvData } = await tbl(supabase, 'cmv_semanal')
      .select('cmv_percentual')
      .eq('bar_id', parseInt(barId))
      .order('data_inicio', { ascending: false })
      .limit(1);

    const cmv = cmvData?.[0]?.cmv_percentual || 0;

    // Buscar insights recentes
    const { data: insights } = await supabase
      .from('agente_insights')
      .select('categoria, insight, prioridade')
      .eq('bar_id', parseInt(barId))
      .gte('created_at', dataInicio)
      .order('prioridade', { ascending: true })
      .limit(10);

    // Buscar top produtos
    const { data: produtosRaw } = await supabase
      .schema('silver' as never)
      .from('vendas_item')
      .select('produto_desc, quantidade, valor')
      .eq('bar_id', parseInt(barId))
      .gte('data_venda', dataInicio);

    // Agrupar produtos
    const produtosAgrupados: Record<string, { qtd: number; valor: number }> = {};
    produtosRaw?.forEach(p => {
      if (!p.produto_desc) return;
      if (!produtosAgrupados[p.produto_desc]) {
        produtosAgrupados[p.produto_desc] = { qtd: 0, valor: 0 };
      }
      produtosAgrupados[p.produto_desc].qtd += p.quantidade || 0;
      produtosAgrupados[p.produto_desc].valor += p.valor || 0;
    });

    const topProdutos = Object.entries(produtosAgrupados)
      .map(([nome, stats]) => ({ nome, ...stats }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    // Gerar HTML
    const html = gerarHTMLRelatorio({
      periodo: periodo === 'mes' 
        ? `${hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
        : `Semana de ${inicioSemana.toLocaleDateString('pt-BR')} a ${hoje.toLocaleDateString('pt-BR')}`,
      resumo: {
        faturamento,
        meta,
        atingimento,
        clientes,
        ticketMedio,
        cmv
      },
      insights: insights || [],
      topProdutos
    });

    // Retornar HTML (pode ser convertido para PDF no frontend)
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="relatorio-zykor-${periodo}.html"`
      }
    });

  } catch (error) {
    console.error('Erro ao exportar relatório:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
