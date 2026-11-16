import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { PageLoading, PageTitle } from "./WorkspaceComponents.jsx";

export default function LibrariesPage({ libraries, loading, onCreate }) {
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
