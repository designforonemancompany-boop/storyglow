"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type ReaderPage = {
  page_number: number;
  title: string;
  body: string;
  illustration_url: string | null;
  narration_url: string | null;
};

export function StoryReader({ storyId, title, pages, sample = false, initialPage = 1, initialPosition = 0, initialRate = 1 }: {
  storyId: string;
  title: string;
  pages: ReaderPage[];
  sample?: boolean;
  initialPage?: number;
  initialPosition?: number;
  initialRate?: number;
}) {
  const [pageIndex, setPageIndex] = useState(Math.max(0, Math.min(pages.length - 1, initialPage - 1)));
  const [rate, setRate] = useState(initialRate);
  const [audioUrl, setAudioUrl] = useState(pages[Math.max(0, Math.min(pages.length - 1, initialPage - 1))]?.narration_url || null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audioPrepared, setAudioPrepared] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState<number | null>(null);
  const [sleepTimerLabel, setSleepTimerLabel] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const continuePlaybackRef = useRef(false);
  const page = pages[pageIndex];

  async function saveProgress(audioPositionMs: number) {
    if (sample) return;
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        pageNumber: page.page_number,
        audioPositionMs,
        playbackRate: rate,
      }),
    });
  }

  useEffect(() => {
    setAudioUrl(page.narration_url);
    setPlaying(false);
    setAudioPrepared(false);
    setAudioError("");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (!sample) {
      void saveProgress(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.page_number, page.narration_url, rate, sample, storyId]);

  useEffect(() => {
    if (sample) return;
    let cancelled = false;

    async function prefetchNarration(pageNumber: number) {
      const response = await fetch(`/api/stories/${storyId}/narration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNumber }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Narration failed");
      return result.narrationUrl as string;
    }

    async function warmNarration() {
      try {
        if (!page.narration_url && !audioUrl) {
          const currentUrl = await prefetchNarration(page.page_number);
          if (!cancelled) {
            setAudioUrl(currentUrl);
            setAudioPrepared(true);
          }
        }

        const nextPage = pages[pageIndex + 1];
        if (nextPage && !nextPage.narration_url) {
          void prefetchNarration(nextPage.page_number);
        }
      } catch {
        // Best-effort preloading should never block reading.
      }
    }

    void warmNarration();
    return () => {
      cancelled = true;
    };
  }, [audioUrl, page.narration_url, page.page_number, pageIndex, pages, sample, storyId]);

  useEffect(() => {
    if (!sleepTimerEndsAt) {
      setSleepTimerLabel("");
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = null;
      return;
    }

    const updateCountdown = () => {
      const remainingMs = sleepTimerEndsAt - Date.now();
      if (remainingMs <= 0) {
        setSleepTimerEndsAt(null);
        setSleepTimerLabel("");
        if (countdownRef.current) window.clearInterval(countdownRef.current);
        countdownRef.current = null;
        return;
      }
      const totalSeconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setSleepTimerLabel(`${minutes}:${String(seconds).padStart(2, "0")} remaining`);
    };

    updateCountdown();
    countdownRef.current = window.setInterval(updateCountdown, 1000);
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    };
  }, [sleepTimerEndsAt]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (countdownRef.current) window.clearInterval(countdownRef.current);
  }, []);

  async function ensureAudio() {
    if (audioUrl) return { url: audioUrl, prepared: audioPrepared };
    if (sample) return { url: null, prepared: false };
    setBusy(true);
    setAudioError("");
    try {
      const response = await fetch(`/api/stories/${storyId}/narration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNumber: page.page_number }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setAudioUrl(result.narrationUrl);
      setAudioPrepared(true);
      return { url: result.narrationUrl as string, prepared: true };
    } finally {
      setBusy(false);
    }
  }

  async function togglePlayback() {
    if (playing) {
      continuePlaybackRef.current = false;
      audioRef.current?.pause();
      speechSynthesis.cancel();
      setPlaying(false);
      return;
    }
    let audio;
    try {
      audio = await ensureAudio();
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : "Audio could not be prepared.");
      continuePlaybackRef.current = false;
      return;
    }
    const { url, prepared } = audio;
    if (!url && sample) {
      const utterance = new SpeechSynthesisUtterance(`${page.title}. ${page.body}`);
      utterance.rate = rate;
      utterance.onend = () => setPlaying(false);
      speechSynthesis.speak(utterance);
      setPlaying(true);
      continuePlaybackRef.current = true;
      return;
    }
    if (!audioRef.current || !url) return;
    audioRef.current.playbackRate = rate;
    if (audioRef.current.currentTime === 0 && pageIndex === initialPage - 1) {
      audioRef.current.currentTime = initialPosition / 1000;
    }
    if (!prepared) setAudioPrepared(false);
    await audioRef.current.play();
    setPlaying(true);
    continuePlaybackRef.current = true;
  }

  useEffect(() => {
    if (!continuePlaybackRef.current || sample) return;
    if (pageIndex === pages.length - 1) {
      continuePlaybackRef.current = false;
      return;
    }
    void togglePlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex]);

  async function persistPosition() {
    if (sample || !audioRef.current) return;
    await saveProgress(Math.floor(audioRef.current.currentTime * 1000));
  }

  function sleepTimer(minutes: number) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    const endsAt = Date.now() + minutes * 60 * 1000;
    setSleepTimerEndsAt(endsAt);
    timerRef.current = window.setTimeout(() => {
      audioRef.current?.pause();
      speechSynthesis.cancel();
      setPlaying(false);
      continuePlaybackRef.current = false;
      setSleepTimerEndsAt(null);
    }, minutes * 60 * 1000);
  }

  function clearSleepTimer() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setSleepTimerEndsAt(null);
  }

  return (
    <main className="reader-shell">
      <div className="reader-topbar">
        <Link className="brand" href={sample ? "/" : "/library"}>
          <span className="brand-mark" aria-hidden>SG</span>
          StoryGlow
        </Link>
        <div>
          <span className="status-pill">{sample ? "Sample story" : "Private story"}</span>
          <h1>{title}</h1>
        </div>
        {sample ? (
          <Link className="button button-small" href="/create">Create yours</Link>
        ) : (
          <div className="reader-top-actions">
            <span className="reader-account-pill">Signed in</span>
            <Link className="text-button" href="/library">Back to My Stories</Link>
          </div>
        )}
      </div>
      <div className="reader-canvas">
        <div className="reader-image">
          <Image src={page.illustration_url || "/assets/birthday-story-scenes.png"} fill sizes="(max-width:850px) 100vw, 65vw" alt="" unoptimized={Boolean(page.illustration_url)} />
        </div>
        <article className="reader-copy">
          <p className="section-label">Page {page.page_number} of {pages.length}</p>
          <h2>{page.title}</h2>
          <p>{page.body}</p>
        </article>
      </div>
      <div className="reader-bottom">
        <button
          className="round-button"
          aria-label="Previous page"
          onClick={() => {
            continuePlaybackRef.current = false;
            setPageIndex(index => Math.max(0, index - 1));
          }}
          disabled={pageIndex === 0}
        >
          ←
        </button>
        <button className="play-button" onClick={() => void togglePlayback()} disabled={busy}>
          {playing ? "Pause bedtime audio" : busy ? "Preparing audio..." : audioPrepared ? "Audio ready - tap to play" : "Play bedtime audio"}
        </button>
        {audioError ? <span role="alert">{audioError}</span> : null}
        <label>
          Speed{" "}
          <select
            className="speed-select"
            value={rate}
            onChange={event => {
              const next = Number(event.target.value);
              setRate(next);
              if (audioRef.current) audioRef.current.playbackRate = next;
            }}
          >
            <option value=".75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
          </select>
        </label>
        <label>
          Sleep timer{" "}
          <select className="speed-select" defaultValue="" onChange={event => event.target.value && sleepTimer(Number(event.target.value))}>
            <option value="" disabled>Choose</option>
            <option value="5">5 min</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
          </select>
        </label>
        {sleepTimerLabel ? <span className="timer-pill">Sleep timer: {sleepTimerLabel}</span> : null}
        {sleepTimerEndsAt ? <button className="text-button" onClick={clearSleepTimer}>Clear timer</button> : null}
        <button
          className="round-button"
          aria-label="Next page"
          onClick={() => {
            continuePlaybackRef.current = false;
            setPageIndex(index => Math.min(pages.length - 1, index + 1));
          }}
          disabled={pageIndex === pages.length - 1}
        >
          →
        </button>
      </div>
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onEnded={() => {
          setPlaying(false);
          void persistPosition();
          if (pageIndex < pages.length - 1) {
            continuePlaybackRef.current = true;
            setPageIndex(index => Math.min(pages.length - 1, index + 1));
          } else {
            continuePlaybackRef.current = false;
          }
        }}
        onPause={() => {
          setPlaying(false);
          void persistPosition();
        }}
      />
    </main>
  );
}
