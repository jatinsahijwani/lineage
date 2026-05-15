'use client';

import { motion } from 'framer-motion';

interface GradientBgProps {
  children?: React.ReactNode;
  variant?: 'mesh' | 'subtle' | 'intense';
  className?: string;
}

export function GradientBg({
  children,
  variant = 'mesh',
  className = '',
}: GradientBgProps) {
  const variants = {
    mesh: 'gradient-mesh',
    subtle:
      'bg-gradient-to-b from-blue-600/10 via-purple-600/5 to-transparent',
    intense:
      'bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-cyan-600/5',
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className={`absolute inset-0 ${variants[variant]}`} />
      <motion.div
        className="pointer-events-none absolute inset-0"
        animate={{
          background: [
            'radial-gradient(at 20% 50%, rgba(79, 70, 229, 0.1) 0%, transparent 50%)',
            'radial-gradient(at 80% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%)',
            'radial-gradient(at 20% 50%, rgba(79, 70, 229, 0.1) 0%, transparent 50%)',
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
