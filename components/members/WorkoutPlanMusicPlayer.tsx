"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, RotateCcw, SkipBack, SkipForward, X } from "lucide-react";

type MusicMeta = {
  title: string;
  mp4Url: string;
};

function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function WorkoutPlanMusicPlayer({
  music,
  open,
  onClose,
}: {
  music: MusicMeta;
  open: boolean;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const syncMediaSession = useCallback(
    (el: HTMLAudioElement) => {
      if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: music.title || "Gym music",
          artist: "Action Plus Gym",
          album: "Workout Plan",
        });
        navigator.mediaSession.setActionHandler("play", () => {
          void el.play().then(() => setPlaying(true)).catch(() => null);
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          el.pause();
          setPlaying(false);
        });
        navigator.mediaSession.setActionHandler("seekbackward", (details) => {
          const off = Number(details.seekOffset) || 10;
          el.currentTime = Math.max(0, el.currentTime - off);
          setCurrent(el.currentTime);
        });
        navigator.mediaSession.setActionHandler("seekforward", (details) => {
          const off = Number(details.seekOffset) || 10;
          el.currentTime = Math.min(el.duration || 0, el.currentTime + off);
          setCurrent(el.currentTime);
        });
        navigator.mediaSession.setActionHandler("seekto", (details) => {
          if (typeof details.seekTime === "number") {
            el.currentTime = details.seekTime;
            setCurrent(el.currentTime);
          }
        });
        navigator.mediaSession.setActionHandler("stop", () => {
          el.pause();
          el.currentTime = 0;
          setPlaying(false);
          setCurrent(0);
        });
      } catch {
        /* Media Session unsupported / restricted */
      }
    },
    [music.title],
  );

  useEffect(() => {
    if (!open) return;
    const el = audioRef.current;
    if (!el) return;
    setError(null);
    syncMediaSession(el);
    void el
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        setError("Tap play to start music");
      });
  }, [open, music.mp4Url, syncMediaSession]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    setPlaying(false);
  }, [open]);

  if (!open) return null;

  const seekBy = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
    setCurrent(el.currentTime);
  };

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el
        .play()
        .then(() => {
          setPlaying(true);
          setError(null);
        })
        .catch(() => setError("Could not play music"));
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gold/35 bg-charcoal p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-music-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
              Music
            </p>
            <h3
              id="workout-music-title"
              className="mt-1 truncate font-display text-xl text-white"
            >
              {music.title}
            </h3>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/15 p-1.5 text-white/80"
            aria-label="Close music"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <audio
          ref={audioRef}
          src={music.mp4Url}
          preload="metadata"
          playsInline
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime || 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setCurrent(0);
          }}
          onError={() => setError("Could not load music file")}
        />

        {error ? <p className="mb-3 text-xs text-rose-200">{error}</p> : null}

        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={Math.max(1, duration || 1)}
            step={0.1}
            value={Math.min(current, duration || 0)}
            className="w-full accent-gold"
            aria-label="Seek"
            onChange={(e) => {
              const el = audioRef.current;
              const next = Number(e.target.value);
              if (el) el.currentTime = next;
              setCurrent(next);
            }}
          />
          <div className="flex justify-between text-[11px] text-muted">
            <span>{formatClock(current)}</span>
            <span>{formatClock(duration)}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-2.5 text-xs font-medium text-white"
            onClick={() => seekBy(-10)}
          >
            <SkipBack size={14} /> 10s
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-full border border-gold/45 bg-gold/20 px-2 py-2.5 text-xs font-semibold text-gold"
            onClick={togglePlay}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-2.5 text-xs font-medium text-white"
            onClick={() => seekBy(10)}
          >
            <SkipForward size={14} /> 10s
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-2.5 text-xs font-medium text-white"
            onClick={() => {
              const el = audioRef.current;
              if (!el) return;
              el.currentTime = 0;
              setCurrent(0);
              void el.play().then(() => setPlaying(true)).catch(() => null);
            }}
          >
            <RotateCcw size={14} /> Restart
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-muted">
          Lock-screen play/pause is supported where the browser allows it.
        </p>
      </div>
    </div>
  );
}

export function WorkoutPlanMusicButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold disabled:opacity-50"
      aria-label="Play gym music"
    >
      <Music2 size={14} />
      Music
    </button>
  );
}
