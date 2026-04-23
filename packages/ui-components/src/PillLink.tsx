import React from 'react';

export interface PillLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
}

/**
 * Pill CTA link.
 * rounded-[980px], transparent bg, #0066cc text with border.
 * Touch targets minimum 44x44px.
 */
export function PillLink({ children, className = '', ...props }: PillLinkProps) {
  return (
    <a
      className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[980px] border border-[#0066cc] bg-transparent px-5 py-2 font-sf-pro-text text-sm font-medium text-[#0066cc] transition-colors hover:bg-[#0066cc] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#0071e3] focus:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}
