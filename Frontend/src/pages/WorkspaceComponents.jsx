import { ArrowRight, Feather, Settings2 } from "lucide-react";

export function WorkspaceEntryCard({
  entry,
  category,
  onOpen,
  onEdit,
  onDelete,
}) {
  const Icon = category.icon;
  const isReadingSpace = ["BOOK", "PAPER", "ARTICLE"].includes(entry.entryType);
  return (
    <article
      className={`entry-card ${isReadingSpace ? "entry-container" : ""}`}
      onClick={isReadingSpace ? onOpen : undefined}
    >
      <div className="entry-card-top">
        <span className={`entry-type type-${category.color}`}>
          <Icon size={14} />
          {category.label}
        </span>
        <div className="entry-actions">
          <button
            className="entry-action"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            aria-label={`Edit ${entry.title}`}
            title="Edit"
          >
            <Settings2 size={15} />
          </button>
          <button
            className="entry-action entry-delete"
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm(`Remove “${entry.title}”?`)) onDelete();
            }}
            aria-label={`Delete ${entry.title}`}
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>
      <h3>{entry.title}</h3>
      {entry.content ? (
        <p className="entry-excerpt">{entry.content}</p>
      ) : (
        <p className="entry-excerpt entry-placeholder">
          A little space for your notes.
        </p>
      )}
      <div className="entry-card-bottom">
        {entry.url ? (
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            OPEN SOURCE <ArrowRight size={12} />
          </a>
        ) : (
          <span>{isReadingSpace ? "OPEN READING SPACE" : "JUST ADDED"}</span>
        )}
        {isReadingSpace && (
          <ArrowRight className="entry-open-chevron" size={17} />
        )}
      </div>
    </article>
  );
}

export function PageTitle({ eyebrow, title, description }) {
  return (
    <div className="page-title-block">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="page-loading">
      <span className="loading-spinner" /> Loading your page…
    </div>
  );
}

export function EmptyPage({ title, description }) {
  return (
    <div className="empty-shelf page-empty">
      <div className="empty-shelf-icon">
        <Feather size={24} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function sectionDescription(type) {
  if (type === "WORDS_SECTION")
    return "Words and their meanings from this reading.";
  if (type === "PHRASES_SECTION") return "Phrases and idioms you want to keep.";
  return "Your theories and custom interpretations.";
}
