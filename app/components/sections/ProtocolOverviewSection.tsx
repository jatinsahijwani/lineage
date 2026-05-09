'use client';

import { motion } from 'framer-motion';
import { AnimatedCard } from '@/components/shared/AnimatedCard';
import { GradientBg } from '@/components/shared/GradientBg';
import { containerVariants, fadeInUpVariants } from '@/lib/animations';
import { Database, Brain, Zap, TrendingUp } from 'lucide-react';

const steps = [
  {
    id: 1,
    icon: Database,
    title: 'Contribute Data',
    description:
      'Upload your datasets and establish ownership rights on the blockchain',
    color: 'text-blue-400',
  },
  {
    id: 2,
    icon: Brain,
    title: 'Train Models',
    description:
      'Build AI models using contributed data with automatic attribution',
    color: 'text-purple-400',
  },
  {
    id: 3,
    icon: Zap,
    title: 'Deploy Skills',
    description:
      'Launch AI capabilities as reusable skills for developers worldwide',
    color: 'text-cyan-400',
  },
  {
    id: 4,
    icon: TrendingUp,
    title: 'Earn Royalties',
    description:
      'Receive automated payments for your data and model contributions',
    color: 'text-green-400',
  },
];

export function ProtocolOverviewSection() {
  return (
    <GradientBg variant="mesh" className="w-full py-24 sm:py-32">
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
            How Lineage Works
          </motion.h2>
          <motion.p
            variants={fadeInUpVariants}
            className="text-xl text-white/60 max-w-2xl mx-auto"
          >
            A four-step journey from data ownership to sustainable income
          </motion.p>
        </motion.div>

        {/* Steps grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                className="relative group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <AnimatedCard index={index} className="relative">
                  {/* Icon */}
                  <div
                    className={`inline-block rounded-lg bg-white/5 p-3 mb-4 group-hover:bg-white/10 transition-colors ${step.color}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Number badge */}
                  <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white/50">
                    {step.id}
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-white mb-3">
                    {step.title}
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {step.description}
                  </p>

                  {/* Divider */}
                  {index < steps.length - 1 && (
                    <motion.div
                      className="hidden lg:block absolute -right-3 top-1/2 w-6 h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: (index + 1) * 0.15 }}
                    />
                  )}
                </AnimatedCard>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom section */}
        <motion.div
          className="mt-20 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-white/60 text-sm">
            Join thousands of creators and developers building the future of AI
          </p>
        </motion.div>
      </div>
    </GradientBg>
  );
}
