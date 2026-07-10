'use client';

import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Upload, FileDown, Check } from 'lucide-react';

// Mesmos campos do cadastro "Novo freela".
const FUNCOES = ['Atendimento', 'Bar', 'Cozinha', 'Limpeza', 'Brigadista', 'Segurança', 'Outro'];
const TIPOS_CHAVE = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'];

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();

// Cabeçalho da planilha (qualquer variação) -> campo conhecido.
const COL_ALIASES: Record<string, string[]> = {
  nome: ['nome', 'name', 'freela', 'nome completo'],
  cpf_cnpj: ['cpf', 'cnpj', 'cpf/cnpj', 'cpf cnpj', 'cpf_cnpj', 'documento', 'doc'],
  funcao: ['funcao', 'funcao/cargo', 'cargo', 'setor', 'area'],
  chave_pix: ['chave pix', 'chave_pix', 'chavepix', 'pix', 'chave'],
  tipo_chave: ['tipo chave', 'tipo da chave', 'tipo_chave', 'tipo', 'tipo pix'],
  valor_padrao: ['valor', 'valor padrao', 'valor_padrao', 'diaria', 'valor da diaria', 'valor noite'],
};

function resolverColunas(headers: string[]): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const h of headers) {
    const nh = norm(h);
    for (const [campo, aliases] of Object.entries(COL_ALIASES)) {
      if (!mapa[campo] && aliases.includes(nh)) { mapa[campo] = h; break; }
    }
  }
  return mapa;
}

