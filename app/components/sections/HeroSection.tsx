'use client';

import { motion } from 'framer-motion';
import { GradientBg } from '@/components/shared/GradientBg';
import { GlowingBadge } from '@/components/shared/GlowingBadge';
import { StatsCard } from '@/components/shared/StatsCard';
import {
  titleVariants,
  subtitleVariants,
  containerVariants,
  cardVariants,
} from '@/lib/animations';
import { protocolStats } from '@/lib/mockData';
import { ArrowRight, Zap, Network, DollarSign } from 'lucide-react';

export function HeroSection() {
  return (
    <GradientBg variant="intense" className="min-h-screen w-full">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-8 items-center">
          {/* Left content */}
          <motion.div className="space-y-8">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <GlowingBadge variant="blue">
                ✨ Introducing Lineage Protocol
              </GlowingBadge>
            </motion.div>

            {/* Title */}
            <motion.h1
              variants={titleVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight text-white"
            >
              AI Infrastructure{' '}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                for Everyone
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={subtitleVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-xl text-white/70 leading-relaxed max-w-lg"
            >
              The decentralized platform for building, deploying, and monetizing
              AI models. Fair attribution, real royalties, infinite possibilities.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 pt-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <button className="group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25">
                Get Started
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-8 py-3.5 font-semibold text-white transition-all hover:bg-white/10 hover:border-white/40">
                Learn More
              </button>
            </motion.div>
          </motion.div>

          {/* Right side - Stats Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="grid grid-cols-2 gap-4"
          >
            <motion.div variants={cardVariants}>
              <StatsCard
                label="Total Datasets"
                value={protocolStats.totalDatasets}
                isNumeric={true}
                icon={<Zap className="h-5 w-5 text-cyan-400" />}
              />
            </motion.div>
            <motion.div variants={cardVariants}>
              <StatsCard
                label="AI Models"
                value={protocolStats.totalModels}
                isNumeric={true}
                icon={<Network className="h-5 w-5 text-purple-400" />}
              />
            </motion.div>
            <motion.div variants={cardVariants}>
              <StatsCard
                label="Skills Deployed"
                value={protocolStats.totalSkills}
                isNumeric={true}
                icon={<Zap className="h-5 w-5 text-blue-400" />}
              />
            </motion.div>
            <motion.div variants={cardVariants}>
              <StatsCard
                label="Settled Royalties"
                value={protocolStats.settledRoyalties}
                icon={<DollarSign className="h-5 w-5 text-green-400" />}
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom accent line */}
        <motion.div
          className="mt-24 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.5 }}
        />
      </div>
    </GradientBg>
  );
}
