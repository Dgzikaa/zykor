import { decodificarBoleto, type BoletoDecodificado } from './boletoBarcode';

/**
 * Decodifica o código de barras (ITF, 44 díg.) de um boleto a partir de uma IMAGEM PARADA —
 * foto tirada na câmera OU arquivo enviado. Foto parada decodifica MUITO melhor que vídeo ao
 * vivo: sem blur de movimento e na resolução cheia, o ZXing pega o ITF fininho do boleto que
 * quase nunca fecha no stream. Client-side, ZXing carregado sob demanda. Retorna a linha
 * digitável válida (+ valor/venc) ou null se não achar/validar — aí o chamador cai na IA.
 */
export async function lerBarcodeDaImagem(file: File): Promise<BoletoDecodificado | null> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return null;
  let url = '';
  try {
    const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);
    const hints = new Map<number, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.ITF]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints as any);
    url = URL.createObjectURL(file);
    const result: any = await reader.decodeFromImageUrl(url);
    const texto = String(result?.getText?.() ?? result?.text ?? '').replace(/\D/g, '');
    if (texto.length !== 44) return null; // boleto = 44 dígitos
    const dados = decodificarBoleto(texto);
    return dados.valido ? dados : null;
  } catch {
    return null; // não achou o código na imagem → o chamador tenta a IA
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}
