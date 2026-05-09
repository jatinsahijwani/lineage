'use client';

import { motion } from 'framer-motion';
import { AnimatedCard } from '@/components/shared/AnimatedCard';
import { GradientBg } from '@/components/shared/GradientBg';
import {
  containerVariants,
  fadeInUpVariants,
  cardVariants,
} from '@/lib/animations';
import { Activity, TrendingUp, Users, Award } from 'lucide-react';

const statusMetrics = [
  {
    icon: Activity,
    title: 'Network Status',
    value: 'Healthy',
    status: 'online',
    description: 'All systems operational',
  },
  {
    icon: TrendingUp,
    title: 'Model Performance',
    value: '94.2%',
    status: 'online',
    description: 'Average accuracy',
  },
  {
    icon: Users,
    title: 'Active Users',
    value: '12,847',
    status: 'online',
    description: 'Connected to network',
  },
  {
    icon: Award,
    title: 'Top Model',
    value: 'Vision Pro',
    status: 'online',
    description: '96.1% accuracy',
  },
];

export function TestnetStatusSection() {
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
            Network Status
          </motion.h2>
          <motion.p
            variants={fadeInUpVariants}
            className="text-xl text-white/60 max-w-2xl mx-auto"
          >
            Real-time metrics from the Lineage testnet
          </motion.p>
        </motion.div>

        {/* Status cards grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {statusMetrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.title}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <AnimatedCard index={index} className="relative">
                  {/* Status indicator */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 pulse-glow" />
                    <span className="text-xs font-semibold text-green-400">Live</span>
                  </div>

                  {/* Icon */}
                  <div className="mb-4 inline-block rounded-lg bg-white/10 p-3">
                    <Icon className="h-6 w-6 text-blue-400" />
                  </div>

                  {/* Content */}
                  <h3 className="text-sm font-medium text-white/70 mb-2">
                    {metric.title}
                  </h3>
                  <p className="text-2xl font-bold text-white mb-1">{metric.value}</p>
                  <p className="text-xs text-white/60">{metric.description}</p>
                </AnimatedCard>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Status timeline */}
        <motion.div
          className="rounded-lg border border-white/10 glass-dark p-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-xl font-bold text-white mb-6">Recent Events</h3>
          <div className="space-y-4">
            {[
              {
                time: '2 hours ago',
                event: 'Mainnet upgrade deployed',
                status: 'success',
              },
              {
                time: '5 hours ago',
                event: 'New skill: Text Summarization enabled',
                status: 'success',
              },
              {
                time: '8 hours ago',
                event: 'Royalty settlement completed',
                status: 'success',
              },
              {
                time: '1 day ago',
                event: 'Model accuracy improved to 96.1%',
                status: 'success',
              },
            ].map((item, index) => (
              <motion.div
                key={`${item.time}-${index}`}
                className="flex items-start gap-4 pb-4 border-b border-white/10 last:border-0"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 + index * 0.05 }}
              >
                <div className="w-2 h-2 rounded-full bg-green-400 mt-2.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-white font-medium">{item.event}</p>
                  <p className="text-sm text-white/60 mt-1">{item.time}</p>
                </div>
                <div className="text-xs font-semibold text-green-400">
                  {item.status === 'success' && 'Completed'}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </GradientBg>
  );
}
