import fs from 'fs';
import path from 'path';

// Cache dos certificados para evitar recarregar
let cachedCert: Buffer | null = null;
let cachedKey: Buffer | null = null;

export function getInterCertificates(): { cert: Buffer; key: Buffer } {
  if (cachedCert && cachedKey) {
    return { cert: cachedCert, key: cachedKey };
  }

  // 1. PRIORIDADE: Variáveis de ambiente (Vercel)
  // Suporta: INTER_CERT/INTER_KEY, inter_cert/inter_key, ou INTER_CERT_BASE64/INTER_KEY_BASE64
  const certEnv = process.env.INTER_CERT || process.env.inter_cert || process.env.INTER_CERT_BASE64;
  const keyEnv = process.env.INTER_KEY || process.env.inter_key || process.env.INTER_KEY_BASE64;
  
  if (certEnv && keyEnv) {
    const cert = Buffer.from(certEnv, 'base64');
    const key = Buffer.from(keyEnv, 'base64');

    console.log('📄 Certificado Base64 (env) carregado:', cert.length, 'bytes');
    console.log(
      '🔑 Chave privada Base64 (env) carregada:',
      key.length,
      'bytes'
    );

    cachedCert = cert;
    cachedKey = key;
    return { cert, key };
  }

  // 2. Tentar carregar certificados PEM de src/lib/inter (desenvolvimento local)
  const certPath = path.join(
    process.cwd(),
    'src',
    'lib',
    'inter',
    'fullchain.pem'
  );
  const keyPath = path.join(process.cwd(), 'src', 'lib', 'inter', 'key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);

    console.log('📄 Certificado PEM carregado:', cert.length, 'bytes');
    console.log('🔑 Chave privada PEM carregada:', key.length, 'bytes');

    cachedCert = cert;
    cachedKey = key;
    return { cert, key };
  }

  // NOTA: o fallback antigo que lia de public/inter/*.txt foi REMOVIDO por segurança
  // (public/ é servido na web → chave privada mTLS ficava exposta). Os certificados
  // de produção vêm do bucket privado `inter` (por credencial, via configuracoes.cert_file)
  // ou de INTER_CERT/INTER_KEY no Vercel. Nunca colocar certificado em public/.

  throw new Error(
    'Certificados mTLS não encontrados. Configure INTER_CERT e INTER_KEY no Vercel (base64) ou cert_file/key_file na credencial (bucket inter).'
  );
}
