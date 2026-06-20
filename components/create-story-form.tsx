"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FamilyRole } from "@/lib/types";

export function CreateStoryForm({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [roles, setRoles] = useState<FamilyRole[]>([
    { marker: 1, role: "main_character" },
    { marker: 2, role: "parent_guardian" },
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("storyglow-story-draft");
    if (!raw || !formRef.current) return;
    sessionStorage.removeItem("storyglow-story-draft");
    const draft = JSON.parse(raw) as Record<string, string>;
    for (const [name, value] of Object.entries(draft)) {
      const field = formRef.current.elements.namedItem(name);
      if (field instanceof RadioNodeList) field.value = value;
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.value = value;
      }
    }
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!isSignedIn) {
      const draft = Object.fromEntries([...form.entries()]
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"));
      sessionStorage.setItem("storyglow-story-draft", JSON.stringify(draft));
      router.push("/signin?next=/create");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      let photoPath: string | undefined;
      if (photo) {
        if (!consent) throw new Error("Confirm permission to use the family photo.");
        const upload = new FormData();
        upload.append("photo", photo);
        const response = await fetch("/api/uploads/family-photo", { method: "POST", body: upload });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        photoPath = result.path;
      }
      const response = await fetch("/api/stories/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childName: form.get("childName"),
          age: form.get("age"),
          gender: form.get("gender"),
          grownUps: form.get("grownUps"),
          event: form.get("event"),
          memory: form.get("memory"),
          characterTraits: form.get("characterTraits"),
          photoPath,
          familyRoles: photo ? roles : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push(`/stories/${result.storyId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Story generation failed.");
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} className="story-form" onSubmit={submit}>
      <div className="form-progress"><span>Story details</span><strong>Private by default</strong></div>
      <div className="form-grid">
        <label>Child&apos;s name<input name="childName" required maxLength={40} placeholder="e.g. Maya" /></label>
        <label>Age<select name="age" required defaultValue=""><option value="" disabled>Choose age</option>{[2,3,4,5,6,7,8].map(age => <option key={age}>{age}</option>)}</select></label>
        <fieldset><legend>Who is this story about?</legend><div className="choice-row"><label><input type="radio" name="gender" value="girl" defaultChecked />Girl</label><label><input type="radio" name="gender" value="boy" />Boy</label><label><input type="radio" name="gender" value="self" />Let them choose</label></div></fieldset>
        <label>Parent or grown-up names<input name="grownUps" maxLength={160} placeholder="e.g. Mum and Dad" /></label>
        <label>Character traits<input name="characterTraits" required maxLength={500} placeholder="Curly hair, joyful, loves yellow shoes..." /></label>
        <label className="wide">What happened?<textarea name="event" required maxLength={800} placeholder="A birthday, a first day, a family trip..." /></label>
        <label className="wide">A detail you never want to forget<textarea name="memory" required maxLength={800} placeholder="Their favorite bag, a funny phrase, the way they dance..." /></label>
      </div>
      <section className="upload-zone">
        <strong>Optional family likeness</strong>
        <p>Add one family photo with the main child and at least one parent or guardian. Siblings can be included too.</p>
        <input id="family-photo" type="file" accept="image/jpeg,image/png,image/heic,image/heif" onChange={event => {
          const file = event.target.files?.[0] || null;
          setPhoto(file);
          if (file) setPhotoUrl(URL.createObjectURL(file));
        }} />
        <label className="button button-small" htmlFor="family-photo">Choose a family photo</label>
        {photoUrl ? <Image className="photo-preview-image" src={photoUrl} width={700} height={420} unoptimized alt="Private family photo preview" /> : null}
      </section>
      {photo ? (
        <section>
          <h3>Who is who?</h3>
          <p>Label every visible person manually. StoryGlow does not infer family relationships.</p>
          <div className="role-list">
            {roles.map((role, index) => (
              <div className="role-row" key={role.marker}>
                <label>Person {role.marker}<select value={role.role} onChange={event => setRoles(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value as FamilyRole["role"] } : item))}><option value="main_character">Main character</option><option value="parent_guardian">Parent or guardian</option><option value="sibling">Sibling</option></select></label>
                <label>Name (optional)<input value={role.displayName || ""} onChange={event => setRoles(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, displayName: event.target.value } : item))} /></label>
              </div>
            ))}
          </div>
          <button className="text-button" type="button" onClick={() => setRoles(current => [...current, { marker: current.length + 1, role: "sibling" }])}>+ Add another person</button>
          <label className="checkbox"><input checked={consent} onChange={event => setConsent(event.target.checked)} type="checkbox" /><span>I am the parent or authorized adult, I have permission to use this photo, and I agree to private processing for these illustrations.</span></label>
          <p className="privacy-note">The raw family photo is deleted after private processing or cleanup. It is not required for the story text or cover-choice step to succeed.</p>
        </section>
      ) : null}
      <p className="form-message" role="alert">{message}</p>
      <div className="form-footer"><span>First we write the story, then you choose from 3 cover directions before the inside pages are painted.</span><button className="button" disabled={busy}>{busy ? "Writing your story..." : isSignedIn ? "Create my story" : "Sign in and create"}</button></div>
    </form>
  );
}
