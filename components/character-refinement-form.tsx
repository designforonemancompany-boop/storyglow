"use client";

import { useState } from "react";
import type { FamilyCharacterRecord } from "@/lib/types";

export function CharacterRefinementForm({ characters }: { characters: FamilyCharacterRecord[] }) {
  const [notes, setNotes] = useState(() => Object.fromEntries(
    characters.map(character => [character.id, character.trait_bible.parentRefinementNotes || ""]),
  ) as Record<string, string>);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  if (!characters.length) {
    return (
      <section className="settings-panel">
        <p className="section-label">Personal story universe</p>
        <h2>Family characters</h2>
        <p>Your reusable illustrated family characters will appear here after your first story is generated.</p>
      </section>
    );
  }

  async function save(characterId: string) {
    setSavingId(characterId);
    setMessage("");
    try {
      const response = await fetch(`/api/family-characters/${characterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentRefinementNotes: notes[characterId] || "" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage("Character notes saved for future books.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save character notes.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="settings-panel">
      <p className="section-label">Personal story universe</p>
      <h2>Reusable family characters</h2>
      <p>StoryGlow reuses illustrated references and structured traits. Raw uploaded family photos are not stored here.</p>
      <div className="character-list">
        {characters.map(character => (
          <article className="character-card" key={character.id}>
            <div>
              <span className="status-pill">{character.source.replaceAll("_", " ")}</span>
              <h3>{character.child_name}</h3>
              <p>{character.trait_bible.childAppearance}</p>
              <small>{character.trait_bible.clothingAccessoryRules}</small>
            </div>
            <label>
              Notes to improve future illustrations
              <textarea
                value={notes[character.id] || ""}
                maxLength={900}
                placeholder="e.g. Keep Maya's yellow shoes and soft bob haircut. Dad wears round glasses; Maya does not."
                onChange={event => setNotes(current => ({ ...current, [character.id]: event.target.value }))}
              />
            </label>
            <button className="button button-small" type="button" disabled={savingId === character.id} onClick={() => void save(character.id)}>
              {savingId === character.id ? "Saving..." : "Save notes"}
            </button>
          </article>
        ))}
      </div>
      {message ? <p className="action-message" role="status">{message}</p> : null}
    </section>
  );
}
