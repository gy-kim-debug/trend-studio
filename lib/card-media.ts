import { database } from '@/lib/server-admin';
import type { Slide } from '@/lib/content';

export const MEDIA_BUCKET = 'trend-card-images';

export async function signedSlides(slides: Slide[]): Promise<Slide[]> {
  const db = database();
  if (!db) return slides;
  return Promise.all(slides.map(async slide => {
    if (!slide.imagePath) return slide;
    const { data } = await db.storage.from(MEDIA_BUCKET).createSignedUrl(slide.imagePath, 3600);
    return { ...slide, imageUrl: data?.signedUrl ?? '' };
  }));
}
