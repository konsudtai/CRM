import React from 'react';

export interface CardProps {
  variant?: 'light' | 'dark';
  elevated?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Apple Design System Card.
 *
 * Light: bg-[#f5f5f7], no border.
 * Dark: bg-[#272729], white text.
 * Radius: 8px (standard Apple).
 * Shadow only when elevated: 3px 5px 30px rgba(0,0,0,0.22).
 * No borders — Apple almost never uses visible borders on cards.
 * No hover state — cards are static, links within them are interactive.
 */
export function Card({
  variant = 'light',
  elevated = false,
  children,
  className = '',
}: CardProps) {
  const base = 'rounded-[8px] p-6';
  const bg = variant === 'light'
    ? 'bg-white'
    : 'bg-[#272729] text-white';
  const shadow = elevated
    ? 'shadow-[3px_5px_30px_0px_rgba(0,0,0,0.22)]'
    : '';

  return (
    <div className={`${base} ${bg} ${shadow} ${className}`}>
      {children}
    </div>
  );
}
