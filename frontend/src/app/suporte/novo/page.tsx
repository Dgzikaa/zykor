'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft,
  Send,
  Bug,
  Lightbulb,
  HelpCircle,
  MessageSquare,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface CategoriaOption {
  id: string;
  label: string;
  descricao: string;
  icon: string;
}

interface ModuloOption {
  id: string;
  label: string;
  descricao: string;
}

interface PrioridadeOption {
  id: string;
  label: string;
  descricao: string;
  color: string;
  sla_horas: number;
}

const iconMap: Record<string, React.ElementType> = {
  bug: Bug,
  lightbulb: Lightbulb,
  'help-circle': HelpCircle,
  'message-square': MessageSquare,
  'alert-triangle': AlertTriangle
};

export default function NovoChamadoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<CategoriaOption[]>([]);
  const [modulos, setModulos] = useState<ModuloOption[]>([]);
  const [prioridades, setPrioridades] = useState<PrioridadeOption[]>([]);
  
  // Form state
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('duvida');
  const [modulo, setModulo] = useState('outro');
  const [prioridade, setPrioridade] = useState('media');

  const barId = 3; // TODO: Pegar do contexto do usuário
  const userId = 'b9e11c73-c4ce-42f0-b4a8-d7d41ef6beff'; // TODO: Pegar do contexto do usuário
  const userName = 'Usuário'; // TODO: Pegar do contexto do usuário

  useEffect(() => {
    fetchCategorias();
  }, []);

  const fetchCategorias = async () => {
    try {
      const response = await fetch('/api/suporte/categorias');
      const result = await response.json();
      if (result.success) {
        setCategorias(result.data.categorias);
        setModulos(result.data.modulos);
        setPrioridades(result.data.prioridades);
      }
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titulo.trim() || titulo.trim().length < 5) {
      toast.error('O título deve ter pelo menos 5 caracteres');
      return;
    }
    
    if (!descricao.trim() || descricao.trim().length < 10) {
      toast.error('A descrição deve ter pelo menos 10 caracteres');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/suporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: barId,
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          categoria,
          modulo,
          prioridade,
          criado_por: userId,
          criado_por_nome: userName
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || 'Chamado criado com sucesso!');
        router.push(`/suporte/${result.data.id}`);
      } else {
        toast.error(result.error || 'Erro ao criar chamado');
      }
    } catch (error) {
      console.error('Erro ao criar chamado:', error);
      toast.error('Erro ao criar chamado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const prioridadeSelecionada = prioridades.find(p => p.id === prioridade);

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/suporte">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Novo Chamado</h1>
          <p className="text-sm text-muted-foreground">
            Descreva seu problema ou solicitação
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Título */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Título do Chamado</CardTitle>
            <CardDescription>
              Um resumo breve do seu problema ou solicitação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Ex: Erro ao gerar relatório de CMV"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              maxLength={255}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {titulo.length}/255 caracteres (mínimo 5)
            </p>
          </CardContent>
        </Card>

        {/* Categoria e Módulo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Classificação</CardTitle>
            <CardDescription>
              Ajude-nos a direcionar seu chamado corretamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => {
                      const Icon = iconMap[cat.icon] || MessageSquare;
                      return (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{cat.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {categorias.find(c => c.id === categoria)?.descricao && (
                  <p className="text-xs text-muted-foreground">
                    {categorias.find(c => c.id === categoria)?.descricao}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Módulo</Label>
                <Select value={modulo} onValueChange={setModulo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    {modulos.map((mod) => (
                      <SelectItem key={mod.id} value={mod.id}>
                        {mod.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {modulos.find(m => m.id === modulo)?.descricao && (
                  <p className="text-xs text-muted-foreground">
                    {modulos.find(m => m.id === modulo)?.descricao}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prioridade */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Prioridade</CardTitle>
            <CardDescription>
              Defina a urgência do seu chamado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {prioridades.map((prio) => (
                <button
                  key={prio.id}
                  type="button"
                  onClick={() => setPrioridade(prio.id)}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    prioridade === prio.id
                      ? `border-${prio.color}-500 bg-${prio.color}-50 dark:bg-${prio.color}-900/20`
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="font-medium">{prio.label}</div>
                  <div className="text-xs text-muted-foreground">
                    SLA: {prio.sla_horas}h
                  </div>
                </button>
              ))}
            </div>
            {prioridadeSelecionada && (
              <p className="text-sm text-muted-foreground mt-3">
                {prioridadeSelecionada.descricao}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Descrição */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Descrição Detalhada</CardTitle>
            <CardDescription>
              Descreva o problema com o máximo de detalhes possível
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Descreva o que está acontecendo...&#10;&#10;Inclua:&#10;- O que você estava fazendo&#10;- O que esperava acontecer&#10;- O que aconteceu de fato&#10;- Passos para reproduzir (se aplicável)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={8}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {descricao.length} caracteres (mínimo 10)
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/suporte">
            <Button variant="outline" type="button">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Criar Chamado
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
