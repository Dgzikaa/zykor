'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DashboardWidget,
  WidgetConfig,
  WIDGET_PRESETS,
} from './dashboard-widget';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Edit3,
  Save,
  Plus,
  Grid,
  Layers,
  Eye,
  EyeOff,
  RotateCcw,
  Settings,
  RefreshCw,
  Download,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DashboardGridProps {
  widgets: WidgetConfig[];
  onWidgetsChange?: (widgets: WidgetConfig[]) => void;
  className?: string;
}

export function DashboardGrid({
  widgets,
  onWidgetsChange,
  className,
}: DashboardGridProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Auto-save quando widgets mudam
  useEffect(() => {
    if (onWidgetsChange) {
      const timeoutId = setTimeout(() => {
        onWidgetsChange(widgets);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [widgets, onWidgetsChange]);

  const handleWidgetConfigChange = useCallback(
    (config: WidgetConfig) => {
      if (onWidgetsChange) {
        const updatedWidgets = widgets.map(w =>
          w.id === config.id ? config : w
        );
        onWidgetsChange(updatedWidgets);
      }
    },
    [widgets, onWidgetsChange]
  );

  const handleWidgetRemove = useCallback(
    (id: string) => {
      if (onWidgetsChange) {
        const updatedWidgets = widgets.filter(w => w.id !== id);
        onWidgetsChange(updatedWidgets);
      }
    },
    [widgets, onWidgetsChange]
  );

  const handleAddWidget = (presetId: string) => {
    if (onWidgetsChange) {
      const preset = WIDGET_PRESETS[presetId as keyof typeof WIDGET_PRESETS];
      if (preset) {
        const newWidget: WidgetConfig = {
          ...preset,
          id: `${presetId}_${Date.now()}`,
          position: findEmptyPosition(),
        };
        onWidgetsChange([...widgets, newWidget]);
      }
    }
    setShowAddWidget(false);
  };

  const findEmptyPosition = (): { x: number; y: number } => {
    // Simples algoritmo para encontrar posição vazia
    const occupied = widgets.map(w => w.position);

    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 6; x++) {
        const position = { x, y };
        if (!occupied.some(pos => pos.x === x && pos.y === y)) {
          return position;
        }
      }
    }

    return { x: 0, y: widgets.length };
  };

  const handleResetLayout = () => {
    if (onWidgetsChange) {
      const resetWidgets = Object.values(WIDGET_PRESETS).map(preset => ({
        ...preset,
        id: preset.id,
        visible: true,
      }));
      onWidgetsChange(resetWidgets);
    }
  };

  const handleToggleAll = () => {
    if (onWidgetsChange) {
      const allVisible = widgets.every(w => w.visible);
      const updatedWidgets = widgets.map(w => ({ ...w, visible: !allVisible }));
      onWidgetsChange(updatedWidgets);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    setDraggedWidget(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widgetId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (rect.width / 6));
      const y = Math.floor((e.clientY - rect.top) / 100);
      setDragOverPosition({
        x: Math.max(0, Math.min(5, x)),
        y: Math.max(0, y),
      });
    }
  };

  const handleDragLeave = () => {
    setDragOverPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const widgetId = e.dataTransfer.getData('text/plain');

    if (widgetId && dragOverPosition && onWidgetsChange) {
      const updatedWidgets = widgets.map(w =>
        w.id === widgetId ? { ...w, position: dragOverPosition } : w
      );
      onWidgetsChange(updatedWidgets);
    }

    setDraggedWidget(null);
    setDragOverPosition(null);
  };

  const visibleWidgets = widgets.filter(w => w.visible || isEditing);
  const hiddenCount = widgets.filter(w => !w.visible).length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Control bar */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Grid className="h-4 w-4 text-gray-500" />
            <span className="font-medium text-gray-900 dark:text-white">
              Dashboard Layout
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary">{visibleWidgets.length} widgets</Badge>

            {hiddenCount > 0 && (
              <Badge variant="outline">{hiddenCount} ocultos</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle all visibility */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleAll}
            className="flex items-center gap-2"
          >
            {widgets.every(w => w.visible) ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {widgets.every(w => w.visible) ? 'Ocultar Todos' : 'Mostrar Todos'}
          </Button>

          {/* Add widget button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddWidget(!showAddWidget)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar Widget
          </Button>

          {/* Reset layout button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetLayout}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Resetar Layout
          </Button>

          {/* Edit mode toggle */}
          <Button
            variant={isEditing ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2"
          >
            {isEditing ? (
              <>
                <Save className="h-4 w-4" />
                Salvar
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4" />
                Editar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Add widget panel */}
      {showAddWidget && (
        <Card className="border-dashed border-2 border-gray-300 dark:border-gray-600">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Adicionar Widget
            </CardTitle>
            <CardDescription>
              Selecione um widget para adicionar ao dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(WIDGET_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => handleAddWidget(id)}
                  className="p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {preset.type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {preset.size}
                    </Badge>
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    {preset.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Refresh: {preset.refreshInterval}s
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid container */}
      <div
        ref={gridRef}
        className={cn(
          'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 auto-rows-fr min-h-96',
          isEditing && 'ring-2 ring-blue-500/20 rounded-lg p-4'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOverPosition && (
          <div
            className="absolute bg-blue-500/20 border-2 border-blue-500 border-dashed rounded-lg"
            style={{
              left: `${(dragOverPosition.x / 6) * 100}%`,
              top: `${dragOverPosition.y * 100}px`,
              width: `${100 / 6}%`,
              height: '100px',
            }}
          />
        )}

        {/* Widgets */}
        {visibleWidgets.map(widget => (
          <div
            key={widget.id}
            draggable={isEditing}
            onDragStart={e => handleDragStart(e, widget.id)}
            className={cn(
              'transition-all duration-200',
              draggedWidget === widget.id && 'opacity-50'
            )}
            style={{
              gridColumnStart: widget.position.x + 1,
              gridRowStart: widget.position.y + 1,
            }}
          >
            <DashboardWidget
              config={widget}
              onConfigChange={handleWidgetConfigChange}
              onRemove={handleWidgetRemove}
              isDragging={draggedWidget === widget.id}
              isEditing={isEditing}
            >
              {/* Widget content will be rendered here */}
              <WidgetContent widget={widget} />
            </DashboardWidget>
          </div>
        ))}

        {/* Empty state */}
        {visibleWidgets.length === 0 && (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="text-center">
              <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Nenhum widget visível
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Adicione widgets ou torne alguns visíveis para começar
              </p>
              <Button
                onClick={() => setShowAddWidget(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Widget
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit mode instructions */}
      {isEditing && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-blue-800 dark:text-blue-200">
            Modo de edição ativo: arraste widgets para reposicionar, use os
            controles para configurar ou remover
          </span>
        </div>
      )}
    </div>
  );
}

// Widget content component
function WidgetContent({ widget }: { widget: WidgetConfig }) {
  // Placeholder content based on widget type
  switch (widget.type) {
    case 'metric':
      return (
        <div className="space-y-2">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            R$ 1.234,56
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            +12% vs. período anterior
          </div>
        </div>
      );

    case 'status':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-gray-900 dark:text-white">
              Operacional
            </span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Última atualização: agora
          </div>
        </div>
      );

    case 'activity':
      return (
        <div className="space-y-2">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Atividade recente
          </div>
          <div className="space-y-1">
            <div className="text-sm text-gray-900 dark:text-white">
              Sync concluído
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              há 2 minutos
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Widget personalizado
        </div>
      );
  }
}