const parseValor = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  const t = String(v).replace(/[R$\s]/g, '');
  const n = parseFloat(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

// Normaliza a função pro rótulo canônico quando possível (senão mantém o texto da planilha).
const canonFuncao = (v: unknown): string => {
  const nv = norm(v);
  if (!nv) return 'Atendimento';
  return FUNCOES.find(f => norm(f) === nv) || String(v).trim();
};

// Usa o tipo informado; na falta, infere pela cara da chave PIX.
const inferTipoChave = (tipoCell: unknown, pix: string): string | null => {
  const t = norm(tipoCell);
  if (TIPOS_CHAVE.includes(t)) return t;
  const p = (pix || '').trim();
  if (!p) return null;
  if (p.includes('@')) return 'email';
  if (/[a-f0-9]{8}-[a-f0-9]{4}-/i.test(p)) return 'aleatoria';
  const digits = p.replace(/\D/g, '');
  if (digits.length === 14) return 'cnpj';
  if (digits.length === 11) return 'cpf';
  return null;
};

type Row = {
  nome: string; cpf_cnpj: string; funcao: string;
  chave_pix: string; tipo_chave: string | null; valor_padrao: number | null;
  erro?: string; dup?: boolean;
};

export function ImportarFreelasDialog({
  open, onOpenChange, onImportado, existentes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImportado: () => void;
  existentes: { nome: string }[];
}) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<Row[]>([]);
  const [arquivo, setArquivo] = useState<string>('');
  const [importando, setImportando] = useState(false);

  const nomesExistentes = useMemo(() => new Set(existentes.map(e => norm(e.nome))), [existentes]);

  const importaveis = useMemo(() => linhas.filter(r => !r.erro && !r.dup), [linhas]);
  const nDup = useMemo(() => linhas.filter(r => r.dup && !r.erro).length, [linhas]);
  const nErro = useMemo(() => linhas.filter(r => r.erro).length, [linhas]);

  const reset = () => { setLinhas([]); setArquivo(''); if (inputRef.current) inputRef.current.value = ''; };

  const onFile = async (file: File) => {
    setArquivo(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (!json.length) { setLinhas([]); return showToast({ type: 'error', title: 'Planilha vazia' }); }

      const cols = resolverColunas(Object.keys(json[0]));
      if (!cols.nome) {
        setLinhas([]);
        return showToast({ type: 'error', title: 'Coluna “nome” não encontrada', message: 'Baixe o modelo pra ver as colunas esperadas.' });
      }

      const rows: Row[] = json.map((r) => {
        const nome = String(r[cols.nome] ?? '').trim();
        const cpf_cnpj = cols.cpf_cnpj ? String(r[cols.cpf_cnpj] ?? '').replace(/\D/g, '') : '';
        const chave_pix = cols.chave_pix ? String(r[cols.chave_pix] ?? '').trim() : '';
        const funcao = cols.funcao ? canonFuncao(r[cols.funcao]) : 'Atendimento';
        const tipo_chave = inferTipoChave(cols.tipo_chave ? r[cols.tipo_chave] : '', chave_pix);
        const valor_padrao = cols.valor_padrao ? parseValor(r[cols.valor_padrao]) : null;
        return {
          nome, cpf_cnpj, funcao, chave_pix, tipo_chave, valor_padrao,
          erro: !nome ? 'sem nome' : undefined,
          dup: !!nome && nomesExistentes.has(norm(nome)),
        };
      }).filter(r => r.nome || r.cpf_cnpj || r.chave_pix); // descarta linhas totalmente vazias

      setLinhas(rows);
      if (!rows.length) showToast({ type: 'error', title: 'Nenhuma linha válida na planilha' });
    } catch (e: unknown) {
      setLinhas([]);
      showToast({ type: 'error', title: 'Erro ao ler a planilha', message: (e as Error)?.message });
    }
  };

  const baixarModelo = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['nome', 'cpf_cnpj', 'funcao', 'chave_pix', 'tipo_chave', 'valor_padrao'],
      ['João da Silva', '12345678901', 'Bar', '12345678901', 'cpf', '120,00'],
      ['Maria Souza', '', 'Cozinha', 'maria@email.com', 'email', '150,00'],
    ]);
    ws['!cols'] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 26 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Freelas');
    XLSX.writeFile(wb, 'modelo-freelas.xlsx');
  };

  const importar = async () => {
    if (!importaveis.length) return;
    setImportando(true);
    let ok = 0, dup = 0; const falhas: string[] = [];
    for (const r of importaveis) {
      try {
        await api.post('/api/financeiro/beneficiarios', {
          nome: r.nome,
          cpf_cnpj: r.cpf_cnpj || null,
          tipo: 'freela',
          funcao: r.funcao,
          chave_pix: r.chave_pix || null,
          tipo_chave: r.tipo_chave,
          valor_padrao: r.valor_padrao,
        });
        ok++;
      } catch (e: unknown) {
        const msg = (e as Error)?.message || '';
        if (/já existe|duplic|409/i.test(msg)) dup++;
        else falhas.push(`${r.nome}: ${msg || 'falhou'}`);
      }
    }
    if (ok) showToast({ type: 'success', title: `${ok} freela(s) importado(s)`, message: dup ? `${dup} já existiam (ignorados).` : undefined });
    else if (dup) showToast({ type: 'success', title: `${dup} já existiam — nada novo importado` });
    if (falhas.length) showToast({ type: 'error', title: `${falhas.length} não importado(s)`, message: falhas[0] + (falhas.length > 1 ? ` (+${falhas.length - 1})` : '') });
    setImportando(false);
    reset();
    onOpenChange(false);
    onImportado();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importando) { if (!v) reset(); onOpenChange(v); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar freelas de planilha</DialogTitle>
          <DialogDescription>
            Colunas: nome, cpf_cnpj, funcao, chave_pix, tipo_chave, valor_padrao. Só o nome é obrigatório.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 overflow-y-auto space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv"
              className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1.5" />{arquivo ? 'Trocar planilha' : 'Escolher planilha'}
            </Button>
            <Button type="button" variant="ghost" onClick={baixarModelo}>
              <FileDown className="w-4 h-4 mr-1.5" />Baixar modelo
            </Button>
            {arquivo && <span className="text-xs text-muted-foreground truncate">{arquivo}</span>}
          </div>

          {linhas.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className="bg-emerald-500/15 text-emerald-600">{importaveis.length} a importar</Badge>
                {nDup > 0 && <Badge className="bg-amber-500/15 text-amber-600">{nDup} já existem</Badge>}
                {nErro > 0 && <Badge className="bg-red-500/15 text-red-600">{nErro} sem nome</Badge>}
              </div>

              <div className="border rounded-md max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">Nome</th>
                      <th className="px-2 py-1.5 font-medium">CPF/CNPJ</th>
                      <th className="px-2 py-1.5 font-medium">Função</th>
                      <th className="px-2 py-1.5 font-medium">Chave PIX</th>
                      <th className="px-2 py-1.5 font-medium">Tipo</th>
                      <th className="px-2 py-1.5 font-medium text-right">Valor</th>
                      <th className="px-2 py-1.5 font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((r, i) => (
                      <tr key={i} className={`border-t ${r.erro ? 'bg-red-500/[0.04]' : r.dup ? 'bg-amber-500/[0.04]' : ''}`}>
                        <td className="px-2 py-1.5 truncate max-w-[160px]">{r.nome || <span className="text-red-500">—</span>}</td>
                        <td className="px-2 py-1.5">{r.cpf_cnpj || '—'}</td>
                        <td className="px-2 py-1.5">{r.funcao}</td>
                        <td className="px-2 py-1.5 truncate max-w-[160px]">{r.chave_pix || <span className="text-amber-600">sem PIX</span>}</td>
                        <td className="px-2 py-1.5">{r.tipo_chave || '—'}</td>
                        <td className="px-2 py-1.5 text-right">{r.valor_padrao != null ? r.valor_padrao.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-2 py-1.5">
                          {r.erro ? <span className="text-red-600">sem nome</span>
                            : r.dup ? <span className="text-amber-600">já existe</span>
                            : <span className="text-emerald-600 flex items-center gap-1"><Check className="w-3 h-3" />ok</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Linhas “já existe” (mesmo nome) e sem nome são ignoradas. CPF/CNPJ repetido é barrado pelo sistema na importação.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importando}>Cancelar</Button>
          <Button onClick={importar} disabled={importando || importaveis.length === 0}>
            {importando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</> : `Importar ${importaveis.length || ''} freela(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
