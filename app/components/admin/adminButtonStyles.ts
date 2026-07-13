import { hubButtonBase, hubButtonClassName, hubButtonSizes } from '../ui/hubButtonStyles';

export const adminButtonBase = hubButtonBase;
export const adminButtonSizes = { ...hubButtonSizes, compact: 'px-3 py-2 text-sm' } as const;
export const adminButtonClassName = (size: keyof typeof adminButtonSizes = 'md', className = '') => size === 'compact'
  ? `${hubButtonBase} ${adminButtonSizes.compact} ${className}`.trim()
  : hubButtonClassName(size, className);
