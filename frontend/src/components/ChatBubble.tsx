import { Check, CheckCheck, Pencil, Trash2 } from 'lucide-react';
import type { Message } from '../types';
import { formatTime } from '../utils/time';

export function ChatBubble({
  message,
  mine,
  onEdit,
  onDelete,
}: {
  message: Message;
  mine: boolean;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
}) {
  const status = message.seen ? 'Read' : message.delivered ? 'Delivered' : 'Sent';

  return (
    <div className={`group flex animate-[fadeIn_.16s_ease-out] items-center gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      {mine && (
        <div className="order-first flex shrink-0 items-center gap-1 opacity-80 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          {onEdit && (
            <button
              aria-label="Edit message"
              title="Edit message"
              className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-200 hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
              onClick={() => onEdit(message)}
              type="button"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              aria-label="Delete message"
              title="Delete message"
              className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-red-200 hover:text-red-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
              onClick={() => onDelete(message)}
              type="button"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      <div
        className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ring-1 sm:max-w-[78%] lg:max-w-[72%] ${
          mine ? 'rounded-br-md bg-brand text-white ring-blue-500/10' : 'rounded-bl-md bg-white text-ink ring-slate-200/80'
        }`}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${mine ? 'text-blue-100' : 'text-muted'}`}>
          {message.editedAt && <span>Edited</span>}
          {formatTime(message.createdAt)}
          {mine && (
            <span className="inline-flex items-center gap-0.5" title={status} aria-label={status}>
              {message.seen || message.delivered ? (
                <CheckCheck size={14} className={message.seen ? 'text-cyan-200' : 'text-blue-100'} />
              ) : (
                <Check size={14} className="text-blue-200/70" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
