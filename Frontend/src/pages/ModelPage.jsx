import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Settings2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { libraryApi } from "../api.js";
import { ENTRY_TYPES, MODEL_PAGES, categoryForEntry, entryTypeForCategory } from "../catalog.js";
import { EmptyPage, PageLoading, PageTitle, WorkspaceEntryCard } from "./WorkspaceComponents.jsx";

export default function ModelPage({ token, library, refreshKey, onAdd, onEdit, onDelete }) {
  const navigate = useNavigate();
  const { modelId, typeRoute } = useParams();
  const model = MODEL_PAGES.find((item) => item.id === modelId);
  const isReadingOverview = modelId === "reading-spaces" && !typeRoute;
  const selectedType = ENTRY_TYPES.find((item) => item.route === typeRoute && model?.types.includes(item.id))
    ?? (!typeRoute && !isReadingOverview ? entryTypeForCategory(model?.types[0]) : undefined);
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
      navigate(`/libraries/${library.id}/reading-spaces/${entry.id}/details`);
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
