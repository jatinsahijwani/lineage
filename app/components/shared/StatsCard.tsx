'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { containerVariants } from '@/lib/animations';

interface StatsCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  isNumeric?: boolean;
}

export function StatsCard({
  label,
  value,
  unit = '',
  icon,
  isNumeric = false,
}: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    if (isNumeric && typeof value === 'number') {
      const duration = 1000;
      const start = Date.now();
      const startValue = 0;
      const endValue = value;

      const animate = () => {
        const now = Date.now();
        const progress = Math.min((now - start) / duration, 1);
        const current = Math.floor(
          startValue + (endValue - startValue) * progress
        );
        setDisplayValue(current.toLocaleString());

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    } else {
      setDisplayValue(String(value));
    }
  }, [value, isNumeric]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className="glass-dark rounded-lg border border-white/10 p-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/70">{label}</p>
        {icon && <div className="text-xl">{icon}</div>}
      </div>
      <div className="space-y-1">
        <p className="text-3xl font-bold text-white">
          {displayValue}
          {unit && <span className="ml-1 text-lg text-white/60">{unit}</span>}
        </p>
      </div>
    </motion.div>
  );
}
