import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'outline', ...props }, ref) => {
    const variantClasses = {
      default: 'border-[hsl(var(--primary))] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]',
      secondary: 'border-[hsl(var(--muted-foreground))] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))]',
      destructive: 'border-[hsl(var(--destructive))] text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.1)]',
      success: 'border-[hsl(var(--success))] text-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]',
      warning: 'border-[hsl(var(--warning))] text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)]',
      outline: 'border-[hsl(var(--border))] text-[hsl(var(--foreground))] bg-transparent',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };
