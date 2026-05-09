'use client';

import { motion } from 'framer-motion';
import { containerVariants, fadeInUpVariants } from '@/lib/animations';
import { Github, Twitter, MessageCircle, Mail } from 'lucide-react';

const footerLinks = [
  {
    category: 'Product',
    links: ['Features', 'Pricing', 'Documentation', 'API Reference'],
  },
  {
    category: 'Community',
    links: ['Discord', 'GitHub', 'Twitter', 'Forum'],
  },
  {
    category: 'Company',
    links: ['About', 'Blog', 'Press', 'Contact'],
  },
  {
    category: 'Legal',
    links: ['Privacy', 'Terms', 'Security', 'Cookies'],
  },
];

const socialLinks = [
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: MessageCircle, href: '#', label: 'Discord' },
  { icon: Mail, href: '#', label: 'Email' },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-gradient-to-b from-transparent to-blue-950/20 py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12"
        >
          {footerLinks.map((section) => (
            <motion.div key={section.category} variants={fadeInUpVariants}>
              <h3 className="font-semibold text-white mb-4">{section.category}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-white/60 hover:text-white/90 text-sm transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        {/* Divider */}
        <motion.div
          className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-8"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        />

        {/* Bottom section */}
        <motion.div
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Logo and copyright */}
          <motion.div variants={fadeInUpVariants} className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Lineage</h2>
            <p className="text-white/60 text-sm">
              © {new Date().getFullYear()} Lineage Protocol. All rights reserved.
            </p>
          </motion.div>

          {/* Social links */}
          <motion.div
            className="flex items-center gap-4"
            variants={fadeInUpVariants}
          >
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <motion.a
                  key={social.label}
                  href={social.href}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all hover:bg-white/5"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={social.label}
                >
                  <Icon className="h-5 w-5" />
                </motion.a>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </footer>
  );
}
