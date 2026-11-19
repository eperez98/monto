/** Profile photos: pick an image, crop it to a centred square and shrink it to a small JPEG kept in the database. */
import { openFile } from './files';
import { tr } from '../lib/i18n';

const SIZE = 256;

export async function pickProfilePhoto(): Promise<string | null> {
  const f = await openFile([{ name: tr('Foto de perfil'), extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]);
  if (!f) return null;
  if (f.data.length > 20 * 1024 * 1024) throw new Error(tr('La imagen debe pesar menos de 20 MB.'));
  let img: ImageBitmap;
  try { img = await createImageBitmap(new Blob([new Uint8Array(f.data)])); } catch { throw new Error(tr('No se pudo abrir esa imagen.')); }
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  img.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
