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
  const [audioUrl, setAudioUrl] = useState(pages[pageIndex]?.narration_url);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audioPrepared, setAudioPrepared] = useState(false);
  const [audioError, setAudioError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<number | null>(null);
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

  async function ensureAudio() {
    if (audioUrl) return { url: audioUrl, prepared: false };
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
      return;
    }
    const { url, prepared } = audio;
    if (!url && sample) {
      const utterance = new SpeechSynthesisUtterance(`${page.title}. ${page.body}`);
      utterance.rate = rate;
      utterance.onend = () => setPlaying(false);
      speechSynthesis.speak(utterance);
      setPlaying(true);
      return;
    }
    if (prepared) return;
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
      if (audioRef.current.currentTime === 0 && pageIndex === initialPage - 1) audioRef.current.currentTime = initialPosition / 1000;
      await audioRef.current.play();
      setAudioPrepared(false);
      setPlaying(true);
    }
  }

  async function persistPosition() {
    if (sample || !audioRef.current) return;
    await saveProgress(Math.floor(audioRef.current.currentTime * 1000));
  }

  function sleepTimer(minutes: number) {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      audioRef.current?.pause();
      speechSynthesis.cancel();
      setPlaying(false);
    }, minutes * 60 * 1000);
  }

  return (
    <main className="reader-shell">
      <div className="reader-topbar">
        <Link className="brand" href={sample ? "/" : "/library"}><span className="brand-mark">✦</span> StoryGlow</Link>
        <div><span className="status-pill">{sample ? "Sample story" : "Private story"}</span><h1>{title}</h1></div>
        {sample ? <Link className="button button-small" href="/create">Create yours</Link> : <Link className="text-button" href="/library">My stories</Link>}
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
        <button className="round-button" onClick={() => setPageIndex(index => Math.max(0, index - 1))} disabled={pageIndex === 0}>←</button>
        <button className="play-button" onClick={() => void togglePlayback()} disabled={busy}>
          {playing ? "Ⅱ Pause" : busy ? "Preparing audio…" : audioPrepared ? "▶ Audio ready — tap to play" : "▶ Play bedtime audio"}
        </button>
        {audioError ? <span role="alert">{audioError}</span> : null}
        <label>Speed <select className="speed-select" value={rate} onChange={event => {
          const next = Number(event.target.value);
          setRate(next);
          if (audioRef.current) audioRef.current.playbackRate = next;
        }}><option value=".75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></label>
        <label>Sleep timer <select className="speed-select" defaultValue="" onChange={event => event.target.value && sleepTimer(Number(event.target.value))}><option value="" disabled>Choose</option><option value="5">5 min</option><option value="15">15 min</option><option value="30">30 min</option></select></label>
        <button className="round-button" onClick={() => setPageIndex(index => Math.min(pages.length - 1, index + 1))} disabled={pageIndex === pages.length - 1}>→</button>
      </div>
      <audio ref={audioRef} src={audioUrl || undefined} onEnded={() => {
        setPlaying(false);
        void persistPosition();
        setPageIndex(index => Math.min(pages.length - 1, index + 1));
      }} onPause={() => void persistPosition()} />
    </main>
  );
}
