import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, BookOpen, Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { networkApi } from "../api.js";
import { EmptyPage, PageTitle } from "./WorkspaceComponents.jsx";

export default function PublicLibrariesPage({ token }) {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    networkApi.discoverLibraries(token)
      .then((result) => active && setLibraries(result))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  async function toggleSave(library) {
    setSavingId(library.id);
    setError("");
    try {
      if (library.isSaved) await networkApi.unsaveLibrary(token, library.id);
      else await networkApi.saveLibrary(token, library.id);
      setLibraries((current) => current.map((item) => item.id === library.id
        ? { ...item, isSaved: !library.isSaved }
        : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="workspace page-workspace">
      <PageTitle
        eyebrow="COMMUNITY SHELVES"
        title="Discover public libraries"
        description="Explore libraries and models shared by other signed-in readers."
      />
      {error && <div className="page-alert" role="alert">{error}</div>}
      {loading ? (
        <div className="page-loading">Finding public libraries…</div>
      ) : libraries.length ? (
        <div className="library-card-grid">
          {libraries.map((library) => (
            <article className="network-library-card" key={library.id}>
              <Link className="model-card public-library-card" to={`/discover/${library.id}`}>
                <span className="model-card-icon"><BookOpen size={22} /></span>
                <strong>{library.name}</strong>
                <span className="model-card-description">
                  Shared by {library.ownerName || library.ownerUsername} · {library.publicModelCount} public {library.publicModelCount === 1 ? "model" : "models"}
                </span>
                <span className="model-card-link">Browse library <ArrowRight size={14} /></span>
              </Link>
              <button className="button button-outline" disabled={savingId === library.id} onClick={() => toggleSave(library)}>
                <Bookmark size={14} /> {library.isSaved ? "Saved" : "Save library"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyPage
          title="No public libraries yet."
          description="When other readers share a public library, you will find it here."
        />
      )}
      <div className="discover-footnote"><Compass size={15} /> Public libraries and models can only be viewed by signed-in users.</div>
    </div>
  );
}
