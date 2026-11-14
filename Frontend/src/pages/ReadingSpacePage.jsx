import { useEffect, useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { libraryApi } from "../api.js";
import { PageLoading, PageTitle, sectionDescription } from "./WorkspaceComponents.jsx";

export default function ReadingSpacePage({ token, library }) {
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
