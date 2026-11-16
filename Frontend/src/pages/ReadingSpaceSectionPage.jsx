import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { libraryApi } from "../api.js";
import { categoryForEntry } from "../catalog.js";
import { EmptyPage, PageLoading, PageTitle, WorkspaceEntryCard, sectionDescription } from "./WorkspaceComponents.jsx";

export default function ReadingSpaceSectionPage({ token, library, refreshKey, onAdd, onEdit, onDelete }) {
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
      <Link className="back-link" to={`/libraries/${library.id}/reading-spaces/${spaceId}/details`}>← Back to reading space</Link>
      {error && <div className="page-alert" role="alert">{error}</div>}
      <PageTitle eyebrow="READING SPACE SECTION" title={section?.title ?? "Section"} description={sectionDescription(section?.entryType)} />
      <div className="model-toolbar">
        <span className="eyebrow">{entries.length} {entries.length === 1 ? "ENTRY" : "ENTRIES"}</span>
        <button className="button button-primary" onClick={() => onAdd(allowedCategories[0], { id: Number(sectionId), title: section?.title }, allowedCategories)} disabled={!section}>
          <Plus size={16} /> Add to section
        </button>
      </div>
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
