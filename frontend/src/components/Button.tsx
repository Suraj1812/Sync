import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger';
  icon?: ReactNode;
};

export function Button({ className, variant = 'primary', icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0',
        variant === 'primary' && 'bg-brand text-white shadow-sm hover:bg-blue-700',
        variant === 'ghost' && 'text-slate-700 hover:bg-slate-100 hover:text-ink',
        variant === 'soft' && 'border border-line bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
