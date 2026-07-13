'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { hubButtonClassName, hubButtonSizes } from './hubButtonStyles';
export { hubButtonBase, hubButtonClassName, hubButtonSizes } from './hubButtonStyles';

export function ButtonSpinner() {
  return <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

type HubButtonProps = {
  children: ReactNode;
  href?: string;
  target?: string;
  rel?: string;
  loading?: boolean;
  loadingText?: string;
  size?: keyof typeof hubButtonSizes;
  fullWidth?: boolean;
  icon?: ReactNode;
  ariaLabel?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children' | 'className'>;

export default function HubButton({ children, href, target, rel, loading = false, loadingText, size = 'md', fullWidth = false, icon, ariaLabel, className = '', disabled, type = 'button', onClick, ...buttonProps }: HubButtonProps) {
  const classes = hubButtonClassName(size, `${fullWidth ? 'w-full' : ''} ${className}`);
  const content = <><span className={`inline-flex items-center justify-center gap-2 ${loading ? 'invisible' : ''}`}>{icon}{children}</span>{loading ? <span className="absolute inset-0 inline-flex items-center justify-center gap-2 px-2"><ButtonSpinner />{loadingText || children}</span> : null}</>;

  if (href) {
    const blocked = disabled || loading;
    return <Link href={href} target={target} rel={rel || (target === '_blank' ? 'noopener noreferrer' : undefined)} aria-label={ariaLabel} aria-busy={loading || undefined} aria-disabled={blocked || undefined} tabIndex={blocked ? -1 : undefined} onClick={(event) => { if (blocked) { event.preventDefault(); return; } onClick?.(event); }} className={classes}>{content}</Link>;
  }

  return <button {...buttonProps} type={type} disabled={disabled || loading} aria-label={ariaLabel} aria-busy={loading || undefined} onClick={onClick as MouseEventHandler<HTMLButtonElement> | undefined} className={classes}>{content}</button>;
}
