/**
 * Chargeur d'images partage.
 *
 * Ce module centralise le cache de promesses afin qu'un meme asset ne soit pas
 * charge plusieurs fois par les scenes.
 */

/** Cache des chargements d'images indexes par URL. */
const loadedImages = new Map<string, Promise<HTMLImageElement>>();

/** Charge une image HTML et reutilise la promesse si l'URL a deja ete demandee. */
export function loadImage(url: string | undefined): Promise<HTMLImageElement> {
  if (!url) {
    return Promise.reject(new Error("Impossible de charger l'image : URL manquante"));
  }

  const existing = loadedImages.get(url);
  if (existing) {
    return existing;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = (): void => resolve(image);
    image.onerror = (): void => reject(new Error(`Impossible de charger l'image : ${url}`));
    image.src = url;
  });

  loadedImages.set(url, promise);
  return promise;
}
