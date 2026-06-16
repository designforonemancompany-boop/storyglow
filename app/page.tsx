import Image from "next/image";
import Link from "next/link";
import { HomeCarousel } from "@/components/home-carousel";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <HomeCarousel />
        <blockquote className="founder-quote">
          &quot;The stories children remember are often the ones where they recognize their own world.&quot;
          <cite>- The StoryGlow team</cite>
        </blockquote>
        <section className="sample-section">
          <div>
            <p className="section-label">A story to try tonight</p>
            <h2>Meet Maya, who is turning two</h2>
            <p>She loves Mum&apos;s favorite handbag, soft makeup brushes, and being just a little more grown-up every day.</p>
            <Link className="button" href="/sample">Read and listen to Maya&apos;s story</Link>
          </div>
          <Image unoptimized width={1536} height={1024} src="/assets/birthday-story-scenes.png" alt="Three illustrated scenes from Maya's second birthday story" />
        </section>
        <section className="how-section" id="how">
          <h2>A whole book from a few little things</h2>
          <div className="steps">
            <article><span>1</span><h3>Tell us</h3><p>Add their name, age, family, personality, and a moment worth remembering.</p></article>
            <article><span>2</span><h3>We make it</h3><p>StoryGlow shapes a child-safe story, cohesive illustrations, a dedicated cover, and gentle narration.</p></article>
            <article><span>3</span><h3>Read or listen</h3><p>Open it on any phone, share privately, and pick up where bedtime left off.</p></article>
          </div>
        </section>
      </main>
    </>
  );
}
