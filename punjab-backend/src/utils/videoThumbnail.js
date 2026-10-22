// Derives a thumbnail image straight from a YouTube/Vimeo video URL, so
// authors linking an external video don't also have to find/upload a
// thumbnail by hand — both providers expose one at a fixed URL pattern
// keyed by the video ID, no API call needed.
const YOUTUBE_ID_PATTERN = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO_ID_PATTERN = /vimeo\.com\/(?:video\/)?(\d+)/;

function deriveExternalThumbnail(videoUrl) {
  if (!videoUrl) return null;

  const youtubeMatch = videoUrl.match(YOUTUBE_ID_PATTERN);
  if (youtubeMatch) return `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;

  const vimeoMatch = videoUrl.match(VIMEO_ID_PATTERN);
  if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;

  return null;
}

module.exports = { deriveExternalThumbnail };
