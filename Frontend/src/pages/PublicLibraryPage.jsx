import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Eye, Layers3 } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { libraryApi } from "../api.js";
import { MODEL_PAGES, categoryForEntry } from "../catalog.js";
import { EmptyPage, PageTitle } from "./WorkspaceComponents.jsx";

const READING_SPACE_TYPES = new Set(["BOOK", "PAPER", "ARTICLE"]);
const READING_SECTION_TYPES = new Set(["WORDS_SECTION", "PHRASES_SECTION", "THEORIES_SECTION"]);

export default function PublicLibraryPage({ token, accessType = "public" }) {
  const { libraryId, modelKey } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const parentId = searchParams.get("parentId");
  const [library, setLibrary] = useState(null);
  const [models, setModels] = useState([]);
  const [entries, setEntries] = useState([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLibrary(null);
    setModels([]);
    setEntries([]);
    setPending(true);
    setError("");
    (accessType === "shared"
      ? libraryApi.getAccessible(token, libraryId)
      : libraryApi.getPublic(token, libraryId))
      .then((result) => {
        if (!active) return;
        setLibrary(result.library);
        setModels(result.models);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token, libraryId, accessType]);

  useEffect(() => {
    if (!modelKey || !models.some((model) => model.modelKey === modelKey)) {
      setEntries([]);
      return undefined;
    }
    let active = true;
    setPending(true);
    setError("");
    (accessType === "shared"
      ? libraryApi.listAccessibleEntries(token, libraryId, modelKey, parentId)
      : libraryApi.listPublicEntries(token, libraryId, modelKey, parentId))
      .then((result) => active && setEntries(result))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token, libraryId, modelKey, models, parentId, accessType]);

  const model = MODEL_PAGES.find((item) => item.id === modelKey);
  const isPublicModel = models.some((item) => item.modelKey === modelKey);

  function openReadingEntry(entry) {
    if (READING_SPACE_TYPES.has(entry.entryType) || READING_SECTION_TYPES.has(entry.entryType)) {
      setSearchParams({ parentId: String(entry.id) });
    }
  }

  if (pending && !library) {
    return <div className="workspace page-workspace"><div className="page-loading">Opening public library…</div></div>;
  }

  if (error && !library) {
    return <div className="workspace page-workspace"><PageTitle title="Library unavailable" description={error} /><Link className="back-link" to={accessType === "shared" ? "/saved" : "/discover"}><ArrowLeft size={14} /> {accessType === "shared" ? "Back to saved shelves" : "Back to discovery"}</Link></div>;
  }

  if (!library) return null;

  return (
    <div className="workspace page-workspace">
      <Link className="back-link" to={modelKey ? `${accessType === "shared" ? "/shared" : "/discover"}/${libraryId}` : accessType === "shared" ? "/saved" : "/discover"}>
        <ArrowLeft size={14} /> {modelKey ? library.name : accessType === "shared" ? "Back to saved shelves" : "Back to discovery"}
      </Link>

      {!modelKey ? (
        <>
          <PageTitle
            eyebrow={`SHARED BY ${library.ownerName || library.ownerUsername}`}
            title={library.name}
            description={accessType === "shared"
              ? "Browse the models the owner has shared with you."
              : "Choose a public model to browse. Private models remain visible only to their owner."}
          />
          {error && <div className="page-alert" role="alert">{error}</div>}
          {models.length ? (
            <div className="model-card-grid">
              {models.map((item) => {
                const modelPage = MODEL_PAGES.find((page) => page.id === item.modelKey);
                const Icon = modelPage?.icon ?? Layers3;
                return (
                  <Link className="model-card" to={`${accessType === "shared" ? "/shared" : "/discover"}/${libraryId}/${item.modelKey}`} key={item.modelKey}>
                    <span className="model-card-icon"><Icon size={22} /></span>
                    <strong>{modelPage?.label ?? item.modelKey}</strong>
                    <span className="model-card-description">{modelPage?.description}</span>
                    <span className="model-card-link">Browse model <ArrowRight size={14} /></span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyPage title="No public models." description="The owner has not shared any models in this library." />
          )}
        </>
      ) : !model || !isPublicModel ? (
        <PageTitle title="Model unavailable" description="This model is private or does not exist." />
      ) : (
        <>
          <PageTitle
            eyebrow={`${library.name.toUpperCase()} · ${accessType === "shared" ? "SHARED MODEL" : "PUBLIC MODEL"}`}
            title={parentId ? "Reading space contents" : model.label}
            description={parentId ? "Browse the notes shared in this reading space." : model.description}
          />
          <div className="public-model-meta"><Eye size={14} /> Read-only · {accessType === "shared" ? "Shared with you by" : "Shared by"} {library.ownerName || library.ownerUsername}</div>
          {error && <div className="page-alert" role="alert">{error}</div>}
          {pending ? (
            <div className="page-loading">Loading shared entries…</div>
          ) : entries.length ? (
            <div className="entry-grid">
              {entries.map((entry) => {
                const category = categoryForEntry(entry);
                const canOpen = modelKey === "reading-spaces"
                  && (READING_SPACE_TYPES.has(entry.entryType) || READING_SECTION_TYPES.has(entry.entryType));
                const Icon = category.icon ?? BookOpen;
                return (
                  <article className={`entry-card ${canOpen ? "entry-container" : ""}`} key={`${entry.entryType}-${entry.id}`}>
                    <div className="entry-card-top">
                      <span className={`entry-type type-${category.color}`}><Icon size={14} />{category.label}</span>
                    </div>
                    <h3>{entry.title}</h3>
                    {entry.content && <p className="entry-excerpt">{entry.content}</p>}
                    <div className="entry-card-bottom">
                      {entry.url ? <a href={entry.url} target="_blank" rel="noreferrer">OPEN SOURCE <ArrowRight size={12} /></a> : <span>{canOpen ? "BROWSE CONTENTS" : "SHARED ENTRY"}</span>}
                      {canOpen && <button className="public-entry-open" onClick={() => openReadingEntry(entry)}>Open <ArrowRight size={14} /></button>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyPage title="Nothing here yet." description="This public model does not have any entries at this level." />
          )}
        </>
      )}
    </div>
  );
}
