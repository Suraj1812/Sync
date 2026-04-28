export function formatTime(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function formatPresence(isOnline: boolean, lastSeen?: string | null) {
  if (isOnline) return 'Online';
  if (!lastSeen) return 'Offline';
  return `Last seen ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(lastSeen))}`;
}
