'use client';

import { motion } from 'framer-motion';
import { type ReactNode } from 'react';

interface StaggerChildrenProps {
  children: ReactNode;
  /** Delay between each child in seconds */
  staggerDelay?: number;
  /** Base delay before first child */
  delay?: number;
  /** CSS class for the container */
  className?: string;
}

const containerVariants = {
  hidden: {},
  visible: (custom: { staggerDelay: number; delay: number }) => ({
    transition: {
      staggerChildren: custom.staggerDelay,
      delayChildren: custom.delay,
    },
  }),
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

export function StaggerChildren({
  children,
  staggerDelay = 0.08,
  delay = 0,
  className,
}: StaggerChildrenProps) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-30px' }}
      custom={{ staggerDelay, delay }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
