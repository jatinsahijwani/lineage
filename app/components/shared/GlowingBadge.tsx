'use client';

import { motion } from 'framer-motion';
import { glowPulseVariants } from '@/lib/animations';

interface GlowingBadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'purple' | 'cyan';
  className?: string;
}

const glowColors = {
  blue: 'border-blue-500 text-blue-400',
  purple: 'border-purple-500 text-purple-400',
  cyan: 'border-cyan-500 text-cyan-400',
};

export function GlowingBadge({
  children,
  variant = 'blue',
  className = '',
}: GlowingBadgeProps) {
  return (
    <motion.div
      variants={glowPulseVariants}
      animate="animate"
      className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur-sm ${glowColors[variant]} ${className}`}
    >
      {children}
    </motion.div>
  );
}
