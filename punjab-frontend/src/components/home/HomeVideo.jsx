"use client";

import { useRef, useState } from "react";

// Self-hosted MP4 with a click-to-play overlay. preload="metadata" fetches only the
// header (not the whole file), and the 16:9 box is reserved up front so nothing shifts.
export default function HomeVideo({ src, poster, title = "Featured video" }) {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    video.controls = true;
    video.play().catch(() => {});
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        autoPlay={true}
        controls={true}
        muted
        loop
        aria-label={title}
        onError={() => setFailed(true)}
        onEnded={() => setStarted(false)}
        onPause={(event) => { if (event.currentTarget.ended) setStarted(false); }}
      />
      {!started && (
        <button
          type="button"
          onClick={play}
          aria-label={`Play video: ${title}`}
          className="group absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/40"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-on-primary shadow-xl transition-transform group-hover:scale-110 md:h-20 md:w-20">
            <i className="fa-solid fa-play pl-1 text-2xl" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}
