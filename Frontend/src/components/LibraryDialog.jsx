import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";

export default function LibraryDialog({ initialName = "", intent = "create", onClose, onSave }) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  useEffect(() => inputRef.current?.focus(), []);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(name.trim());
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="library-dialog-title">
        <button className="icon-button dialog-close" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </button>
        <div className="dialog-stamp">{intent === "rename" ? "A NEW TITLE" : "A NEW CHAPTER"}</div>
        <h2 id="library-dialog-title">{intent === "rename" ? "A fresh name." : "Make a little room."}</h2>
        <p>{intent === "rename" ? "Give this library a name that feels like yours." : "Give this library a name. You can always rename it later."}</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="library-name">Library name</label>
          <input
            id="library-name"
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Words for the road"
            maxLength={100}
            required
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button-primary dialog-submit" disabled={busy}>
            {busy ? "Saving…" : intent === "rename" ? "Save new name" : "Create library"} {!busy && <ArrowRight size={16} />}
          </button>
        </form>
      </section>
    </div>
  );
}
