"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const slides = [
  {
    label: "Illustrative family scene",
    title: "Make bedtime feel like their story",
    copy: "Turn the moments only your family knows into a book they can read, hear, and keep.",
    cta: "Create their story — free",
    href: "/create",
    kind: "photo",
  },
  {
    title: "Begin with a memory only your family knows",
    copy: "A name, a birthday, a favorite grown-up thing, and one little detail worth keeping.",
    cta: "Tell us their memory",
    href: "/create",
    kind: "form",
  },
  {
    label: "Optional family likeness",
    title: "See familiar faces in every adventure",
    copy: "Add one private family photo, label who is who, and let us turn familiar features into warm storybook characters.",
    cta: "Create a personalized book",
    href: "/create",
    kind: "likeness",
  },
  {
    title: "Read it together, or let the story play",
    copy: "Listen on a phone, adjust the speed, set a sleep timer, and continue from the same page tomorrow.",
    cta: "Try Maya’s story",
    href: "/sample",
    kind: "phone",
  },
  {
    title: "A story to keep on their shelf",
    copy: "Read the digital story for free, then order a personalized hardcover from your private library whenever it becomes a family favorite.",
    cta: "Create a book",
    href: "/create",
    kind: "book",
  },
];

export function HomeCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setActive(current => (current + 1) % slides.length), 6500);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section className="journey" aria-roledescription="carousel" aria-label="The StoryGlow journey">
      <div className="slides">
        {slides.map((slide, index) => (
          <article className={`slide ${index === active ? "active" : ""}`} key={slide.title} aria-hidden={index !== active}>
            <div className="slide-copy">
              {slide.label ? <p className="disclosure">{slide.label}</p> : null}
              {index === 0 ? <h1>{slide.title}</h1> : <h2>{slide.title}</h2>}
              <p>{slide.copy}</p>
              <Link className="button" href={slide.href}>{slide.cta}</Link>
            </div>
            {slide.kind === "photo" ? (
              <figure className="hero-photo"><Image priority unoptimized fill sizes="57vw" src="/assets/family-bedtime.png" alt="Illustrative family scene of a mother and young daughter reading at bedtime" /></figure>
            ) : null}
            {slide.kind === "form" ? (
              <div className="mini-form"><label>Child&apos;s name <span>Maya</span></label><label>What happened? <span>Her second birthday</span></label><label>A detail to remember <span>She carries Mum&apos;s favorite handbag</span></label></div>
            ) : null}
            {slide.kind === "likeness" ? (
              <div className="likeness-demo"><Image unoptimized width={620} height={410} src="/assets/family-bedtime.png" alt="" /><span>→</span><Image unoptimized width={620} height={410} src="/assets/birthday-story-scenes.png" alt="" /></div>
            ) : null}
            {slide.kind === "phone" ? (
              <div className="phone-demo"><span>Now playing</span><strong>Maya and the Birthday Handbag</strong><div className="round-button">▶</div><div className="fake-track"><i /></div><small>Sleep timer · 15 min</small></div>
            ) : null}
            {slide.kind === "book" ? (
              <div className="book-mockup"><span className="book-star">✦</span><strong>Maya and the<br />Birthday Handbag</strong><small>A StoryGlow keepsake</small></div>
            ) : null}
          </article>
        ))}
      </div>
      <div className="carousel-controls">
        <button className="round-button" onClick={() => { setPaused(true); setActive((active + 4) % 5); }} aria-label="Previous slide">←</button>
        <div className="dots" role="tablist">
          {slides.map((slide, index) => <button key={slide.title} className={`dot ${index === active ? "active" : ""}`} onClick={() => { setPaused(true); setActive(index); }} aria-label={`Show slide ${index + 1}`} />)}
        </div>
        <button className="round-button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Play carousel" : "Pause carousel"}>{paused ? "▶" : "Ⅱ"}</button>
        <button className="round-button" onClick={() => { setPaused(true); setActive((active + 1) % 5); }} aria-label="Next slide">→</button>
      </div>
    </section>
  );
}
