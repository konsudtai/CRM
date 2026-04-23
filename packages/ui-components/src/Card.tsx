import React from 'react';

export interface CardProps {
  variant?: 'light' | 'dark';
  elevated?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Card component with light/dark variants.
 * Light: bg-[#f5f5f7], Dark: bg-[#272729].
 * 8px radius. Shadow only for elevated cards.
 * Elevated shadow: rgba(0,0,0,0.22) 3px 5px 30px 0px.
 */
export function Card({ variant = 'light', elevated = false, children, className = '' }: CardProps) {
  const bg = variant === 'light' ? 'bg-[#f5f5f7]' : 'bg-[#272729] text-white';
  const shadow = elevated ? 'shadow-[0px_3px_5px_0px_rgba(0,0,0,0.22),0px_5px_30px_0px_rgba(0,0,0,0.22)]' : '';

  return (
    <div className={`rounded-lg ${bg} ${shadow} p-6 ${className}`}>
      {children}
    </div>
  );
}
