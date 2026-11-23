import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Feather, LockKeyhole, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { libraryApi } from "../api.js";
import { MODEL_PAGES } from "../catalog.js";
import { PageTitle } from "./WorkspaceComponents.jsx";
import LibraryAccessPanel from "../components/LibraryAccessPanel.jsx";

export default function LibraryHomePage({
  token,
  library,
  onRename,
  onUpdateLibraryVisibility,
  onUpdateModelVisibility,
}) {
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingModels(true);
    setError("");
    libraryApi.listModels(token, library.id)
      .then((result) => active && setModels(result))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoadingModels(false));
    return () => { active = false; };
  }, [token, library.id]);

  async function toggleLibraryVisibility() {
    setSaving("library");
    setError("");
    try {
      await onUpdateLibraryVisibility(!library.isPublic);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  async function toggleModelVisibility(modelKey, isPublic) {
    setSaving(modelKey);
    setError("");
    try {
      const updated = await onUpdateModelVisibility(modelKey, !isPublic);
      setModels((current) => current.map((model) => (
        model.modelKey === modelKey ? updated : model
      )));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="workspace page-workspace">
      <section className="welcome-banner">
        <div className="welcome-text">
          <p className="eyebrow"><Feather size={14} /> YOUR LIBRARY</p>
          <h1>{library.name}</h1>
          <p>A home for ideas, language, reading, and research.</p>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="banner-sun" />
          <div className="banner-book book-back" />
          <div className="banner-book book-front"><span>WORDS<br />TO KEEP</span><Feather size={16} /></div>
        </div>
      </section>
      <PageTitle eyebrow="CHOOSE A MODEL" title="Where will you begin?" description="Each model has its own page, tools, and collection." />
      {error && <div className="page-alert" role="alert">{error}</div>}
      {loadingModels ? (
        <div className="page-loading">Loading model visibility…</div>
      ) : (
        <div className="model-card-grid">
          {MODEL_PAGES.map((model) => {
            const Icon = model.icon;
            const visibility = models.find((item) => item.modelKey === model.id);
            return (
              <div className="model-card-wrap" key={model.id}>
                <Link className="model-card" to={`/libraries/${library.id}/${model.id}`}>
                  <span className="model-card-icon"><Icon size={22} /></span>
                  <strong>{model.label}</strong>
                  <span className="model-card-description">{model.description}</span>
                  <span className="model-card-link">Explore model <ArrowRight size={14} /></span>
                </Link>
                <button
                  className="visibility-control"
                  disabled={!visibility || saving !== ""}
                  onClick={() => toggleModelVisibility(model.id, visibility?.isPublic)}
                >
                  {visibility?.isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
                  {visibility?.isPublic ? "Public model" : "Private model"}
                  <span>{visibility?.isPublic ? "Change to private" : "Make public"}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="visibility-note">
        <LockKeyhole size={16} />
        <span>{library.isPublic
          ? "This library is public. Signed-in readers can see only the models marked public, and only if your profile is public."
          : "To appear in discovery, make this library public, mark at least one model public, and make your profile public."}</span>
      </div>
      <div className="home-page-actions">
        <button className="button button-outline" disabled={saving !== ""} onClick={toggleLibraryVisibility}>
          {library.isPublic ? <Eye size={15} /> : <EyeOff size={15} />}
          {library.isPublic ? "Library is public" : "Library is private"}
          <span>{saving === "library" ? "Saving…" : library.isPublic ? "Make private" : "Make public"}</span>
        </button>
        <button className="button button-outline" onClick={onRename}>
          <Settings2 size={15} /> Rename this library
        </button>
      </div>
      <LibraryAccessPanel token={token} library={library} />
    </div>
  );
}
