import React from 'react';

export interface GlassNavProps {
  brand?: string;
  children?: React.ReactNode;
}

/**
 * Translucent dark glass navigation bar.
 * bg-black/80, backdrop-blur-[20px], backdrop-saturate-[180%], 48px height.
 * Links use 12px SF Pro Text white.
 */
export function GlassNav({ brand = 'CRM', children }: GlassNavProps) {
  return (
    <nav
      className="sticky top-0 z-50 flex h-12 items-center bg-black/80 px-6 backdrop-blur-[20px] backdrop-saturate-[180%]"
      role="navigation"
    >
      <span className="font-sf-pro-text text-xs font-medium tracking-tight text-white">
        {brand}
      </span>
      {children && <div className="ml-8 flex gap-6">{children}</div>}
    </nav>
  );
}

export interface GlassNavLinkProps {
  href: string;
  children: React.ReactNode;
}

/** 12px SF Pro Text white link for GlassNav */
export function GlassNavLink({ href, children }: GlassNavLinkProps) {
  return (
    <a
      href={href}
      className="min-h-[44px] min-w-[44px] inline-flex items-center font-sf-pro-text text-xs text-white/80 hover:text-white"
    >
      {children}
    </a>
  );
}
