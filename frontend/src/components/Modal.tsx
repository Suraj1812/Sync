import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, children, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-3 py-3 backdrop-blur-[2px] sm:items-center sm:px-4">
      <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg animate-[fadeIn_.16s_ease-out] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="min-w-0 truncate text-base font-semibold text-ink">{title}</h2>
          <Button
            aria-label="Close"
            variant="soft"
            className="h-9 w-9 rounded-xl px-0 text-slate-600 hover:text-ink [&_svg]:h-4 [&_svg]:w-4"
            onClick={onClose}
            icon={<X />}
          />
        </div>
        <div className="thin-scrollbar max-h-[calc(100dvh-6.5rem)] overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
