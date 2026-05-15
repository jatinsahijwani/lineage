'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cardVariants } from '@/lib/animations';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  index?: number;
}

export function AnimatedCard({
  children,
  className = '',
  delay = 0,
  index = 0,
}: AnimatedCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      whileHover="hover"
      viewport={{ once: true, amount: 0.3 }}
      transition={{
        delay: delay + index * 0.1,
      }}
      className={`rounded-lg border border-white/10 glass-dark p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}
