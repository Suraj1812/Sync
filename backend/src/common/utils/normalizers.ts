import { BadRequestException } from '@nestjs/common';

const avatarPattern = /^(https:\/\/[^\s]+|data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+)$/i;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new BadRequestException(`${field} cannot be empty`);
  return trimmed;
}

export function normalizeOptionalText(value: string | undefined, maxLength: number) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function normalizeAvatar(value: string | undefined) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!avatarPattern.test(trimmed)) {
    throw new BadRequestException('Avatar must be an HTTPS URL or a supported image upload');
  }
  return trimmed;
}
