import https from 'https';
import { getInterCertificates } from './certificates';
import crypto from 'crypto';

interface PixPaymentParams {
  token: string;
  contaCorrente: string;
  valor: number;
  descricao: string;
  chave: string;
  mtlsCredentials?: { cert: Buffer; key: Buffer };
}

export async function realizarPagamentoPixInter(
  params: PixPaymentParams
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { token, contaCorrente, valor, descricao, chave, mtlsCredentials } = params;

    console.log('🔐 Iniciando pagamento PIX com https.request...');

    // Carregar certificados PEM usando função centralizada
    const { cert, key } = mtlsCredentials || getInterCertificates();
    
    console.log('🔐 Certificados para pagamento:', {
      certPresent: !!cert,
      keyPresent: !!key,
      certSize: cert?.length || 0,
      keySize: key?.length || 0,
      fromMtlsCredentials: !!mtlsCredentials
    });

    // Preparar payload conforme documentação Inter Banking
    // A documentação diz valor: number <double>
    const payload = {
      valor: Math.round(valor * 100) / 100, // número com 2 decimais
      descricao: descricao || 'Pagamento PIX',
      destinatario: {
        tipo: 'CHAVE',
        chave: chave,
      },
    };

    // Serializar payload para calcular Content-Length
    const payloadStr = JSON.stringify(payload);

    console.log('📦 Payload para PIX:', payloadStr);

    // Configurar requisição HTTPS com mTLS (exatamente como debug-auth)
    const options = {
      hostname: 'cdpj.partners.bancointer.com.br',
      port: 443,
      path: '/banking/v2/pix',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
        'x-conta-corrente': contaCorrente,
        'x-id-idempotente': crypto.randomUUID(),
        'Content-Length': Buffer.byteLength(payloadStr),
      },
      cert,
      key,
    };
    
    console.log('🔐 Headers para PIX:', {
      ...options.headers,
      Authorization: `Bearer ${token.substring(0, 20)}...`,
    });

    // Fazer requisição HTTPS
    const response = await new Promise<{ statusCode: number; body: string }>(
      (resolve, reject) => {
        const request = https.request(options, response => {
          console.log('📡 Status da resposta PIX:', response.statusCode);
          console.log('📡 Headers da resposta PIX:', response.headers);

          let body = '';
          response.on('data', chunk => (body += chunk));
          response.on('end', () => {
            console.log('📡 Corpo da resposta PIX:', body);

            resolve({
              statusCode: response.statusCode || 500,
              body,
            });
          });
        });

        request.on('error', error => {
          console.log('❌ Erro na requisição HTTPS PIX:', error);
          reject(error);
        });

        request.write(payloadStr);
        request.end();
      }
    );

    if (response.statusCode === 200) {
      const data = JSON.parse(response.body);
      console.log('✅ Pagamento PIX realizado com sucesso!');
      console.log('📡 Data:', data);

      return {
        success: true,
        data: data,
      };
    } else {
      console.error('❌ Erro no pagamento PIX:', response.body);

      // Tratar resposta vazia ou não-JSON
      let errorMessage = `Erro ${response.statusCode}`;

      if (response.body && response.body.trim()) {
        try {
          const errorData = JSON.parse(response.body);
          const title = errorData.title || `Erro ${response.statusCode}`;
          const detail = errorData.detail ? String(errorData.detail) : '';
          errorMessage = detail ? `${title}: ${detail}` : title;
        } catch (parseError) {
          errorMessage = `Erro ${response.statusCode}: ${response.body}`;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error: any) {
    console.error('❌ Erro ao realizar pagamento PIX:', error);
    return {
      success: false,
      error: 'Erro na comunicação com o banco',
    };
  }
}
