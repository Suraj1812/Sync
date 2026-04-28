import { clsx } from 'clsx';
import type { User } from '../types';

export function Avatar({ user, size = 'md' }: { user: Pick<User, 'name' | 'avatar' | 'isOnline'>; size?: 'sm' | 'md' | 'lg' }) {
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
          'grid place-items-center overflow-hidden rounded-full bg-gray-900 text-white',
          size === 'sm' && 'h-8 w-8 text-xs',
          size === 'md' && 'h-10 w-10 text-sm',
          size === 'lg' && 'h-16 w-16 text-lg',
        )}
      >
        {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : initials}
      </div>
      {user.isOnline && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
      )}
    </div>
  );
}
