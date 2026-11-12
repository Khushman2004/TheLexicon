import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  BookMarked,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Feather,
  FolderPlus,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { ApiError, authApi, libraryApi } from "./api.js";
import { CATEGORIES, categoryForEntry, dateLabel } from "./catalog.js";
import AuthPage from "./components/AuthPage.jsx";
import EntryDialog from "./components/EntryDialog.jsx";
import LibraryDialog from "./components/LibraryDialog.jsx";

const TOKEN_KEY = "the-lexicon-token";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [authPending, setAuthPending] = useState(true);
  const [libraries, setLibraries] = useState([]);
  const [activeLibraryId, setActiveLibraryId] = useState(null);
  const [category, setCategory] = useState("all");
  const [parentEntry, setParentEntry] = useState(null);
  const [entries, setEntries] = useState([]);
  const [entryPending, setEntryPending] = useState(false);
  const [loadingLibraries, setLoadingLibraries] = useState(false);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [sortNewest, setSortNewest] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeLibrary = libraries.find((library) => library.id === activeLibraryId) ?? null;

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setLibraries([]);
    setActiveLibraryId(null);
    setEntries([]);
    setPageError("");
  }, []);

  useEffect(() => {
    if (!token) {
      setAuthPending(false);
      return;
    }

    let active = true;
    authApi.me(token)
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
        } else {
          setPageError(error.message);
        }
      })
      .finally(() => active && setAuthPending(false));

    return () => { active = false; };
  }, [token, clearSession]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!token || !user) return undefined;
    let active = true;
    setLoadingLibraries(true);
    libraryApi.list(token)
      .then(({ libraries: result }) => {
        if (!active) return;
        setLibraries(result);
        setActiveLibraryId((current) => (
          result.some((library) => library.id === current) ? current : result[0]?.id ?? null
        ));
        setPageError("");
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          return;
        }
        setPageError(error.message);
      })
      .finally(() => active && setLoadingLibraries(false));
    return () => { active = false; };
  }, [token, user, refreshKey, clearSession]);

  useEffect(() => {
    if (!token || !activeLibrary) return undefined;
    let active = true;
    setEntryPending(true);
    setPageError("");
    libraryApi.listEntries(token, activeLibrary.id, category, parentEntry?.id)
      .then((result) => active && setEntries(result))
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          return;
        }
        setPageError(error.message);
        setEntries([]);
      })
      .finally(() => active && setEntryPending(false));
    return () => { active = false; };
  }, [token, activeLibrary, category, parentEntry, refreshKey, clearSession]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const result = entries.filter((entry) => (
      !query
      || entry.title.toLocaleLowerCase().includes(query)
      || (entry.content ?? "").toLocaleLowerCase().includes(query)
    ));
    return result.sort((first, second) => {
      if (sortNewest) return new Date(second.createdAt) - new Date(first.createdAt);
      return first.title.localeCompare(second.title);
    });
  }, [entries, search, sortNewest]);

  async function handleAuthenticate(mode, details) {
    const result = mode === "register"
      ? await authApi.register(details)
      : await authApi.login(details);
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
    setPageError("");
  }

  async function handleLogout() {
    try {
      await authApi.logout(token);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) setToast(error.message);
    } finally {
      clearSession();
    }
  }

  async function handleCreateLibrary(name) {
    const { library } = await libraryApi.create(token, name);
    setLibraries((current) => [...current, library]);
    setActiveLibraryId(library.id);
    setCategory("all");
    setParentEntry(null);
    setEntries([]);
    setToast(`“${library.name}” is ready for new discoveries.`);
  }

  async function handleRenameLibrary(name) {
    if (!activeLibrary) return;
    const { library } = await libraryApi.rename(token, activeLibrary.id, name);
    setLibraries((current) => current.map((item) => item.id === library.id ? library : item));
    setToast("Library name updated.");
  }

  async function handleSaveEntry(entryCategory, body) {
    if (!activeLibrary) return;
    if (dialog?.entry) {
      await libraryApi.updateEntry(token, activeLibrary.id, entryCategory, dialog.entry.id, body);
      setToast("Your changes have been saved.");
    } else {
      await libraryApi.createEntry(token, activeLibrary.id, entryCategory, body);
      setToast(`${entryCategory[0].toUpperCase()}${entryCategory.slice(1)} added to your library.`);
    }
    setDialog(null);
    setRefreshKey((current) => current + 1);
  }

  async function handleDeleteEntry(entry) {
    const entryCategory = categoryForEntry(entry).id;
    try {
      await libraryApi.deleteEntry(token, activeLibrary.id, entryCategory, entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setToast("Entry removed from your library.");
    } catch (error) {
      setToast(error.message);
    }
  }

  function chooseLibrary(libraryId) {
    setActiveLibraryId(libraryId);
    setParentEntry(null);
    setCategory("all");
    setSearch("");
    setMobileNavOpen(false);
  }

  function chooseCategory(nextCategory) {
    setCategory(nextCategory);
    setParentEntry(null);
    setSearch("");
    setMobileNavOpen(false);
  }

  function openContainer(entry) {
    setParentEntry(entry);
    setCategory("all");
    setSearch("");
  }

  if (authPending) {
    return <div className="loading-screen"><div className="loading-mark"><Feather size={22} /></div><span>Opening your little corner…</span></div>;
  }
  if (!token || !user) return <AuthPage onAuthenticate={handleAuthenticate} />;

  const firstName = user.fullName?.trim().split(/\s+/)[0] || user.username;
  const activeCategory = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0];
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Feather size={20} strokeWidth={1.8} /></div>
          <div><span>the lexicon</span><small>A HOME FOR WORDS</small></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="sidebar-section library-section">
          <div className="sidebar-label-row">
            <span className="sidebar-label">YOUR LIBRARIES</span>
            <button className="sidebar-add" onClick={() => setDialog({ type: "library" })} aria-label="Create a library"><Plus size={15} /></button>
          </div>
          <div className="library-list">
            {libraries.map((library, index) => (
              <button
                className={`library-nav-item ${activeLibraryId === library.id ? "selected" : ""}`}
                key={library.id}
                onClick={() => chooseLibrary(library.id)}
                title={library.name}
              >
                <span className={`library-bookmark bookmark-${index % 4}`}><BookMarked size={15} /></span>
                <span className="library-nav-name">{library.name}</span>
                {activeLibraryId === library.id && <span className="nav-active-dot" />}
              </button>
            ))}
            {!loadingLibraries && libraries.length === 0 && (
              <button className="empty-library-link" onClick={() => setDialog({ type: "library" })}>
                <FolderPlus size={15} /> Create your first library
              </button>
            )}
          </div>
          <button className="new-library-button" onClick={() => setDialog({ type: "library" })}>
            <Plus size={15} /> New library
          </button>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-label">EXPLORE YOUR WORDS</span>
          <nav className="category-nav" aria-label="Entry type">
            {CATEGORIES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={`category-nav-item ${category === item.id ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => chooseCategory(item.id)}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{item.plural}</span>
                  {category === item.id && <ChevronRight className="nav-chevron" size={14} />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-quote">
          <span className="quote-mark">“</span>
          <p>Find the words, and the world opens.</p>
          <span className="quote-attribution">A NOTE TO YOURSELF</span>
        </div>

        <div className="sidebar-user">
          <div className="avatar">{(firstName[0] ?? "L").toUpperCase()}</div>
          <div className="user-copy"><strong>{firstName}</strong><span>Curious by nature</span></div>
          <button className="icon-button logout-button" onClick={handleLogout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb">
            <span>MY SPACE</span><ChevronRight size={13} />
            <strong>{activeLibrary?.name ?? "Your libraries"}</strong>
          </div>
          <div className="topbar-right">
            <span className="date-display">{dateLabel()}</span>
            <span className="topbar-divider" />
            <div className="topbar-avatar">{(firstName[0] ?? "L").toUpperCase()}</div>
          </div>
        </header>

        {pageError && (
          <div className="page-alert" role="alert">
            <CircleHelp size={17} /><span>{pageError}</span>
            <button onClick={() => setRefreshKey((current) => current + 1)}>Try again</button>
          </div>
        )}

        {!activeLibrary && !loadingLibraries ? (
          <section className="welcome-empty">
            <div className="welcome-illustration"><Feather size={36} /></div>
            <p className="eyebrow">EVERY COLLECTION STARTS SOMEWHERE</p>
            <h1>A place for all the<br /><em>words you’ll find.</em></h1>
            <p className="welcome-copy">Create your first library and give your discoveries a home.</p>
            <button className="button button-primary" onClick={() => setDialog({ type: "library" })}>
              Create my first library <ArrowRight size={16} />
            </button>
          </section>
        ) : (
          <div className="workspace">
            <section className="welcome-banner">
              <div className="welcome-text">
                <p className="eyebrow"><Sparkles size={14} /> {dateLabel().toUpperCase()}</p>
                <h1>{greeting}, {firstName}<span className="greeting-comma">.</span></h1>
                <p>Every word you save is a little world you get to keep.</p>
              </div>
              <div className="banner-art" aria-hidden="true">
                <div className="banner-sun" />
                <div className="banner-book book-back" />
                <div className="banner-book book-front"><span>WORDS<br />TO KEEP</span><Feather size={16} /></div>
                <span className="banner-spark spark-a">✳</span>
                <span className="banner-spark spark-b">✳</span>
                <span className="banner-letter">Aa</span>
              </div>
              <div className="banner-index">FIELD NOTES&nbsp; / &nbsp;001</div>
            </section>

            <div className="section-heading">
              <div>
                <p className="eyebrow">{activeLibrary?.name ?? "YOUR COLLECTION"}</p>
                <h2>{parentEntry ? (
                  <><button className="heading-back" onClick={() => setParentEntry(null)} aria-label="Back to library"><ArrowLeft size={19} /></button>{parentEntry.title}</>
                ) : category === "all" ? "Your shelf" : activeCategory.plural}</h2>
                {parentEntry && (
                  <div className="parent-caption">
                    <span>INSIDE {categoryForEntry(parentEntry).label.toUpperCase()}</span>
                    <button onClick={() => setParentEntry(null)}>Back to {activeLibrary?.name}<ArrowRight size={13} /></button>
                  </div>
                )}
              </div>
              <div className="section-actions">
                <button
                  className="button button-outline"
                  onClick={() => setDialog({ type: "rename-library", name: activeLibrary?.name })}
                  disabled={!activeLibrary}
                  title="Rename this library"
                >
                  <Settings2 size={15} /><span>Library settings</span>
                </button>
                <button
                  className="button button-primary add-entry-button"
                  onClick={() => setDialog({ type: "entry", category: category === "all" ? "word" : category })}
                  disabled={!activeLibrary}
                >
                  <Plus size={17} /> Add to shelf
                </button>
              </div>
            </div>

            <div className="toolbar">
              <div className="category-chips" aria-label="Filter by type">
                {CATEGORIES.map((item) => (
                  <button
                    className={`category-chip ${category === item.id ? "active" : ""}`}
                    key={item.id}
                    onClick={() => chooseCategory(item.id)}
                  >
                    {item.plural}
                  </button>
                ))}
              </div>
              <div className="list-tools">
                <label className="search-field">
                  <Search size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a note…" aria-label="Search entries" />
                  {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}
                </label>
                <button className={`sort-button ${sortNewest ? "sort-active" : ""}`} onClick={() => setSortNewest((current) => !current)} title={sortNewest ? "Sort alphabetically" : "Sort newest first"}>
                  <ArrowDownUp size={15} /><span>{sortNewest ? "Recent" : "A–Z"}</span><ChevronDown size={13} />
                </button>
              </div>
            </div>

            {!parentEntry && (
              <div className="shelf-summary">
                <span>{entryPending ? "GATHERING YOUR NOTES…" : `${visibleEntries.length} ${visibleEntries.length === 1 ? "KEEPER" : "KEEPERS"}`}</span>
                {category === "all" && <span className="summary-rule" />}
                {category === "all" && <span>WORDS, THOUGHTS & THINGS</span>}
              </div>
            )}

            {entryPending ? (
              <div className="entries-loading"><span className="loading-spinner" /> Gathering your words…</div>
            ) : visibleEntries.length > 0 ? (
              <div className="entry-grid">
                {visibleEntries.map((entry) => (
                  <EntryCard
                    entry={entry}
                    key={`${entry.entryType}-${entry.id}`}
                    onOpen={openContainer}
                    onEdit={() => setDialog({ type: "entry", entry: { ...entry, category: categoryForEntry(entry).id } })}
                    onDelete={() => handleDeleteEntry(entry)}
                  />
                ))}
                <button className="add-card" onClick={() => setDialog({ type: "entry", category: category === "all" ? "word" : category })}>
                  <span className="add-card-icon"><Plus size={18} /></span>
                  <span>Add another little discovery</span>
                </button>
              </div>
            ) : (
              <div className="empty-shelf">
                <div className="empty-shelf-icon"><Feather size={24} /></div>
                <p className="eyebrow">{search ? "NOT IN THIS CHAPTER" : "A FRESH PAGE"}</p>
                <h3>{search ? "Nothing found just yet." : `No ${category === "all" ? "discoveries" : activeCategory.plural.toLowerCase()} here.`}</h3>
                <p>{search ? "Try another word, or clear your search." : "The best collections begin with a single thing worth keeping."}</p>
                {search ? (
                  <button className="text-button" onClick={() => setSearch("")}>Clear search</button>
                ) : (
                  <button className="button button-primary" onClick={() => setDialog({ type: "entry", category: category === "all" ? "word" : category })}>
                    Save the first one <ArrowRight size={16} />
                  </button>
                )}
              </div>
            )}

            <footer className="workspace-footer">
              <span>MADE FOR THE THINGS YOU WANT TO REMEMBER</span>
              <span>THE LEXICON <span className="footer-flower">✳</span></span>
            </footer>
          </div>
        )}
      </main>

      {dialog?.type === "library" && (
        <LibraryDialog onClose={() => setDialog(null)} onSave={handleCreateLibrary} />
      )}
      {dialog?.type === "rename-library" && activeLibrary && (
        <LibraryDialog
          initialName={dialog.name}
          intent="rename"
          onClose={() => setDialog(null)}
          onSave={handleRenameLibrary}
        />
      )}
      {dialog?.type === "entry" && activeLibrary && (
        <EntryDialog
          initialCategory={dialog.category ?? "word"}
          initialEntry={dialog.entry}
          parentEntry={dialog.entry ? null : parentEntry}
          onClose={() => setDialog(null)}
          onSave={handleSaveEntry}
        />
      )}
      {toast && <div className="toast-message" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

function EntryCard({ entry, onOpen, onEdit, onDelete }) {
  const category = categoryForEntry(entry);
  const Icon = category.icon;
  const isContainer = entry.entryType === "BOOK" || entry.entryType === "COLLECTION";
  const excerpt = entry.content?.trim();

  return (
    <article
      className={`entry-card ${isContainer ? "entry-container" : ""}`}
      onClick={() => isContainer && onOpen(entry)}
      onKeyDown={(event) => {
        if (isContainer && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(entry);
        }
      }}
      tabIndex={isContainer ? 0 : undefined}
      role={isContainer ? "button" : undefined}
      aria-label={isContainer ? `Open ${entry.title}` : undefined}
    >
      <div className="entry-card-top">
        <span className={`entry-type type-${category.color}`}><Icon size={14} />{category.label}</span>
        <div className="entry-actions">
          <button
            className="entry-action"
            onClick={(event) => { event.stopPropagation(); onEdit(); }}
            aria-label={`Edit ${entry.title}`}
            title="Edit"
          >
            <Settings2 size={15} />
          </button>
          <button
            className="entry-action entry-delete"
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm(`Remove “${entry.title}” from this library?`)) onDelete();
            }}
            aria-label={`Delete ${entry.title}`}
            title="Delete"
          >
            <X size={15} />
          </button>
        </div>
      </div>
      <h3>{entry.title}</h3>
      {excerpt ? <p className="entry-excerpt">{excerpt}</p> : <p className="entry-excerpt entry-placeholder">{entry.entryType === "WORD" ? "A word worth keeping." : "A little space for your notes."}</p>}
      <div className="entry-card-bottom">
        {entry.url ? (
          <a href={entry.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            {entry.entryType === "BOOK" ? "VISIT BOOK" : "OPEN SOURCE"} <ArrowRight size={12} />
          </a>
        ) : isContainer ? (
          <span>OPEN COLLECTION <ArrowRight size={12} /></span>
        ) : (
          <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "JUST ADDED"}</span>
        )}
        {isContainer && <ChevronRight className="entry-open-chevron" size={17} />}
      </div>
    </article>
  );
}
