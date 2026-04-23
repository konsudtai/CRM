import React from 'react';

export interface SectionProps {
  variant?: 'dark' | 'light';
  children: React.ReactNode;
  className?: string;
}

/**
 * Section layout component.
 * Alternating dark (#000000) and light (#f5f5f7) backgrounds.
 * Used for cinematic rhythm page layouts.
 */
export function Section({ variant = 'light', children, className = '' }: SectionProps) {
  const bg = variant === 'dark' ? 'bg-[#000000] text-white' : 'bg-[#f5f5f7] text-[#1d1d1f]';

  return (
    <section className={`px-6 py-16 md:px-12 lg:px-24 ${bg} ${className}`}>
      {children}
    </section>
  );
}
