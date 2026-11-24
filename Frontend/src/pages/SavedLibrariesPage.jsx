import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, LockKeyhole, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { networkApi } from "../api.js";
import { EmptyPage, PageTitle } from "./WorkspaceComponents.jsx";

export default function SavedLibrariesPage({ token }) {
  const [saved, setSaved] = useState([]);
  const [shared, setShared] = useState([]);
  const [pending, setPending] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    Promise.all([networkApi.savedLibraries(token), networkApi.sharedLibraries(token)])
      .then(([nextSaved, nextShared]) => {
        if (!active) return;
        setSaved(nextSaved);
        setShared(nextShared);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token]);

  async function unsave(libraryId) {
    setSavingId(libraryId);
    setError("");
    try {
      await networkApi.unsaveLibrary(token, libraryId);
      setSaved((current) => current.filter((library) => library.id !== libraryId));
      setShared((current) => current.map((library) => library.id === libraryId ? { ...library, isSaved: false } : library));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingId(null);
    }
  }

  function libraryCard(library, isShared = false) {
    return (
      <article className="network-library-card" key={`${isShared ? "shared" : "saved"}-${library.id}`}>
        <Link className="model-card" to={`/shared/${library.id}`}>
          <span className="model-card-icon">{isShared ? <LockKeyhole size={20} /> : <Bookmark size={20} />}</span>
          <strong>{library.name}</strong>
          <span className="model-card-description">
            {isShared ? `Private · shared by ${library.ownerName || library.ownerUsername}` : `Saved from ${library.ownerName || library.ownerUsername}`}
          </span>
          <span className="model-card-link">Open library <ArrowRight size={14} /></span>
        </Link>
        {!isShared && <button className="button button-outline" disabled={savingId === library.id} onClick={() => unsave(library.id)}><Bookmark size={14} /> Remove saved library</button>}
      </article>
    );
  }

  return (
    <div className="workspace page-workspace">
      <PageTitle eyebrow="YOUR NETWORK" title="Saved shelves & shared with you" description="Keep public libraries close and open the private shelves their owners have approved for you." />
      {error && <div className="page-alert" role="alert">{error}</div>}
      {pending ? <div className="page-loading">Loading your saved shelves…</div> : (
        <>
          <div className="profile-library-heading"><h2><Bookmark size={18} /> Saved libraries</h2><Link to="/network"><Users size={14} /> Discover</Link></div>
          {saved.length ? <div className="library-card-grid">{saved.map((library) => libraryCard(library))}</div> : <EmptyPage title="Your saved shelf is empty." description="Save public libraries from Discover or reader profiles to find them here." />}
          <div className="profile-library-heading shared-heading"><h2><LockKeyhole size={18} /> Shared with you</h2></div>
          {shared.length ? <div className="library-card-grid">{shared.map((library) => libraryCard(library, true))}</div> : <p className="access-panel-muted">When a library owner approves your request, their private library will appear here.</p>}
        </>
      )}
    </div>
  );
}
