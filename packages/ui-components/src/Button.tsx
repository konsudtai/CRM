import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

/**
 * Primary Blue CTA button.
 * #0071e3 background, white text, 8px radius, 8px 15px padding.
 * All interactive elements use Apple Blue #0071e3.
 * Touch targets minimum 44x44px.
 */
export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center min-h-[44px] min-w-[44px] font-sf-pro-text text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:ring-offset-2';

  const variants: Record<string, string> = {
    primary: 'rounded-lg bg-[#0071e3] px-[15px] py-[8px] text-white hover:bg-[#0077ed]',
    secondary: 'rounded-lg border border-[#0071e3] bg-transparent px-[15px] py-[8px] text-[#0071e3] hover:bg-[#0071e3]/5',
    ghost: 'rounded-lg bg-transparent px-[15px] py-[8px] text-[#0071e3] hover:bg-[#0071e3]/5',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
