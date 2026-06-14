"use client";

import { useState } from "react";

export function PreferencesForm({ initialValue }: { initialValue: boolean }) {
  const [value, setValue] = useState(initialValue);
  const [message, setMessage] = useState("");
  async function save() {
    const response = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marketingOptIn: value }),
    });
    const result = await response.json();
    setMessage(response.ok ? "Preferences saved." : result.error);
  }
  return (
    <section className="auth-panel">
      <h2>Email preferences</h2>
      <label className="checkbox"><input checked={value} onChange={event => setValue(event.target.checked)} type="checkbox" /><span>Send me occasional StoryGlow news and new story ideas.</span></label>
      <p>Essential story, sign-in, security, and service emails do not depend on this choice.</p>
      <button className="button" onClick={save}>Save preferences</button>
      <p className="form-message" role="status">{message}</p>
    </section>
  );
}
