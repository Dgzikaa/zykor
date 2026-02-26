'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, TestTube, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type FieldType = 'text' | 'password' | 'number' | 'textarea' | 'switch' | 'select';

interface ConfigField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: (value: any) => string | null;
}

interface ConfigPageWrapperProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  apiEndpoint: string;
  fields: ConfigField[];
  testFunction?: (config: Record<string, any>) => Promise<{ success: boolean; message: string }>;
  onSaveSuccess?: (config: Record<string, any>) => void;
  defaultValues?: Record<string, any>;
  showTestButton?: boolean;
  additionalActions?: React.ReactNode;
}

export function ConfigPageWrapper({
  title,
  description,
  icon,
  apiEndpoint,
  fields,
  testFunction,
  onSaveSuccess,
  defaultValues = {},
  showTestButton = true,
  additionalActions,
}: ConfigPageWrapperProps) {
  const [config, setConfig] = useState<Record<string, any>>(defaultValues);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiEndpoint);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar configuração');
      }
      
      const data = await response.json();
      setConfig({ ...defaultValues, ...data });
    } catch (error) {
      console.error('Erro ao buscar config:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a configuração',
        variant: 'destructive',
      });
      setConfig(defaultValues);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setTestResult(null);

      // Validar campos obrigatórios
      for (const field of fields) {
        if (field.required && !config[field.name]) {
          toast({
            title: 'Erro de validação',
            description: `O campo "${field.label}" é obrigatório`,
            variant: 'destructive',
          });
          return;
        }

        // Validação customizada
        if (field.validation) {
          const error = field.validation(config[field.name]);
          if (error) {
            toast({
              title: 'Erro de validação',
              description: error,
              variant: 'destructive',
            });
            return;
          }
        }
      }

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar configuração');
      }

      toast({
        title: 'Sucesso',
        description: 'Configuração salva com sucesso!',
      });

      if (onSaveSuccess) {
        onSaveSuccess(config);
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a configuração',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testFunction) return;

    try {
      setTesting(true);
      setTestResult(null);
      
      const result = await testFunction(config);
      setTestResult(result);
      
      toast({
        title: result.success ? 'Teste bem-sucedido' : 'Teste falhou',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Erro ao testar:', error);
      setTestResult({
        success: false,
        message: 'Erro ao executar teste',
      });
      toast({
        title: 'Erro',
        description: 'Não foi possível executar o teste',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const renderField = (field: ConfigField) => {
    const value = config[field.name] || '';

    switch (field.type) {
      case 'switch':
        return (
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.description && (
                <p className="text-sm text-gray-500">{field.description}</p>
              )}
            </div>
            <Switch
              id={field.name}
              checked={value}
              onCheckedChange={(checked) => setConfig({ ...config, [field.name]: checked })}
            />
          </div>
        );

      case 'textarea':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
            <Textarea
              id={field.name}
              value={value}
              onChange={(e) => setConfig({ ...config, [field.name]: e.target.value })}
              placeholder={field.placeholder}
              rows={4}
            />
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
            <select
              id={field.name}
              value={value}
              onChange={(e) => setConfig({ ...config, [field.name]: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {field.description && (
              <p className="text-sm text-gray-500">{field.description}</p>
            )}
            <Input
              id={field.name}
              type={field.type}
              value={value}
              onChange={(e) => setConfig({ ...config, [field.name]: e.target.value })}
              placeholder={field.placeholder}
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {fields.map((field) => (
            <div key={field.name}>
              {renderField(field)}
            </div>
          ))}

          {testResult && (
            <div className={cn(
              'flex items-center gap-2 p-3 rounded-lg',
              testResult.success 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            )}>
              {testResult.success ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving || testing}
              className="flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Configuração
                </>
              )}
            </Button>

            {showTestButton && testFunction && (
              <Button
                onClick={handleTest}
                disabled={saving || testing}
                variant="outline"
                className="flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4" />
                    Testar Conexão
                  </>
                )}
              </Button>
            )}

            {additionalActions}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConfigPageWrapper;
