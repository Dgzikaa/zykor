/**
 * Regras de anexo de documentos do RH (dossiê do funcionário).
 *
 * Compartilhado entre o cliente (validação antes de subir) e as rotas de API — o limite e a
 * lista de tipos precisam ser os MESMOS dos dois lados, senão o usuário só descobre o problema
 * depois de esperar o upload inteiro.
 *
 * IMPORTANTE: o arquivo NÃO passa mais pela função da Vercel (o corpo de requisição tem teto de
 * ~4,5 MB lá, e PDF escaneado de várias páginas estoura isso — a requisição morria na borda,
 * antes da função rodar, e o front só via "Falha no upload"). O fluxo agora é:
 *   1) POST /documentos/upload-url  -> servidor devolve URL assinada do Storage
 *   2) browser sobe o arquivo DIRETO pro Supabase Storage (sem passar pela Vercel)
 *   3) POST /documentos (JSON)      -> servidor confere o arquivo no bucket e grava a linha
 */

export const BUCKET_DOCS_RH = 'rh-documentos';

/**
 * Catálogo dos tipos de documento — fonte única do seletor de upload e dos alertas.
 *
 * Estavam separados: o dossiê oferecia 7 tipos e `lib/rh/alertas.ts` conhecia 5, mas só avisava a
 * falta de DOIS. Era a queixa da ata de 13/08/2026: "aviso de todos os tipos de documentos faltando
 * hoje ele ta so mostrando: Sem exame admissional / Sem contrato anexado — teria que mostrar os
 * outros". Quem é `obrigatorio` alerta enquanto não houver arquivo daquele tipo anexado.
 */
export type TipoDocumento = { id: string; label: string; obrigatorio: boolean };

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  { id: 'carteira_trabalho', label: 'Carteira de Trabalho', obrigatorio: true },
  { id: 'rg_cpf', label: 'RG / CPF', obrigatorio: true },
  { id: 'exame_admissional', label: 'Exame Admissional', obrigatorio: true },
  { id: 'contrato', label: 'Contrato', obrigatorio: true },
  // pedido da ata: o termo assinado é outra coisa que "uniforme entregue" no checklist
  { id: 'termo_uniforme', label: 'Termo de Recebimento de Uniforme', obrigatorio: true },
  { id: 'certidao_nascimento', label: 'Certidão de Nascimento', obrigatorio: false },
  { id: 'titulo_eleitoral', label: 'Título Eleitoral', obrigatorio: false },
  { id: 'outro', label: 'Outro', obrigatorio: false },
];

export const LABEL_DOC: Record<string, string> = Object.fromEntries(
  TIPOS_DOCUMENTO.map((t) => [t.id, t.label]),
);

export const DOCS_OBRIGATORIOS = TIPOS_DOCUMENTO.filter((t) => t.obrigatorio);

/**
 * Teto do bucket (storage.buckets.file_size_limit). Manter em sincronia com a migration.
 *
 * 40 MB, não 50: o teto DURO do projeto Supabase é 50 MB por arquivo (testado — 49 MB sobe,
 * 50 MB o Storage recusa). Os 10 MB de folga evitam o caso de a tela prometer um limite que o
 * Storage rejeita na hora H. Se um dia precisar de mais, aumentar antes o "Upload file size limit"
 * do projeto no dashboard do Supabase — mexer só aqui não adianta.
 */
export const MAX_DOC_BYTES = 40 * 1024 * 1024;

/** Acima disso o envio começa a demorar no 4G — vale avisar, mas não bloquear. */
export const AVISO_DOC_PESADO_BYTES = 15 * 1024 * 1024;

/** Mime por extensão — celular/scanner às vezes manda o arquivo SEM content-type (file.type vazio). */
export const MIME_POR_EXT: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
};

/** Tipos aceitos pelo bucket (storage.buckets.allowed_mime_types). */
export const MIMES_ACEITOS = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
];

export function mimeDoArquivo(nome: string, tipoInformado?: string | null): string {
  if (tipoInformado && MIMES_ACEITOS.includes(tipoInformado)) return tipoInformado;
  const ext = (nome.split('.').pop() || '').toLowerCase();
  return MIME_POR_EXT[ext] || tipoInformado || 'application/octet-stream';
}

export function formataMb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
}

/** Devolve a mensagem de erro (pt-BR) ou null se o arquivo pode subir. */
export function validaDocumento(nome: string, tipoInformado: string | null, bytes: number): string | null {
  if (!nome) return 'Arquivo sem nome.';
  if (!bytes) return 'Arquivo vazio.';
  if (bytes > MAX_DOC_BYTES) {
    return `Arquivo de ${formataMb(bytes)} — o limite é ${formataMb(MAX_DOC_BYTES)}. `
      + 'Se for um PDF escaneado, gere em qualidade menor (o scanner costuma ter opção "média") '
      + 'ou divida em partes.';
  }
  const mime = mimeDoArquivo(nome, tipoInformado);
  if (!MIMES_ACEITOS.includes(mime)) {
    return `Tipo de arquivo não aceito (${mime}). Envie PDF ou foto (JPG/PNG/HEIC).`;
  }
  return null;
}

/** Nome de arquivo seguro para o path do Storage. */
export function nomeSeguro(nome: string): string {
  return nome.replace(/[^\w.\-]+/g, '_').slice(-120);
}
