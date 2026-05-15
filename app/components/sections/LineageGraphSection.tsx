'use client';

import { motion } from 'framer-motion';
import { GradientBg } from '@/components/shared/GradientBg';
import { fadeInUpVariants, containerVariants } from '@/lib/animations';
import { LineageGraph } from '@/components/graph/LineageGraph';

export function LineageGraphSection() {
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
            Data Lineage & Attribution
          </motion.h2>
          <motion.p
            variants={fadeInUpVariants}
            className="text-xl text-white/60 max-w-2xl mx-auto"
          >
            Track the complete lineage from datasets through models to deployed
            skills, with transparent attribution and royalty distribution
          </motion.p>
        </motion.div>

        {/* Graph visualization */}
        <motion.div
          className="relative rounded-xl border border-white/10 glass-dark overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <LineageGraph />
        </motion.div>

        {/* Legend */}
        <motion.div
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {[
            {
              label: 'Datasets',
              color: 'bg-blue-500',
              description: 'Input data sources',
            },
            {
              label: 'Models',
              color: 'bg-purple-500',
              description: 'Trained AI models',
            },
            {
              label: 'Skills',
              color: 'bg-cyan-500',
              description: 'Deployed capabilities',
            },
          ].map((item) => (
            <motion.div
              key={item.label}
              className="glass-dark rounded-lg border border-white/10 p-4"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <div>
                  <p className="font-semibold text-white">{item.label}</p>
                  <p className="text-sm text-white/60">{item.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </GradientBg>
  );
}
