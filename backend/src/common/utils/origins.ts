export function corsOrigin(frontendUrl?: string, nodeEnv = process.env.NODE_ENV) {
  const origins = (frontendUrl ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length > 0) return origins;
  return nodeEnv === 'production' ? false : true;
}
