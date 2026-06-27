import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModernInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  variant?: 'default' | 'floating' | 'minimal' | 'glass';
  animated?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, ModernInputProps>(
  ({ 
    className, 
    type, 
    label, 
    error, 
    success, 
    loading, 
    icon, 
    variant = 'default',
    animated = true,
    ...props 
  }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current!);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(e.target.value.length > 0);
      props.onChange?.(e);
    };

    const getVariantStyles = () => {
      switch (variant) {
        case 'floating':
          return 'border-gray-300 dark:border-gray-600 bg-transparent focus:border-blue-500 dark:focus:border-blue-400';
        case 'minimal':
          return 'border-0 border-b-2 border-gray-200 dark:border-gray-700 bg-transparent rounded-none focus:border-blue-500 dark:focus:border-blue-400';
        case 'glass':
          return 'border-white/20 dark:border-gray-700/50 bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm focus:border-blue-500/50 dark:focus:border-blue-400/50';
        default:
          return 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:border-blue-500 dark:focus:border-blue-400';
      }
    };

    const getStatusColor = () => {
      if (error) return 'border-red-500 dark:border-red-400 focus:border-red-500 dark:focus:border-red-400';
      if (success) return 'border-green-500 dark:border-green-400 focus:border-green-500 dark:focus:border-green-400';
      return '';
    };

    const inputType = type === 'password' && showPassword ? 'text' : type;

    return (
      <div className="relative w-full">
        {/* Floating Label */}
        {label && variant === 'floating' && (
          <motion.label
            animate={{
              y: isFocused || hasValue ? -20 : 0,
              scale: isFocused || hasValue ? 0.85 : 1,
              color: isFocused ? '#3b82f6' : error ? '#ef4444' : success ? '#10b981' : '#6b7280'
            }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as any }}
            className="absolute left-3 top-2.5 pointer-events-none origin-left text-sm font-medium z-10"
          >
            {label}
          </motion.label>
        )}

        {/* Regular Label */}
        {label && variant !== 'floating' && (
          <motion.label
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            {label}
          </motion.label>
        )}

        <div className="relative">
          {/* Icon */}
          {icon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10"
            >
              {icon}
            </motion.div>
          )}

          {/* Input */}
          <motion.input
            ref={inputRef}
            type={inputType}
            className={cn(
              'flex h-12 w-full rounded-xl border px-4 py-3 text-sm transition-all duration-200',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'text-gray-900 dark:text-gray-100',
              getVariantStyles(),
              getStatusColor(),
              icon && 'pl-10',
              (type === 'password' || loading || success || error) && 'pr-10',
              className
            )}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={handleInputChange}
            transition={{ duration: 0.2 }}
            {...(props as any)}
          />

          {/* Right Side Icons */}
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1, rotate: 360 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ 
                    rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                    opacity: { duration: 0.2 }
                  }}
                  className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
                />
              )}

              {success && !loading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  whileHover={{ scale: 1.1 }}
                  className="text-green-500 dark:text-green-400"
                >
                  <Check className="w-4 h-4" />
                </motion.div>
              )}

              {error && !loading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  whileHover={{ scale: 1.1 }}
                  className="text-red-500 dark:text-red-400"
                >
                  <AlertCircle className="w-4 h-4" />
                </motion.div>
              )}

              {type === 'password' && !loading && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 flex items-center space-x-1 text-red-500 dark:text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message */}
        <AnimatePresence>
          {success && !error && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2 flex items-center space-x-1 text-green-500 dark:text-green-400 text-sm"
            >
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Campo válido</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
