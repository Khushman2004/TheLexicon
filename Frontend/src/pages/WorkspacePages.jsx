import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Feather, Plus, Search, Settings2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { libraryApi } from "../api.js";
import { ENTRY_TYPES, MODEL_PAGES, categoryForEntry, entryTypeForCategory } from "../catalog.js";

export function LibrariesPage({ libraries, loading, onCreate }) {
  return (
    <div className="workspace page-workspace">
      <PageTitle eyebrow="YOUR PERSONAL ARCHIVE" title="Your libraries" description="Choose a library to pick up where your curiosity left off." />
      {loading ? <PageLoading /> : (
        <div className="library-card-grid">
          {libraries.map((library) => (
            <Link className="model-card library-card" to={`/libraries/${library.id}`} key={library.id}>
              <span className="model-card-icon"><BookOpen size={22} /></span>
              <span className="eyebrow">LIBRARY {String(library.libraryIndex).padStart(2, "0")}</span>
              <strong>{library.name}</strong>
              <span className="model-card-description">Open your collection and keep exploring.</span>
              <span className="model-card-link">Open library <ArrowRight size={14} /></span>
            </Link>
          ))}
          <button className="model-card create-library-card" onClick={onCreate}>
            <span className="model-card-icon"><Plus size={22} /></span>
            <strong>Create a library</strong>
            <span className="model-card-description">Make space for a new subject or season.</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function LibraryHomePage({ library, onRename }) {
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
      <div className="model-card-grid">
        {MODEL_PAGES.map((model) => {
          const Icon = model.icon;
          return (
            <Link className="model-card" to={`/libraries/${library.id}/${model.id}`} key={model.id}>
              <span className="model-card-icon"><Icon size={22} /></span>
              <strong>{model.label}</strong>
              <span className="model-card-description">{model.description}</span>
              <span className="model-card-link">Explore model <ArrowRight size={14} /></span>
            </Link>
          );
        })}
      </div>
      <div className="home-page-actions">
        <button className="button button-outline" onClick={onRename}>
          <Settings2 size={15} /> Rename this library
        </button>
      </div>
    </div>
  );
}

export function ModelPage({ token, library, refreshKey, onAdd, onEdit, onDelete }) {
  const navigate = useNavigate();
  const { modelId, typeRoute } = useParams();
  const model = MODEL_PAGES.find((item) => item.id === modelId);
  const selectedType = ENTRY_TYPES.find((item) => item.route === typeRoute && model?.types.includes(item.id));
  const isReadingOverview = modelId === "reading-spaces" && !typeRoute;
  const [entries, setEntries] = useState([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortNewest, setSortNewest] = useState(false);

  useEffect(() => {
    if (!model || (!isReadingOverview && !selectedType)) return undefined;
    let active = true;
    setPending(true);
    setError("");
    const request = isReadingOverview
      ? libraryApi.listReadingSpaces(token, library.id)
      : libraryApi.listEntries(token, library.id, selectedType.id);
    request
      .then((result) => active && setEntries(result))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token, library.id, model, selectedType, isReadingOverview, refreshKey]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entries
      .filter((entry) => !query
        || entry.title.toLocaleLowerCase().includes(query)
        || (entry.content ?? "").toLocaleLowerCase().includes(query))
      .sort((first, second) => sortNewest
        ? new Date(second.createdAt) - new Date(first.createdAt)
        : first.title.localeCompare(second.title));
  }, [entries, search, sortNewest]);

  if (!model) return <div className="workspace page-workspace"><PageTitle title="Model not found" description="Choose one of the five library models from the navigation." /></div>;

  const heading = isReadingOverview ? model.label : selectedType?.plural ?? model.label;
  const allowedCategories = isReadingOverview
    ? model.types
    : selectedType ? [selectedType.id] : [model.types[0]];
  const defaultCategory = selectedType?.id ?? model.types[0];

  function openEntry(entry) {
    if (modelId === "reading-spaces" && ["BOOK", "PAPER", "ARTICLE"].includes(entry.entryType)) {
      navigate(`/libraries/${library.id}/reading-spaces/${entry.id}`);
    }
  }

  return (
    <div className="workspace page-workspace">
      <PageTitle eyebrow={model.label.toUpperCase()} title={heading} description={model.description} />
      <div className="model-toolbar">
        <nav className="model-tabs" aria-label={`${model.label} sections`}>
          {modelId === "reading-spaces" && (
            <Link className={`model-tab ${isReadingOverview ? "active" : ""}`} to={`/libraries/${library.id}/reading-spaces`}>All reading spaces</Link>
          )}
          {model.types.map((typeId) => {
            const type = entryTypeForCategory(typeId);
            return (
              <Link
                className={`model-tab ${selectedType?.id === typeId ? "active" : ""}`}
                key={typeId}
                to={`/libraries/${library.id}/${model.id}/${type.route}`}
              >
                {type.plural}
              </Link>
            );
          })}
        </nav>
        <button className="button button-primary" onClick={() => onAdd(defaultCategory, allowedCategories)}>
          <Plus size={16} /> Add {isReadingOverview ? "reading space" : selectedType?.label.toLowerCase() ?? "entry"}
        </button>
      </div>

      <div className="page-list-tools">
        <label className="search-field">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${heading.toLowerCase()}…`} aria-label={`Search ${heading}`} />
        </label>
        <button className={`sort-button ${sortNewest ? "sort-active" : ""}`} onClick={() => setSortNewest((current) => !current)}>
          {sortNewest ? "Newest first" : "Alphabetical"}
        </button>
      </div>

      {error && <div className="page-alert" role="alert">{error}</div>}
      {pending ? <PageLoading /> : visibleEntries.length ? (
        <div className="entry-grid">
          {visibleEntries.map((entry) => {
            const entryCategory = categoryForEntry(entry);
            return (
              <WorkspaceEntryCard
                entry={entry}
                category={entryCategory}
                key={`${entry.entryType}-${entry.id}`}
                onOpen={() => openEntry(entry)}
                onEdit={() => onEdit({ ...entry, category: entryCategory.id })}
                onDelete={() => onDelete({ ...entry, category: entryCategory.id })}
              />
            );
          })}
        </div>
      ) : (
        <EmptyPage title={search ? "No matching entries." : `No ${heading.toLowerCase()} yet.`} description="Start a page for something you want to remember." />
      )}
    </div>
  );
}

export function ReadingSpacePage({ token, library }) {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const [space, setSpace] = useState(null);
  const [sections, setSections] = useState([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    async function loadReadingSpace() {
      try {
        const spaces = await libraryApi.listReadingSpaces(token, library.id);
        const sections = await libraryApi.listEntries(token, library.id, "all", spaceId);
        if (!active) return;
        setSpace(spaces.find((item) => String(item.id) === spaceId) ?? null);
        setSections(sections);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setPending(false);
      }
    }
    loadReadingSpace();
    return () => { active = false; };
  }, [token, library.id, spaceId]);

  return (
    <div className="workspace page-workspace">
      <Link className="back-link" to={`/libraries/${library.id}/reading-spaces`}>← All reading spaces</Link>
      {error && <div className="page-alert" role="alert">{error}</div>}
      <PageTitle eyebrow="READING SPACE" title={space?.title ?? "Reading space"} description={space?.content || "Open a subsection to add the notes for this reading space."} />
      {pending ? <PageLoading /> : <div className="model-card-grid section-card-grid">
        {sections.map((section) => (
          <button
            className="model-card section-card"
            key={section.id}
            onClick={() => navigate(`/libraries/${library.id}/reading-spaces/${spaceId}/sections/${section.id}`)}
          >
            <span className="model-card-icon"><BookOpen size={22} /></span>
            <strong>{section.title}</strong>
            <span className="model-card-description">{sectionDescription(section.entryType)}</span>
            <span className="model-card-link">Open section <ArrowRight size={14} /></span>
          </button>
        ))}
      </div>}
    </div>
  );
}

export function ReadingSpaceSectionPage({ token, library, refreshKey, onAdd, onEdit, onDelete }) {
  const { spaceId, sectionId } = useParams();
  const [section, setSection] = useState(null);
  const [entries, setEntries] = useState([]);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const allowedCategories = section?.entryType === "WORDS_SECTION"
    ? ["word"]
    : section?.entryType === "PHRASES_SECTION"
      ? ["phrase", "idiom"]
      : ["theory"];

  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    async function loadSection() {
      try {
        const sections = await libraryApi.listEntries(token, library.id, "all", spaceId);
        const children = await libraryApi.listEntries(token, library.id, "all", sectionId);
        if (!active) return;
        setSection(sections.find((item) => String(item.id) === sectionId) ?? null);
        setEntries(children);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setPending(false);
      }
    }
    loadSection();
    return () => { active = false; };
  }, [token, library.id, spaceId, sectionId, refreshKey]);

  return (
    <div className="workspace page-workspace">
      <Link className="back-link" to={`/libraries/${library.id}/reading-spaces/${spaceId}`}>← Back to reading space</Link>
      <PageTitle eyebrow="READING SPACE SECTION" title={section?.title ?? "Section"} description={sectionDescription(section?.entryType)} />
      <div className="model-toolbar">
        <span className="eyebrow">{entries.length} {entries.length === 1 ? "ENTRY" : "ENTRIES"}</span>
        <button className="button button-primary" onClick={() => onAdd(allowedCategories[0], { id: Number(sectionId), title: section?.title }, allowedCategories)} disabled={!section}>
          <Plus size={16} /> Add to section
        </button>
      </div>
      {error && <div className="page-alert" role="alert">{error}</div>}
      {pending ? <PageLoading /> : entries.length ? (
        <div className="entry-grid">
          {entries.map((entry) => {
            const entryCategory = categoryForEntry(entry);
            return (
              <WorkspaceEntryCard
                key={`${entry.entryType}-${entry.id}`}
                entry={entry}
                category={entryCategory}
                onEdit={() => onEdit({ ...entry, category: entryCategory.id })}
                onDelete={() => onDelete({ ...entry, category: entryCategory.id })}
              />
            );
          })}
        </div>
      ) : (
        <EmptyPage title={`No ${section?.title?.toLowerCase() ?? "entries"} yet.`} description="Save your first note in this section." />
      )}
    </div>
  );
}

function WorkspaceEntryCard({ entry, category, onOpen, onEdit, onDelete }) {
  const Icon = category.icon;
  const isReadingSpace = ["BOOK", "PAPER", "ARTICLE"].includes(entry.entryType);
  return (
    <article className={`entry-card ${isReadingSpace ? "entry-container" : ""}`} onClick={isReadingSpace ? onOpen : undefined}>
      <div className="entry-card-top">
        <span className={`entry-type type-${category.color}`}><Icon size={14} />{category.label}</span>
        <div className="entry-actions">
          <button className="entry-action" onClick={(event) => { event.stopPropagation(); onEdit(); }} aria-label={`Edit ${entry.title}`} title="Edit"><Settings2 size={15} /></button>
          <button className="entry-action entry-delete" onClick={(event) => { event.stopPropagation(); if (window.confirm(`Remove “${entry.title}”?`)) onDelete(); }} aria-label={`Delete ${entry.title}`} title="Delete">×</button>
        </div>
      </div>
      <h3>{entry.title}</h3>
      {entry.content ? <p className="entry-excerpt">{entry.content}</p> : <p className="entry-excerpt entry-placeholder">A little space for your notes.</p>}
      <div className="entry-card-bottom">
        {entry.url ? <a href={entry.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>OPEN SOURCE <ArrowRight size={12} /></a> : <span>{isReadingSpace ? "OPEN READING SPACE" : "JUST ADDED"}</span>}
        {isReadingSpace && <ArrowRight className="entry-open-chevron" size={17} />}
      </div>
    </article>
  );
}

function PageTitle({ eyebrow, title, description }) {
  return (
    <div className="page-title-block">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}

function PageLoading() {
  return <div className="page-loading"><span className="loading-spinner" /> Loading your page…</div>;
}

function EmptyPage({ title, description }) {
  return <div className="empty-shelf page-empty"><div className="empty-shelf-icon"><Feather size={24} /></div><h3>{title}</h3><p>{description}</p></div>;
}

function sectionDescription(type) {
  if (type === "WORDS_SECTION") return "Words and their meanings from this reading.";
  if (type === "PHRASES_SECTION") return "Phrases and idioms you want to keep.";
  return "Your theories and custom interpretations.";
}
