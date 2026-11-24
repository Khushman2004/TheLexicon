import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookMarked,
  Bell,
  Bookmark,
  Check,
  Users,
  ChevronRight,
  Compass,
  Feather,
  LogOut,
  MessageCircle,
  Menu,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ApiError, authApi, libraryApi, networkApi } from "./api.js";
import { MODEL_PAGES } from "./catalog.js";
import AuthPage from "./components/AuthPage.jsx";
import EntryDialog from "./components/EntryDialog.jsx";
import LibraryDialog from "./components/LibraryDialog.jsx";
import LibrariesPage from "./pages/LibrariesPage.jsx";
import LibraryHomePage from "./pages/LibraryHomePage.jsx";
import ModelPage from "./pages/ModelPage.jsx";
import ReadingSpacePage from "./pages/ReadingSpacePage.jsx";
import ReadingSpaceSectionPage from "./pages/ReadingSpaceSectionPage.jsx";
import PublicLibrariesPage from "./pages/PublicLibrariesPage.jsx";
import PublicLibraryPage from "./pages/PublicLibraryPage.jsx";
import NetworkPage from "./pages/NetworkPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SavedLibrariesPage from "./pages/SavedLibrariesPage.jsx";
import LibraryInvitePage from "./pages/LibraryInvitePage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import ConnectionsPage from "./pages/ConnectionsPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import CommunityPage from "./pages/CommunityPage.jsx";

const TOKEN_KEY = "the-lexicon-token";

export default function App() {
  return (
    <BrowserRouter>
      <AppSession />
    </BrowserRouter>
  );
}

function AppSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [authPending, setAuthPending] = useState(true);
  const [libraries, setLibraries] = useState([]);
  const [loadingLibraries, setLoadingLibraries] = useState(false);
  const [pageError, setPageError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const libraryId = location.pathname.match(/^\/libraries\/(\d+)/)?.[1] ?? null;
  const activeLibrary = libraries.find((library) => String(library.id) === libraryId) ?? null;

  const clearSession = useCallback((returnToCurrentRoute = true) => {
    const currentLocation = locationRef.current;
    const currentPath = `${currentLocation.pathname}${currentLocation.search}`;
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setLibraries([]);
    setPageError("");
    setDialog(null);
    navigate("/login", {
      replace: true,
      state: returnToCurrentRoute && currentPath !== "/login" ? { from: currentPath } : null,
    });
  }, [navigate]);

  useEffect(() => {
    if (!token) {
      setAuthPending(false);
      return undefined;
    }

    let active = true;
    authApi.me(token)
      .then(({ user: currentUser }) => active && setUser(currentUser))
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) clearSession();
        else setPageError(error.message);
      })
      .finally(() => active && setAuthPending(false));

    return () => { active = false; };
  }, [token, clearSession]);

  useEffect(() => {
    if (!token || !user) return undefined;
    let active = true;
    setLoadingLibraries(true);
    libraryApi.list(token)
      .then(({ libraries: result }) => {
        if (!active) return;
        setLibraries(result);
        setPageError("");
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) clearSession();
        else setPageError(error.message);
      })
      .finally(() => active && setLoadingLibraries(false));
    return () => { active = false; };
  }, [token, user, clearSession]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!token) {
      setUnreadNotifications(0);
      return undefined;
    }

    let active = true;
    const refreshUnreadCount = async () => {
      try {
        const result = await networkApi.getNotifications(token);
        if (active) setUnreadNotifications(result.unreadCount);
      } catch (error) {
        if (active) console.error("Could not refresh notification count:", error);
      }
    };

    refreshUnreadCount();
    const interval = window.setInterval(refreshUnreadCount, 30000);
    window.addEventListener("focus", refreshUnreadCount);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshUnreadCount);
    };
  }, [token, location.pathname]);

  async function handleAuthenticate(mode, details) {
    const result = mode === "register"
      ? await authApi.register(details)
      : await authApi.login(details);
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
    setPageError("");
    const returnPath = location.state?.from
      || (location.pathname !== "/" && location.pathname !== "/login"
        ? `${location.pathname}${location.search}`
        : "/libraries");
    navigate(returnPath, { replace: true });
  }

  async function handleLogout() {
    try {
      await authApi.logout(token);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) setToast(error.message);
    } finally {
      clearSession(false);
    }
  }

  async function handleCreateLibrary(name) {
    const { library } = await libraryApi.create(token, name);
    setLibraries((current) => [...current, library]);
    setDialog(null);
    navigate(`/libraries/${library.id}`);
    setToast(`“${library.name}” is ready for new discoveries.`);
  }

  async function handleRenameLibrary(name) {
    if (!activeLibrary) return;
    const { library } = await libraryApi.rename(token, activeLibrary.id, name);
    setLibraries((current) => current.map((item) => item.id === library.id ? library : item));
    setDialog(null);
    setToast("Library name updated.");
  }

  async function handleUpdateLibraryVisibility(isPublic) {
    if (!activeLibrary) return;
    const { library } = await libraryApi.updateLibrary(token, activeLibrary.id, { isPublic });
    setLibraries((current) => current.map((item) => item.id === library.id ? library : item));
    setToast(isPublic ? "Library shared with signed-in readers." : "Library made private.");
  }

  async function handleUpdateModelVisibility(modelKey, isPublic) {
    if (!activeLibrary) throw new Error("Choose a library before changing model visibility.");
    const model = await libraryApi.updateModelVisibility(token, activeLibrary.id, modelKey, isPublic);
    setToast(isPublic ? "Model shared with signed-in readers." : "Model made private.");
    return model;
  }

  async function handleSaveEntry(entryCategory, body) {
    if (!activeLibrary) throw new Error("Choose a library before saving an entry.");
    if (dialog?.entry) {
      await libraryApi.updateEntry(token, activeLibrary.id, entryCategory, dialog.entry.id, body);
      setToast("Your changes have been saved.");
    } else {
      await libraryApi.createEntry(token, activeLibrary.id, entryCategory, body);
      setToast(`${entryCategory.replace("-", " ")} added.`);
    }
    setDialog(null);
    setRefreshKey((current) => current + 1);
  }

  async function handleDeleteEntry(entry) {
    if (!activeLibrary) return;
    try {
      await libraryApi.deleteEntry(token, activeLibrary.id, entry.category, entry.id);
      setToast("Entry removed from your library.");
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setToast(error.message);
    }
  }

  if (authPending) {
    return <div className="loading-screen"><div className="loading-mark"><Feather size={22} /></div><span>Opening your little corner…</span></div>;
  }
  if (!token || !user) return <AuthPage onAuthenticate={handleAuthenticate} />;

  const firstName = user.fullName?.trim().split(/\s+/)[0] || user.username;

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark"><Feather size={19} /></div>
          <div><span>the lexicon</span><small>A HOME FOR IDEAS</small></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <div className="library-section">
          <div className="sidebar-label-row">
            <span className="sidebar-label">YOUR LIBRARIES</span>
            <button className="sidebar-add" onClick={() => setDialog({ type: "library" })} aria-label="Create a library"><Plus size={15} /></button>
          </div>
          <Link className={`category-nav-item discover-nav-item ${location.pathname.startsWith("/discover") ? "selected" : ""}`} to="/discover" onClick={() => setMobileNavOpen(false)}>
            <Compass size={16} strokeWidth={1.8} /><span>Discover public</span><ChevronRight className="nav-chevron" size={14} />
          </Link>
          <nav className="social-nav" aria-label="Your network">
            <Link className={`category-nav-item ${location.pathname === "/network" ? "selected" : ""}`} to="/network" onClick={() => setMobileNavOpen(false)}><Users size={16} /><span>People & libraries</span></Link>
            <Link className={`category-nav-item ${location.pathname.startsWith("/community") ? "selected" : ""}`} to="/community" onClick={() => setMobileNavOpen(false)}><Users size={16} /><span>Community</span></Link>
            <Link className={`category-nav-item ${location.pathname === "/saved" ? "selected" : ""}`} to="/saved" onClick={() => setMobileNavOpen(false)}><Bookmark size={16} /><span>Saved shelves</span></Link>
            <Link className={`category-nav-item ${location.pathname.startsWith("/messages") ? "selected" : ""}`} to="/messages" onClick={() => setMobileNavOpen(false)}><MessageCircle size={16} /><span>Messages</span></Link>
            <Link className={`category-nav-item notification-nav-item ${location.pathname.startsWith("/notifications") ? "selected" : ""}`} to="/notifications" onClick={() => setMobileNavOpen(false)}>
              <Bell size={16} /><span>Notifications</span>
              {unreadNotifications > 0 && <span className="notification-badge">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
            </Link>
            <Link className={`category-nav-item ${location.pathname.startsWith("/profile") ? "selected" : ""}`} to="/profile" onClick={() => setMobileNavOpen(false)}><UserRound size={16} /><span>Your profile</span></Link>
          </nav>
          <div className="library-list">
            {libraries.map((library, index) => (
              <Link
                className={`library-nav-item ${activeLibrary?.id === library.id ? "selected" : ""}`}
                key={library.id}
                to={`/libraries/${library.id}`}
                onClick={() => setMobileNavOpen(false)}
              >
                <span className={`library-bookmark bookmark-${index % 4}`}><BookMarked size={15} /></span>
                <span className="library-nav-name">{library.name}</span>
                {activeLibrary?.id === library.id && <span className="nav-active-dot" />}
              </Link>
            ))}
            {!loadingLibraries && libraries.length === 0 && (
              <button className="empty-library-link" onClick={() => setDialog({ type: "library" })}>
                <Plus size={15} /> Create your first library
              </button>
            )}
          </div>
          <button className="new-library-button" onClick={() => setDialog({ type: "library" })}>
            <Plus size={15} /> New library
          </button>
        </div>

        {activeLibrary && (
          <div className="sidebar-section model-sidebar-section">
            <span className="sidebar-label">YOUR FIVE MODELS</span>
            <nav className="category-nav" aria-label="Library models">
              {MODEL_PAGES.map((model) => {
                const Icon = model.icon;
                return (
                  <Link
                    className={`category-nav-item ${location.pathname.includes(`/libraries/${activeLibrary.id}/${model.id}`) ? "selected" : ""}`}
                    key={model.id}
                    to={`/libraries/${activeLibrary.id}/${model.id}`}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Icon size={16} strokeWidth={1.8} />
                    <span>{model.label}</span>
                    <ChevronRight className="nav-chevron" size={14} />
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <div className="sidebar-quote">
          <span className="quote-mark">“</span>
          <p>Find the words, and the world opens.</p>
          <span className="quote-attribution">A NOTE TO YOURSELF</span>
        </div>

        <div className="sidebar-user">
          <div className="avatar">{(firstName[0] ?? "L").toUpperCase()}</div>
          <div className="user-copy"><strong>{firstName}</strong><span>Curious by nature</span></div>
          <button className="sign-out-button" onClick={handleLogout}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumb">
            <Link to="/libraries">MY SPACE</Link><ChevronRight size={13} />
            <strong>{activeLibrary?.name ?? (location.pathname.startsWith("/community") ? "Community" : location.pathname.startsWith("/discover") ? "Discover" : "Your libraries")}</strong>
          </div>
          <div className="topbar-right">
            <span className="date-display">{new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span>
            <span className="topbar-divider" />
            <div className="topbar-avatar">{(firstName[0] ?? "L").toUpperCase()}</div>
            <button className="topbar-sign-out" onClick={handleLogout}><LogOut size={15} /> Sign out</button>
          </div>
        </header>

        {pageError && (
          <div className="page-alert" role="alert">
            <span>{pageError}</span>
            <button onClick={() => setRefreshKey((current) => current + 1)}>Try again</button>
          </div>
        )}

        <Routes>
          <Route path="/libraries" element={<LibrariesPage libraries={libraries} loading={loadingLibraries} onCreate={() => setDialog({ type: "library" })} />} />
          <Route path="/community" element={<CommunityPage token={token} currentUser={user} />} />
          <Route path="/community/:communityId" element={<CommunityPage token={token} currentUser={user} />} />
          <Route path="/network" element={<NetworkPage token={token} />} />
          <Route path="/notifications" element={<NotificationsPage token={token} onUnreadCountChange={setUnreadNotifications} />} />
          <Route path="/saved" element={<SavedLibrariesPage token={token} />} />
          <Route path="/profile" element={<ProfilePage token={token} currentUserId={user.id} onProfileUpdated={(profile) => setUser((current) => ({ ...current, ...profile }))} />} />
          <Route path="/profiles/:userId" element={<ProfilePage token={token} currentUserId={user.id} onProfileUpdated={(profile) => setUser((current) => ({ ...current, ...profile }))} />} />
          <Route path="/connections/:userId/:direction" element={<ConnectionsPage token={token} currentUserId={user.id} />} />
          <Route path="/share/:shareToken" element={<LibraryInvitePage token={token} />} />
          <Route path="/messages/new/:recipientId" element={<ChatPage token={token} currentUserId={user.id} />} />
          <Route path="/messages/:conversationId?" element={<ChatPage token={token} currentUserId={user.id} />} />
          <Route path="/discover" element={<PublicLibrariesPage token={token} />} />
          <Route path="/discover/:libraryId/:modelKey?" element={<PublicLibraryPage token={token} />} />
          <Route path="/shared/:libraryId/:modelKey?" element={<PublicLibraryPage token={token} accessType="shared" />} />
          <Route path="/libraries/:libraryId" element={activeLibrary ? (
            <LibraryHomePage
              token={token}
              library={activeLibrary}
              onRename={() => setDialog({ type: "rename-library", name: activeLibrary.name })}
              onUpdateLibraryVisibility={handleUpdateLibraryVisibility}
              onUpdateModelVisibility={handleUpdateModelVisibility}
            />
          ) : <PageLoading loading={loadingLibraries} />} />
          <Route
            path="/libraries/:libraryId/:modelId/:typeRoute?"
            element={activeLibrary ? (
              <ModelPage
                token={token}
                library={activeLibrary}
                refreshKey={refreshKey}
                onAdd={(category, allowedCategories) => setDialog({ type: "entry", category, allowedCategories })}
                onEdit={(entry) => setDialog({ type: "entry", category: entry.category, entry })}
                onDelete={handleDeleteEntry}
              />
            ) : <PageLoading loading={loadingLibraries} />}
          />
          <Route
            path="/libraries/:libraryId/reading-spaces/:spaceId/sections/:sectionId"
            element={activeLibrary ? (
              <ReadingSpaceSectionPage
                token={token}
                library={activeLibrary}
                refreshKey={refreshKey}
                onAdd={(category, parentEntry, allowedCategories) => setDialog({ type: "entry", category, parentEntry, allowedCategories })}
                onEdit={(entry) => setDialog({ type: "entry", category: entry.category, entry })}
                onDelete={handleDeleteEntry}
              />
            ) : <PageLoading loading={loadingLibraries} />}
          />
          <Route
            path="/libraries/:libraryId/reading-spaces/:spaceId/details"
            element={activeLibrary ? <ReadingSpacePage token={token} library={activeLibrary} /> : <PageLoading loading={loadingLibraries} />}
          />
          <Route path="*" element={<Navigate to="/libraries" replace />} />
        </Routes>
      </main>

      {dialog?.type === "library" && (
        <LibraryDialog onClose={() => setDialog(null)} onSave={handleCreateLibrary} />
      )}
      {dialog?.type === "rename-library" && activeLibrary && (
        <LibraryDialog initialName={dialog.name} intent="rename" onClose={() => setDialog(null)} onSave={handleRenameLibrary} />
      )}
      {dialog?.type === "entry" && activeLibrary && (
        <EntryDialog
          key={`${dialog.entry?.id ?? "new"}-${dialog.category}`}
          initialCategory={dialog.category ?? "word"}
          initialEntry={dialog.entry}
          parentEntry={dialog.parentEntry ?? null}
          allowedCategories={dialog.allowedCategories}
          onClose={() => setDialog(null)}
          onSave={handleSaveEntry}
        />
      )}
      {toast && <div className="toast-message" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

function PageLoading({ loading }) {
  return <div className="page-loading">{loading ? "Opening your library…" : "This library is not available."}</div>;
}
