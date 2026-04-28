import { CheckCheck } from 'lucide-react';
import type { Message } from '../types';
import { formatTime } from '../utils/time';

export function ChatBubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <div className={`flex animate-[fadeIn_.16s_ease-out] ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
          mine ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-white text-ink'
        }`}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${mine ? 'text-blue-100' : 'text-muted'}`}>
          {formatTime(message.createdAt)}
          {mine && <CheckCheck size={13} className={message.seen ? 'text-blue-100' : 'text-blue-200/60'} />}
        </div>
      </div>
    </div>
  );
}
