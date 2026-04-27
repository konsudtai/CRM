import React from 'react';

/**
 * Apple Design System Typography.
 *
 * SF Pro Display: ≥20px (headings, display text)
 * SF Pro Text: <20px (body, captions, buttons)
 *
 * Negative letter-spacing at ALL sizes — Apple tracks tight universally.
 * Extreme line-height range: 1.07 (headlines) to 1.47 (body).
 */

export interface HeadingProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  size?: 'hero' | 'section' | 'headline' | 'tile' | 'title' | 'subtitle';
  children: React.ReactNode;
  className?: string;
}

const headingStyles: Record<string, string> = {
  hero:     'text-[56px] font-semibold leading-[1.07] tracking-[-0.28px]',
  section:  'text-[40px] font-semibold leading-[1.10] tracking-normal',
  headline: 'text-[28px] font-semibold leading-[1.14] tracking-[0.196px]',
  tile:     'text-[28px] font-normal leading-[1.14] tracking-[0.196px]',
  title:    'text-[21px] font-bold leading-[1.19] tracking-[0.231px]',
  subtitle: 'text-[21px] font-normal leading-[1.19] tracking-[0.231px]',
};

export function Heading({
  as: Tag = 'h2',
  size = 'headline',
  children,
  className = '',
}: HeadingProps) {
  return (
    <Tag className={`font-sf-pro-display text-[#1d1d1f] ${headingStyles[size]} ${className}`}>
      {children}
    </Tag>
  );
}

export interface BodyProps {
  size?: 'large' | 'default' | 'emphasis' | 'small' | 'caption' | 'caption-bold' | 'micro' | 'nano';
  children: React.ReactNode;
  className?: string;
}

const bodyStyles: Record<string, string> = {
  large:         'text-[19px] font-normal leading-[1.42] tracking-[-0.374px]',
  default:       'text-[17px] font-normal leading-[1.47] tracking-[-0.374px]',
  emphasis:      'text-[17px] font-semibold leading-[1.24] tracking-[-0.374px]',
  small:         'text-[14px] font-normal leading-[1.29] tracking-[-0.224px]',
  caption:       'text-[14px] font-normal leading-[1.29] tracking-[-0.224px]',
  'caption-bold':'text-[14px] font-semibold leading-[1.29] tracking-[-0.224px]',
  micro:         'text-[12px] font-normal leading-[1.33] tracking-[-0.12px]',
  nano:          'text-[10px] font-normal leading-[1.47] tracking-[-0.08px]',
};

export function Body({
  size = 'default',
  children,
  className = '',
}: BodyProps) {
  return (
    <p className={`font-sf-pro-text text-[#1d1d1f] ${bodyStyles[size]} ${className}`}>
      {children}
    </p>
  );
}
