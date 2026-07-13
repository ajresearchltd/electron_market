'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import HubButton from '../ui/HubButton';
import { hubButtonSizes } from '../ui/hubButtonStyles';

type AdminButtonProps = {
  children: ReactNode;
  href?: string;
  size?: keyof typeof hubButtonSizes;
  loading?: boolean;
  loadingText?: string;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export default function AdminButton({
  children,
  href,
  size = 'md',
  className = '',
  type = 'button',
  disabled,
  onClick,
  loading,
  loadingText,
}: AdminButtonProps) {
  return <HubButton href={href} size={size} className={className} type={type} disabled={disabled} onClick={onClick} loading={loading} loadingText={loadingText}>{children}</HubButton>;
}
