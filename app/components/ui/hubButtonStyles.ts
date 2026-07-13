export const hubButtonSizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
} as const;

export const hubButtonBase = 'hub-button relative inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white bg-[#454A9C] font-semibold text-white shadow-[0_6px_16px_rgba(15,23,42,0.30)] transition-all duration-200 hover:-translate-y-px hover:border-white hover:bg-sky-300 hover:text-slate-950 hover:shadow-[0_8px_20px_rgba(15,23,42,0.38)] active:translate-y-0 active:shadow-[0_3px_8px_rgba(15,23,42,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:border-white disabled:bg-[#454A9C] disabled:text-white disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:border-white disabled:hover:bg-[#454A9C] disabled:hover:text-white disabled:hover:shadow-[0_6px_16px_rgba(15,23,42,0.30)]';

const colorUtility = /^(?:hover:|active:|focus:|focus-visible:|disabled:|visited:)*(?:bg|text|border)-(?:blue|sky|cyan|red|amber|emerald|slate|gray|white|black)(?:-|$)/;
export const hubButtonClassName = (size: keyof typeof hubButtonSizes = 'md', className = '') => {
  const layoutClasses = className.split(/\s+/).filter((token) => token && !colorUtility.test(token)).join(' ');
  return `${hubButtonBase} ${hubButtonSizes[size]} ${layoutClasses}`.trim();
};
