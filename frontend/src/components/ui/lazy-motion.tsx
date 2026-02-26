'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

/**
 * Lazy-loaded motion components from framer-motion
 * Reduz bundle inicial em ~50KB
 */

// Lazy load do motion.div
export const MotionDiv = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.div),
  {
    ssr: false,
    loading: () => <div />,
  }
);

// Lazy load do motion.span
export const MotionSpan = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.span),
  {
    ssr: false,
    loading: () => <span />,
  }
);

// Lazy load do motion.button
export const MotionButton = dynamic(
  () => import('framer-motion').then((mod) => mod.motion.button),
  {
    ssr: false,
    loading: () => <button />,
  }
);

// Lazy load do AnimatePresence
export const AnimatePresence = dynamic(
  () => import('framer-motion').then((mod) => mod.AnimatePresence),
  {
    ssr: false,
  }
);

// Tipos para facilitar uso
export type MotionDivProps = ComponentProps<typeof MotionDiv>;
export type MotionSpanProps = ComponentProps<typeof MotionSpan>;
export type MotionButtonProps = ComponentProps<typeof MotionButton>;
