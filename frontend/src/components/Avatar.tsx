import { clsx } from 'clsx';
import type { User } from '../types';

function safeAvatar(src?: string | null) {
  if (!src) return '';
  return /^(https:\/\/|data:image\/(png|jpe?g|webp|gif);base64,)/i.test(src) ? src : '';
}

export function Avatar({ user, size = 'md' }: { user: Pick<User, 'name' | 'avatar' | 'isOnline'>; size?: 'sm' | 'md' | 'lg' }) {
  const avatar = safeAvatar(user.avatar);
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="relative shrink-0">
      <div
        className={clsx(
          'grid place-items-center overflow-hidden rounded-full bg-ink font-semibold text-white shadow-sm ring-1 ring-black/5',
          size === 'sm' && 'h-8 w-8 text-xs',
          size === 'md' && 'h-11 w-11 text-sm',
          size === 'lg' && 'h-[72px] w-[72px] text-xl',
        )}
      >
        {avatar ? (
          <img src={avatar} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>
      {user.isOnline && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
      )}
    </div>
  );
}
