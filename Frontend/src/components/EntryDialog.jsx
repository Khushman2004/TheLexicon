import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { ENTRY_TYPES } from "../catalog.js";

export default function EntryDialog({
  initialCategory,
  initialEntry,
  parentEntry,
  onClose,
  onSave,
}) {
  const [category, setCategory] = useState(initialEntry?.category ?? initialCategory);
  const [title, setTitle] = useState(initialEntry?.title ?? "");
  const [content, setContent] = useState(initialEntry?.content ?? "");
  const [url, setUrl] = useState(initialEntry?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef(null);
  const activeCategory = ENTRY_TYPES.find((item) => item.id === category) ?? ENTRY_TYPES[0];
  const Icon = activeCategory.icon;

  useEffect(() => titleRef.current?.focus(), []);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const details = {
      title: title.trim(),
      content: content.trim() || null,
      url: url.trim() || null,
    };
    if (!initialEntry && parentEntry) details.parentEntryId = parentEntry.id;

    try {
      await onSave(category, details);
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card entry-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-dialog-title">
        <button className="icon-button dialog-close" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </button>
        <div className={`dialog-type-icon type-${activeCategory.color}`}><Icon size={20} /></div>
        <div className="dialog-stamp">{initialEntry ? "A SMALL EDIT" : "ADD TO YOUR COLLECTION"}</div>
        <h2 id="entry-dialog-title">{initialEntry ? "Tend to a detail." : `Save a ${activeCategory.label.toLowerCase()}.`}</h2>
        <p>
          {parentEntry
            ? `Tucked inside “${parentEntry.title}”.`
            : "Capture the detail before it slips away."}
        </p>
        <form onSubmit={handleSubmit}>
          {!initialEntry && (
            <label>
              This is a
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {ENTRY_TYPES.map((item) => (
                  <option value={item.id} key={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            {category === "word" ? "The word" : category === "book" ? "Book title" : "Title"}
            <input
              ref={titleRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={category === "word" ? "e.g. petrichor" : "Give it a name"}
              maxLength={255}
              required
            />
          </label>
          <label>
            {category === "word" ? "Meaning or note" : "A note to remember"}
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={category === "word" ? "What does it mean? Where did you find it?" : "A definition, a thought, a few lines…"}
              maxLength={10000}
              rows={4}
            />
          </label>
          <label>
            A link <span className="optional-label">OPTIONAL</span>
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              maxLength={2048}
            />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary dialog-submit" disabled={busy}>
            {busy ? "Saving…" : initialEntry ? "Save changes" : "Save to my library"}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>
      </section>
    </div>
  );
}
