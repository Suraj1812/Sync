import { InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <label className="block">
      {label && <span className="mb-2 block text-sm font-medium text-ink">{label}</span>}
      <input
        className={clsx(
          'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-blue-100',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-100',
          className,
        )}
        {...props}
      />
      {error && <span className="mt-2 block text-sm text-red-600">{error}</span>}
    </label>
  );
}
