/**
 * Decodes an image, failing loudly.
 *
 * Every tool wired `onload` without `onerror`, so a file the browser could not
 * decode simply did nothing: the filename appeared and the canvas never
 * arrived, and in 3D Nodes the promise never settled at all.
 *
 * The realistic trigger is HEIC from a phone, which passes the `image/*` check
 * on the upload control and then fails to decode in most browsers.
 */

/** Shown to the user, so it names the likely cause rather than the symptom. */
export const IMAGE_DECODE_ERROR =
  'That image could not be read. It may be damaged, or in a format this browser cannot open, such as HEIC.';

export function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(IMAGE_DECODE_ERROR));
    img.src = url;
  });
}
