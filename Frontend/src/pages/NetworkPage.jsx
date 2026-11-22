import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, Compass, Search, UserRound, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { networkApi } from "../api.js";
import { EmptyPage, PageTitle } from "./WorkspaceComponents.jsx";

export default function NetworkPage({ token }) {
  const [tab, setTab] = useState("people");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [pending, setPending] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    Promise.all([
      networkApi.connections(token, "following"),
      networkApi.discoverLibraries(token),
    ])
      .then(([nextFollowing, nextLibraries]) => {
        if (!active) return;
        setFollowing(nextFollowing);
        setLibraries(nextLibraries);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token]);

  async function searchPeople(event) {
    event.preventDefault();
    const term = search.trim();
    if (!term) {
      setUsers([]);
      setHasSearched(false);
      return;
    }
    setHasSearched(true);
    setPending(true);
    setError("");
    try {
      setUsers(await networkApi.searchUsers(token, term));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  async function toggleFollow(person) {
    setSavingId(person.id);
    setError("");
    try {
      if (person.isFollowing) await networkApi.unfollow(token, person.id);
      else await networkApi.follow(token, person.id);
      setUsers((current) => current.map((user) => user.id === person.id
        ? { ...user, isFollowing: !person.isFollowing }
        : user));
      setFollowing((current) => person.isFollowing
        ? current.filter((user) => user.id !== person.id)
        : [...current, { ...person, isFollowing: true }]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingId(null);
    }
  }

  async function toggleSave(library) {
    setSavingId(`library-${library.id}`);
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

  const visibleUsers = hasSearched ? users : following;

  return (
    <div className="workspace page-workspace">
      <PageTitle eyebrow="THE LEXICON NETWORK" title="Ideas travel further together." description="Find readers, follow their work, and keep the libraries you want to revisit." />
      {error && <div className="page-alert" role="alert">{error}</div>}
      <div className="network-tabs" role="tablist" aria-label="Network sections">
        <button className={tab === "people" ? "active" : ""} onClick={() => setTab("people")}><Users size={15} /> People</button>
        <button className={tab === "libraries" ? "active" : ""} onClick={() => setTab("libraries")}><Compass size={15} /> Public libraries</button>
      </div>
      {tab === "people" ? (
        <>
          <form className="network-search" onSubmit={searchPeople}>
            <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or username" aria-label="Search people" /></label>
            <button className="button button-primary" type="submit"><Search size={15} /> Search people</button>
          </form>
          <div className="network-section-title"><h2>{hasSearched ? "Search results" : "People you follow"}</h2><span>{visibleUsers.length} people</span></div>
          {pending ? <div className="page-loading">Finding your people…</div> : visibleUsers.length ? (
            <div className="person-card-grid">
              {visibleUsers.map((person) => (
                <article className="person-card" key={person.id}>
                  <Link className="person-avatar" to={`/profiles/${person.id}`}><UserRound size={23} /></Link>
                  <div className="person-copy">
                    <Link to={`/profiles/${person.id}`}><strong>{person.fullName || person.username}</strong></Link>
                    <span>@{person.username}</span>
                    {person.bio && <p>{person.bio}</p>}
                    <small>{person.followerCount} followers · {person.followingCount} following</small>
                  </div>
                  <button className="button button-outline" disabled={savingId === person.id} onClick={() => toggleFollow(person)}>
                    {person.isFollowing ? "Following" : "Follow"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyPage
              title={hasSearched ? "No people found." : "Your network starts here."}
              description={hasSearched
                ? "Search excludes your own profile. Try another person's username or full name; email addresses aren't searchable."
                : "Search for a reader to follow and see their public libraries."}
            />
          )}
        </>
      ) : (
        <>
          <div className="network-section-title"><h2>Libraries shared by readers</h2><Link to="/saved">Saved shelf <Bookmark size={14} /></Link></div>
          {pending ? <div className="page-loading">Finding public libraries…</div> : libraries.length ? (
            <div className="library-card-grid">
              {libraries.map((library) => (
                <article className="network-library-card" key={library.id}>
                  <Link className="model-card" to={`/discover/${library.id}`}>
                    <span className="model-card-icon"><Compass size={21} /></span>
                    <strong>{library.name}</strong>
                    <span className="model-card-description">By {library.ownerName || library.ownerUsername} · {library.publicModelCount} public {library.publicModelCount === 1 ? "model" : "models"}</span>
                    <span className="model-card-link">Explore library <ArrowRight size={14} /></span>
                  </Link>
                  <button className="button button-outline" disabled={savingId === `library-${library.id}`} onClick={() => toggleSave(library)}>
                    <Bookmark size={14} /> {library.isSaved ? "Saved" : "Save library"}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyPage title="No shared libraries yet." description="Public libraries from your network will show up here." />
          )}
        </>
      )}
      {!pending && !following.length && tab === "people" && !hasSearched && (
        <p className="network-hint"><Users size={14} /> You can follow people from search results or their profile.</p>
      )}
    </div>
  );
}
