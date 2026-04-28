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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-[fadeIn_.16s_ease-out] rounded-xl bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <Button aria-label="Close" variant="ghost" className="h-8 w-8 px-0" onClick={onClose} icon={<X size={18} />} />
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
