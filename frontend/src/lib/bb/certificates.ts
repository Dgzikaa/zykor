import { createClient } from '@supabase/supabase-js';

/**
 * Carrega o Certificado A1 (mTLS) do Banco do Brasil a partir do bucket privado `bb`
 * no Supabase Storage, referenciado por credencial via configuracoes.cert_file/key_file.
 *
 * NUNCA colocar certificado em public/ — é servido na web. Mesmo erro que vazou a
 * chave do Inter (corrigido em 2026-06). Bucket `bb` deve ser public:false.
 *
 * Requisitos do BB: Certificado A1 emitido por CA válida (ICP-Brasil), validade > 1 ano,
 * self-signed NÃO é aceito.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface MtlsCredentials {
  cert: Buffer;
  key: Buffer;
}

/**
 * Baixa cert + key do bucket privado `bb`. Aceita os mesmos aliases de campo que o Inter
 * (cert_file/cert_path/certificate_file e key_file/key_path/private_key_file).
 * Retorna null se a credencial não referenciar arquivos (deixa o caller decidir o erro).
 */
export async function loadBBCertificates(
  configuracoes: any
): Promise<MtlsCredentials | null> {
  const certFile =
    configuracoes?.cert_file ||
    configuracoes?.cert_path ||
    configuracoes?.certificate_file ||
    null;
  const keyFile =
    configuracoes?.key_file ||
    configuracoes?.key_path ||
    configuracoes?.private_key_file ||
    null;

  if (!certFile || !keyFile) {
    return null;
  }

  const { data: certBlob, error: certError } = await supabase.storage
    .from('bb')
    .download(certFile);
  if (certError || !certBlob) {
    throw new Error(`Não foi possível baixar certificado A1 no bucket bb: ${certFile}`);
  }

  const { data: keyBlob, error: keyError } = await supabase.storage
    .from('bb')
    .download(keyFile);
  if (keyError || !keyBlob) {
    throw new Error(`Não foi possível baixar chave privada no bucket bb: ${keyFile}`);
  }

  return {
    cert: Buffer.from(await certBlob.arrayBuffer()),
    key: Buffer.from(await keyBlob.arrayBuffer()),
  };
}
