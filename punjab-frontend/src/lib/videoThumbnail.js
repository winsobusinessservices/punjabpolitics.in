// Mirrors indian-rajniti-backend/src/utils/videoThumbnail.js — derives a
// thumbnail straight from a YouTube/Vimeo URL so the frontend can show one
// even for a post whose `thumbnail` hasn't been backfilled yet.
const YOUTUBE_ID_PATTERN = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO_ID_PATTERN = /vimeo\.com\/(?:video\/)?(\d+)/;

export function deriveExternalThumbnail(videoUrl) {
  if (!videoUrl) return null;

  const youtubeMatch = videoUrl.match(YOUTUBE_ID_PATTERN);
  if (youtubeMatch) return `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;

  const vimeoMatch = videoUrl.match(VIMEO_ID_PATTERN);
  if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;

  return null;
}
