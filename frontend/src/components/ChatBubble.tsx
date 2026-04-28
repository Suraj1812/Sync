import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '../types';
import { formatTime } from '../utils/time';

export function ChatBubble({ message, mine }: { message: Message; mine: boolean }) {
  const status = message.seen ? 'Read' : message.delivered ? 'Delivered' : 'Sent';

  return (
    <div className={`flex animate-[fadeIn_.16s_ease-out] ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ring-1 sm:max-w-[78%] lg:max-w-[72%] ${
          mine ? 'rounded-br-md bg-brand text-white ring-blue-500/10' : 'rounded-bl-md bg-white text-ink ring-slate-200/80'
        }`}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${mine ? 'text-blue-100' : 'text-muted'}`}>
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
