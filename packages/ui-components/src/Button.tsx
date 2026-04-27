import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'dark' | 'secondary' | 'ghost';
  size?: 'default' | 'large';
  children: React.ReactNode;
}

/**
 * Apple Design System Button.
 *
 * Primary: #0071e3 bg, white text, 8px radius, 8px 15px padding.
 * Dark: #1d1d1f bg, white text.
 * Secondary: transparent bg, #0071e3 border.
 * Ghost: transparent bg, #0066cc text.
 *
 * Focus: 2px solid #0071e3 outline.
 * Touch target: minimum 44px.
 */
export function Button({
  variant = 'primary',
  size = 'default',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base = [
    'inline-flex items-center justify-center',
    'min-h-[44px] min-w-[44px]',
    'rounded-[8px]',
    'font-sf-pro-text tracking-normal',
    'transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    size === 'large' ? 'text-[18px] font-light leading-none' : 'text-[17px] font-normal',
  ].join(' ');

  const variants: Record<string, string> = {
    primary: 'bg-[#0071e3] px-[15px] py-[8px] text-white hover:bg-[#0077ed] active:bg-[#006edb]',
    dark: 'bg-[#1d1d1f] px-[15px] py-[8px] text-white hover:bg-[#333336] active:bg-[#1d1d1f]',
    secondary: 'border border-[#0066cc] bg-transparent px-[15px] py-[8px] text-[#0066cc] hover:bg-[#0066cc]/5 active:bg-[#0066cc]/10',
    ghost: 'bg-transparent px-[15px] py-[8px] text-[#0066cc] hover:underline',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
