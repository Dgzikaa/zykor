'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

// =====================================================
// 📜 SISTEMA DE SCROLL ANIMATIONS - ZYKOR
// =====================================================

interface ScrollAnimationProps {
  children: React.ReactNode;
  className?: string;
  triggerOnce?: boolean;
  threshold?: number;
  rootMargin?: string;
}

interface ParallaxProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  offset?: number;
}

interface ScrollTriggerProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale' | 'rotate';
  delay?: number;
  duration?: number;
  threshold?: number;
  triggerOnce?: boolean;
  rootMargin?: string;
}

// =====================================================
// 🎯 SCROLL TRIGGER - Animações baseadas em scroll
// =====================================================

export function ScrollTrigger({
  children,
  className = '',
  animation = 'fadeIn',
  delay = 0,
  duration = 0.6,
  threshold = 0.1,
  triggerOnce = true,
  rootMargin = '0px 0px -100px 0px',
}: ScrollTriggerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    // threshold não suportado na versão atual do useInView
    // threshold,
    // triggerOnce não suportado na versão atual do useInView
    // triggerOnce,
    // rootMargin não suportado na versão atual do useInView
    // rootMargin,
  });

  const getAnimationVariants = () => {
    const baseVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    };

    switch (animation) {
      case 'fadeIn':
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };

      case 'slideUp':
        return {
          hidden: { opacity: 0, y: 50 },
          visible: { opacity: 1, y: 0 },
        };

      case 'slideDown':
        return {
          hidden: { opacity: 0, y: -50 },
          visible: { opacity: 1, y: 0 },
        };

      case 'slideLeft':
        return {
          hidden: { opacity: 0, x: 50 },
          visible: { opacity: 1, x: 0 },
        };

      case 'slideRight':
        return {
          hidden: { opacity: 0, x: -50 },
          visible: { opacity: 1, x: 0 },
        };

      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1 },
        };

      case 'rotate':
        return {
          hidden: { opacity: 0, rotate: -10 },
          visible: { opacity: 1, rotate: 0 },
        };

      default:
        return baseVariants;
    }
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={getAnimationVariants()}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1] as any,
      }}
    >
      {children}
    </motion.div>
  );
}

// =====================================================
// 🌊 PARALLAX - Efeitos de profundidade
// =====================================================

export function Parallax({
  children,
  className = '',
  speed = 0.5,
  direction = 'up',
  offset = 0,
}: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const getParallaxTransform = () => {
    const baseTransform = useTransform(scrollYProgress, [0, 1], [0, 100 * speed]);
    
    switch (direction) {
      case 'up':
        return useTransform(scrollYProgress, [0, 1], [offset, offset - 100 * speed]);
      case 'down':
        return useTransform(scrollYProgress, [0, 1], [offset, offset + 100 * speed]);
      case 'left':
        return useTransform(scrollYProgress, [0, 1], [offset, offset - 100 * speed]);
      case 'right':
        return useTransform(scrollYProgress, [0, 1], [offset, offset + 100 * speed]);
      default:
        return useTransform(scrollYProgress, [0, 1], [0, 100 * speed]);
    }
  };

  const transform = getParallaxTransform();

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        y: direction === 'up' || direction === 'down' ? transform : undefined,
        x: direction === 'left' || direction === 'right' ? transform : undefined,
      }}
    >
      {children}
    </motion.div>
  );
}

// =====================================================
// 🎭 STAGGERED ANIMATIONS - Animações em sequência
// =====================================================

interface StaggeredContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  animation?: 'fadeIn' | 'slideUp' | 'slideDown' | 'scale';
  threshold?: number;
  triggerOnce?: boolean;
}

export function StaggeredContainer({
  children,
  className = '',
  staggerDelay = 0.1,
  animation = 'fadeIn',
  threshold = 0.1,
  triggerOnce = true,
}: StaggeredContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {
    // threshold não suportado na versão atual do useInView
    // threshold,
    // triggerOnce não suportado na versão atual do useInView
    // triggerOnce,
  });

  const getStaggerVariants = () => {
    const baseVariants = {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    };

    switch (animation) {
      case 'fadeIn':
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };

      case 'slideUp':
        return {
          hidden: { opacity: 0, y: 30 },
          visible: { opacity: 1, y: 0 },
        };

      case 'slideDown':
        return {
          hidden: { opacity: 0, y: -30 },
          visible: { opacity: 1, y: 0 },
        };

      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1 },
        };

      default:
        return baseVariants;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = getStaggerVariants();

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

// =====================================================
// 📊 SCROLL PROGRESS - Indicador de progresso
// =====================================================

interface ScrollProgressProps {
  className?: string;
  color?: string;
  height?: number;
  showPercentage?: boolean;
}

