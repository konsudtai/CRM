import React from 'react';

/**
 * SF Pro Display (≥20px) / SF Pro Text (<20px) boundary.
 * Letter-spacing per Apple design system size tiers:
 *   96px: -0.015em, 80px: -0.015em, 64px: -0.012em,
 *   48px: -0.01em, 40px: -0.009em, 32px: -0.007em,
 *   28px: -0.005em, 24px: -0.003em, 21px: -0.002em,
 *   20px: -0.001em, 19px: -0.003em, 17px: -0.01em,
 *   14px: -0.006em, 12px: 0em
 */

export interface HeadingProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  size?: 'hero' | 'headline' | 'title' | 'subtitle';
  children: React.ReactNode;
  className?: string;
}

const headingSizes: Record<string, string> = {
  hero: 'text-5xl tracking-[-0.01em]',       // 48px
  headline: 'text-[32px] tracking-[-0.007em]', // 32px
  title: 'text-2xl tracking-[-0.003em]',       // 24px
  subtitle: 'text-xl tracking-[-0.001em]',     // 20px
};

/** Heading component — uses SF Pro Display (≥20px) */
export function Heading({ as: Tag = 'h2', size = 'headline', children, className = '' }: HeadingProps) {
  return (
    <Tag className={`font-sf-pro-display font-semibold ${headingSizes[size]} ${className}`}>
      {children}
    </Tag>
  );
}

export interface BodyProps {
  size?: 'large' | 'default' | 'small' | 'caption';
  children: React.ReactNode;
  className?: string;
}

const bodySizes: Record<string, string> = {
  large: 'text-[19px] tracking-[-0.003em]',
  default: 'text-[17px] tracking-[-0.01em]',
  small: 'text-sm tracking-[-0.006em]',       // 14px
  caption: 'text-xs tracking-[0em]',           // 12px
};

/** Body text component — uses SF Pro Text (<20px) */
export function Body({ size = 'default', children, className = '' }: BodyProps) {
  return (
    <p className={`font-sf-pro-text ${bodySizes[size]} ${className}`}>
      {children}
    </p>
  );
}
