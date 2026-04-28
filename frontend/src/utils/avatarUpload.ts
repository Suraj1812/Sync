export const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
export const MAX_AVATAR_LABEL = '3 MB';

export function readAvatarFile(file: globalThis.File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Choose an image file.'));
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      reject(new Error(`Use an image smaller than ${MAX_AVATAR_LABEL}.`));
      return;
    }

    const reader = new window.FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}
