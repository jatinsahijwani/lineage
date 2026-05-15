'use client';

import { motion } from 'framer-motion';
import { AnimatedCard } from '@/components/shared/AnimatedCard';
import { GradientBg } from '@/components/shared/GradientBg';
import {
  containerVariants,
  fadeInUpVariants,
  cardVariants,
} from '@/lib/animations';
import {
  Shield,
  Zap,
  Globe,
  Lock,
  BarChart3,
  Network,
} from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Secure & Decentralized',
    description: 'Built on 0G blockchain for maximum security and transparency',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Optimized for low-latency model inference and settlement',
  },
  {
    icon: Globe,
    title: 'Global Scale',
    description: 'Support for millions of concurrent users and transactions',
  },
  {
    icon: Lock,
    title: 'Data Privacy',
    description: 'Zero-knowledge proofs ensure contributor privacy',
  },
  {
    icon: BarChart3,
    title: 'On-Chain Analytics',
    description: 'Complete visibility into model performance and royalties',
  },
  {
    icon: Network,
    title: 'Interoperable',
    description: 'Connect with any blockchain or AI platform',
  },
];

export function BuiltOn0GSection() {
  return (
    <GradientBg variant="subtle" className="w-full py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <motion.div
          className="mb-16 text-center"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.h2
            variants={fadeInUpVariants}
            className="text-4xl sm:text-5xl font-bold text-white mb-4"
          >
            Built on{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              0G Blockchain
            </span>
          </motion.h2>
          <motion.p
            variants={fadeInUpVariants}
            className="text-xl text-white/60 max-w-2xl mx-auto"
          >
            Leveraging the speed and security of 0G for infrastructure excellence
          </motion.p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <AnimatedCard index={index}>
                  <div className="mb-4 inline-block rounded-lg bg-white/10 p-3 group-hover:bg-white/20 transition-colors">
                    <Icon className="h-6 w-6 text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </AnimatedCard>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Stats bar */}
        <motion.div
          className="mt-20 rounded-lg border border-white/10 glass-dark p-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: '10k+', label: 'TPS Capacity' },
              { value: '2s', label: 'Block Time' },
              { value: '1M+', label: 'Daily Transactions' },
              { value: '99.98%', label: 'Uptime' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-2xl sm:text-3xl font-bold text-blue-400">
                  {stat.value}
                </p>
                <p className="text-xs sm:text-sm text-white/60 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </GradientBg>
  );
}
