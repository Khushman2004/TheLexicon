import { ArrowRight, Feather, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { MODEL_PAGES } from "../catalog.js";
import { PageTitle } from "./WorkspaceComponents.jsx";

export default function LibraryHomePage({ library, onRename }) {
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
