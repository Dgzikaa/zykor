/**
 * Extrai o texto de uma resposta da API da Anthropic.
 *
 * POR QUE ISSO EXISTE: a resposta vem em BLOCOS, e do Sonnet 5 / Opus 5 em diante
 * o thinking eh ligado por padrao — entao `content[0]` costuma ser o bloco de
 * raciocinio (que vem com texto vazio), e nao a resposta. Quem le `content[0].text`
 * recebe string vazia SEM erro nenhum: a chamada custa os tokens, retorna 200, e o
 * dado some. Foi assim que 25 relatorios executivos foram gravados em branco entre
 * 06/07 e 03/08/2026 sem ninguem perceber.
 *
 * Sempre use isto em vez de indexar content[0].
 */
export function extrairTextoAnthropic(msg: { content?: unknown[] } | null | undefined): string {
  return ((msg?.content ?? []) as any[])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n')
    .trim();
}