export function ScrollProgress({
  className = '',
  color = '#4A90E2',
  height = 4,
  showPercentage = false,
}: ScrollProgressProps) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div className={cn('fixed top-0 left-0 right-0 z-50', className)}>
      <motion.div
        className="origin-left"
        style={{ scaleX, backgroundColor: color, height }}
      />
      {showPercentage && (
        <motion.div
          className="absolute top-0 right-0 bg-gray-900 text-white px-2 py-1 text-xs rounded-bl"
          style={{
            opacity: useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
          }}
        >
          {Math.round((scrollYProgress.get() || 0) * 100)}%
        </motion.div>
      )}
    </div>
  );
}

// =====================================================
// 🎨 TEXT REVEAL - Revelação de texto
// =====================================================

interface TextRevealProps {
  text: string;
  className?: string;
  animation?: 'word' | 'character' | 'line';
  delay?: number;
  duration?: number;
  threshold?: number;
}

export function TextReveal({
  text,
  className = '',
  animation = 'word',
  delay = 0,
  duration = 0.6,
  threshold = 0.1,
}: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {});

  const renderText = () => {
    if (animation === 'word') {
      return text.split(' ').map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{
            duration,
            delay: delay + index * 0.1,
            ease: [0.4, 0, 0.2, 1] as any,
          }}
          className="inline-block mr-2"
        >
          {word}
        </motion.span>
      ));
    }

    if (animation === 'character') {
      return text.split('').map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{
            duration,
            delay: delay + index * 0.02,
            ease: [0.4, 0, 0.2, 1] as any,
          }}
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ));
    }

    if (animation === 'line') {
      return text.split('\n').map((line, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -50 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
          transition={{
            duration,
            delay: delay + index * 0.2,
            ease: [0.4, 0, 0.2, 1] as any,
          }}
        >
          {line}
        </motion.div>
      ));
    }

    return text;
  };

  return (
    <div ref={ref} className={className}>
      {renderText()}
    </div>
  );
}

// =====================================================
// 🖼️ IMAGE REVEAL - Revelação de imagens
// =====================================================

interface ImageRevealProps {
  src: string;
  alt: string;
  className?: string;
  animation?: 'fade' | 'slide' | 'scale' | 'blur';
  delay?: number;
  duration?: number;
  threshold?: number;
}

export function ImageReveal({
  src,
  alt,
  className = '',
  animation = 'fade',
  delay = 0,
  duration = 0.6,
  threshold = 0.1,
}: ImageRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {});

  const getImageVariants = () => {
    switch (animation) {
      case 'fade':
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };

      case 'slide':
        return {
          hidden: { opacity: 0, x: 50 },
          visible: { opacity: 1, x: 0 },
        };

      case 'scale':
        return {
          hidden: { opacity: 0, scale: 0.8 },
          visible: { opacity: 1, scale: 1 },
        };

      case 'blur':
        return {
          hidden: { opacity: 0, filter: 'blur(10px)' },
          visible: { opacity: 1, filter: 'blur(0px)' },
        };

      default:
        return {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };
    }
  };

  return (
    <motion.div
      ref={ref}
      className={cn('overflow-hidden', className)}
      variants={getImageVariants()}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1] as any,
      }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </motion.div>
  );
}

// =====================================================
// 🎯 SCROLL TO TOP - Botão para voltar ao topo
// =====================================================

interface ScrollToTopProps {
  className?: string;
  threshold?: number;
  smooth?: boolean;
}

export function ScrollToTop({
  className = '',
  threshold = 100,
  smooth = true,
}: ScrollToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > threshold) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, [threshold]);

  const scrollToTop = () => {
    if (smooth) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } else {
      window.scrollTo(0, 0);
    }
  };

  if (!isVisible) return null;

  return (
    <motion.button
      className={cn(
        'fixed bottom-6 right-6 w-12 h-12 bg-blue-600 dark:bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors z-50',
        className
      )}
      onClick={scrollToTop}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-label="Voltar ao topo"
    >
      <svg
        className="w-6 h-6 mx-auto"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </motion.button>
  );
}

// =====================================================
// 🚀 HOOKS DE SCROLL
// =====================================================

export function useScrollAnimation(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, {});

  const scrollVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 },
  };

  return {
    ref,
    isInView,
    scrollVariants,
  };
}

export function useParallaxScroll(speed = 0.5) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, -100 * speed]);

  return {
    ref,
    y,
  };
}

// =====================================================
// 📱 RESPONSIVE SCROLL ANIMATIONS
// =====================================================

export function useResponsiveScrollAnimation() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getAnimationSettings = () => {
    if (isMobile) {
      return {
        threshold: 0.05,
        rootMargin: '0px 0px -50px 0px',
        duration: 0.4,
      };
    }

    return {
      // threshold: 0.1,
      rootMargin: '0px 0px -100px 0px',
      duration: 0.6,
    };
  };

  return {
    isMobile,
    animationSettings: getAnimationSettings(),
  };
}
