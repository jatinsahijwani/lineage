'use client';

import { motion } from 'framer-motion';
import { AnimatedCard } from '@/components/shared/AnimatedCard';
import { GradientBg } from '@/components/shared/GradientBg';
import { mockRoyaltyPayments } from '@/lib/mockData';
import {
  containerVariants,
  fadeInUpVariants,
  cardVariants,
} from '@/lib/animations';
import { Check, Clock, AlertCircle } from 'lucide-react';

const statusConfig = {
  settled: {
    icon: Check,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    label: 'Settled',
  },
  verified: {
    icon: Check,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    label: 'Verified',
  },
  pending: {
    icon: Clock,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    label: 'Pending',
  },
};

export function RoyaltySettlementSection() {
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
            Royalty Settlement
          </motion.h2>
          <motion.p
            variants={fadeInUpVariants}
            className="text-xl text-white/60 max-w-2xl mx-auto"
          >
            Transparent, automated royalty distribution to all contributors
          </motion.p>
        </motion.div>

        {/* Main settlement overview */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {[
            { label: 'Total Pending', value: '$3,232.64', color: 'text-yellow-400' },
            { label: 'Settled This Month', value: '$8,267.89', color: 'text-green-400' },
            { label: 'Network Uptime', value: '99.97%', color: 'text-blue-400' },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              variants={cardVariants}
              className="glass-dark rounded-lg border border-white/10 p-6"
            >
              <p className="text-white/60 text-sm mb-2">{item.label}</p>
              <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Recent payments */}
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <h3 className="text-2xl font-bold text-white mb-6">Recent Royalty Payments</h3>

          {mockRoyaltyPayments.map((payment, index) => {
            const statusCfg = statusConfig[payment.status];
            const StatusIcon = statusCfg.icon;

            return (
              <motion.div
                key={payment.recipient}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
              >
                <AnimatedCard index={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-mono text-sm text-white/80">
                        {payment.recipient.slice(0, 6)}...{payment.recipient.slice(-4)}
                      </p>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded ${statusCfg.bg}`}>
                        <StatusIcon className={`h-3 w-3 ${statusCfg.color}`} />
                        <span className={`text-xs font-semibold ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                    <p className="text-white/60 text-xs">
                      {new Date(payment.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-white">
                      ${payment.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-white/60">{payment.percentage}% stake</p>
                  </div>
                </AnimatedCard>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Info section */}
        <motion.div
          className="mt-12 rounded-lg border border-blue-500/30 bg-blue-500/5 p-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-white mb-1">How Settlement Works</h4>
              <p className="text-white/70 text-sm">
                Royalties are calculated based on model usage and automatically settled on a
                weekly basis. All payments are transparent and verifiable on the blockchain.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </GradientBg>
  );
}
