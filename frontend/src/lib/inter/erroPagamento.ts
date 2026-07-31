/**
 * Motivo REAL de uma falha de pagamento reportada pelo Inter.
 *
 * O Inter manda o porquê dentro de `erros[]` ({ codigoErro, descricaoErro }) — tanto no webhook
 * quanto no GET /banking/v2/pix/{codigo}. Até 31/07/2026 nada disso era gravado: o webhook
 * marcava o pedido como erro_inter e deixava `erro_mensagem` NULL, então a tela caía no
 * "Falha no pagamento (sem detalhe do banco)" e o financeiro não tinha como saber o que houve.
 * Aconteceu com os 4 cachês do Pagode Vira-Lata (R$ 2.150,00, 31/07 06:08–06:12): TODOS eram
 * "Saldo Insuficiente." (60168), e o motivo só existia no payload cru de inter_webhook_logs.
 *
 * Sem React e sem I/O de propósito: é a tradução do que o banco disse sobre dinheiro que não
 * saiu, então precisa ser lida e testada sem subir rota nenhuma.
 */

/** Um item de `erros[]` do Inter — os nomes variam de endpoint pra endpoint. */
function descreverErro(e: any): string | null {
  if (!e) return null;
  if (typeof e === 'string') return e.trim() || null;
  const desc = e.descricaoErro || e.descricao || e.mensagem || e.message || e.detail || e.title;
  const codigo = e.codigoErro || e.codigo || e.code;
  if (!desc) return codigo ? `Inter ${codigo}` : null;
  return codigo ? `${String(desc).trim()} (Inter ${codigo})` : String(desc).trim();
}

/**
 * Extrai o motivo da falha de um payload do Inter (webhook ou consulta). Devolve `null` quando
 * o banco não disse nada — aí quem chama decide o texto genérico (nunca deixe NULL: o card fica
 * sem explicação e o financeiro reenvia às cegas).
 */
export function motivoErroInter(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null;

  // Caminho normal: lista de erros. Junta todos (raro vir mais de um, mas quando vem, importa).
  const listas = [payload.erros, payload.errors, payload.transacaoPix?.erros, payload.pagamento?.erros];
  for (const lista of listas) {
    if (Array.isArray(lista) && lista.length) {
      const textos = lista.map(descreverErro).filter(Boolean) as string[];
      if (textos.length) return textos.join('; ');
    }
  }

  // Erro único / RFC 7807 (title + detail), que é o formato dos 4xx do Inter.
  const unico = descreverErro(payload.erro || payload.error || payload.falha);
  if (unico) return unico;
  if (payload.detail || payload.title) {
    return [payload.title, payload.detail].filter(Boolean).join(': ');
  }
  const solto = payload.descricaoErro || payload.motivo || payload.mensagemErro;
  return solto ? String(solto).trim() : null;
}

/**
 * Mensagem pronta pra gravar em `pedidos_pagamento.erro_mensagem`. Sempre devolve texto —
 * com o motivo do banco quando existe, e dizendo o status cru quando o Inter não detalhou.
 */
export function mensagemFalhaInter(payload: any, statusCru?: string | null): string {
  const motivo = motivoErroInter(payload);
  if (motivo) return motivo;
  const status = String(statusCru || '').trim();
  return status
    ? `Inter reportou ${status} sem detalhar o motivo. Confira o pagamento no app do Inter.`
    : 'O Inter recusou o pagamento sem detalhar o motivo. Confira no app do Inter.';
}
