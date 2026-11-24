import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Users, Plus, Search, Megaphone, MessageCircle, Library, Send, Copy, Shield, UserRound, Bell, BellOff, LogOut, Trash2 } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { communityApi, getChatSocketUrl, libraryApi } from "../api.js";
import { ENTRY_TYPES, MODEL_PAGES, categoryForEntry, entryTypeForCategory } from "../catalog.js";
import EntryDialog from "../components/EntryDialog.jsx";
import { EmptyPage, PageLoading, PageTitle, WorkspaceEntryCard } from "./WorkspaceComponents.jsx";

export default function CommunityPage({ token, currentUser }) {
  const { communityId } = useParams();
  if (!communityId) return <CommunityLanding token={token} />;
  const parsedCommunityId = Number(communityId);
  if (!Number.isSafeInteger(parsedCommunityId) || parsedCommunityId < 1) {
    return <Navigate to="/community" replace />;
  }
  return <CommunityDashboard token={token} communityId={parsedCommunityId} currentUser={currentUser} />;
}

function CommunityLanding({ token }) {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState([]);
  const [publicCommunities, setPublicCommunities] = useState([]);
  const [mode, setMode] = useState("");
  const [code, setCode] = useState("");
  const [form, setForm] = useState({ name: "", genre: "", description: "", privacy: "PUBLIC" });
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const [communityActionPending, setCommunityActionPending] = useState(null);

  async function refresh() {
    setPending(true);
    try {
      const [mine, publicList] = await Promise.all([
        communityApi.list(token),
        communityApi.listPublic(token),
      ]);
      setCommunities(mine);
      setPublicCommunities(publicList);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => { refresh(); }, [token]);

  async function createCommunity(event) {
    event.preventDefault();
    try {
      const community = await communityApi.create(token, form);
      navigate(`/community/${community.id}`);
    } catch (requestError) { setError(requestError.message); }
  }

  async function joinCommunity(id) {
    try {
      const community = await communityApi.join(token, id);
      navigate(`/community/${community.id}`);
    } catch (requestError) { setError(requestError.message); }
  }

  async function joinByCode(event) {
    event.preventDefault();
    try {
      const community = await communityApi.joinByCode(token, code);
      navigate(`/community/${community.id}`);
    } catch (requestError) { setError(requestError.message); }
  }

  async function toggleCommunityNotifications(community) {
    setCommunityActionPending(community.id);
    setError("");
    try {
      const settings = await communityApi.updateNotificationSettings(
        token,
        community.id,
        !community.notificationsMuted,
      );
      setCommunities((current) => current.map((item) => item.id === community.id
        ? { ...item, notificationsMuted: settings.isMuted }
        : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCommunityActionPending(null);
    }
  }

  async function leaveCommunity(community) {
    if (!window.confirm(`Leave ${community.name}?`)) return;
    setCommunityActionPending(community.id);
    setError("");
    try {
      await communityApi.leave(token, community.id);
      setCommunities((current) => current.filter((item) => item.id !== community.id));
      setPublicCommunities((current) => current.map((item) => item.id === community.id
        ? { ...item, isMember: false }
        : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCommunityActionPending(null);
    }
  }

  async function deleteCommunity(community) {
    if (!window.confirm(`Delete "${community.name}" and all of its content? This cannot be undone.`)) return;
    setCommunityActionPending(community.id);
    setError("");
    try {
      await communityApi.delete(token, community.id);
      setCommunities((current) => current.filter((item) => item.id !== community.id));
      setPublicCommunities((current) => current.filter((item) => item.id !== community.id));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCommunityActionPending(null);
    }
  }

  return (
    <div className="workspace page-workspace">
      <PageTitle eyebrow="THE COMMUNITY" title="Communities" description="Learn together, share discoveries, and build libraries with other readers." />
      {error && <div className="page-alert" role="alert">{error}</div>}
      <div className="community-actions">
        <button className="model-card" onClick={() => setMode(mode === "join" ? "" : "join")}><Search size={22} /><strong>Join a community</strong><span>Discover public communities or use an invitation code.</span></button>
        <button className="model-card" onClick={() => setMode(mode === "create" ? "" : "create")}><Plus size={22} /><strong>Create a community</strong><span>Start a new place for people and shared ideas.</span></button>
      </div>

      {mode === "create" && (
        <form className="community-panel community-create-form" onSubmit={createCommunity}>
          <h2>Create a community</h2>
          <div className="community-form-grid">
            <label>Community name<input value={form.name} maxLength={100} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Genre / category<input value={form.genre} maxLength={100} onChange={(event) => setForm({ ...form, genre: event.target.value })} required /></label>
            <label className="community-wide">Description<textarea value={form.description} maxLength={1000} rows={3} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          </div>
          <div className="community-privacy-row">
            <div>
              <strong>Community visibility</strong>
              <span>{form.privacy === "PUBLIC" ? "Public communities can be discovered by everyone." : "Private communities can only be joined with an invitation."}</span>
            </div>
            <button
              className={`community-privacy-toggle ${form.privacy === "PUBLIC" ? "is-public" : ""}`}
              type="button"
              role="switch"
              aria-checked={form.privacy === "PUBLIC"}
              aria-label={`Community is ${form.privacy.toLowerCase()}. Switch to ${form.privacy === "PUBLIC" ? "private" : "public"}.`}
              onClick={() => setForm({ ...form, privacy: form.privacy === "PUBLIC" ? "PRIVATE" : "PUBLIC" })}
            >
              <span className="community-privacy-thumb" />
              <span>{form.privacy === "PUBLIC" ? "Public" : "Private"}</span>
            </button>
          </div>
          <button className="button button-primary" type="submit">Create community</button>
        </form>
      )}

      {mode === "join" && (
        <section className="community-panel">
          <h2>Join a community</h2>
          <form className="community-code-row" onSubmit={joinByCode}>
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Invitation code" />
            <button className="button button-primary" type="submit">Join with code</button>
          </form>
          <div className="community-discover-list">
            {publicCommunities.map((community) => (
              <article className="community-row" key={community.id}>
                <div><strong>{community.name}</strong><span>{community.genre} · {community.memberCount} members</span><p>{community.description || "A community for shared discoveries."}</p></div>
                <button className="button" disabled={community.isMember} onClick={() => community.isMember ? navigate(`/community/${community.id}`) : joinCommunity(community.id)}>
                  {community.isMember ? "Open" : "Join"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="community-mine">
        <h2>Your communities</h2>
        {pending ? <PageLoading /> : communities.length ? (
          <div className="community-card-grid">
            {communities.map((community) => (
              <article className="model-card community-card" key={community.id}>
                <button className="community-card-open" onClick={() => navigate(`/community/${community.id}`)}>
                  <Users size={22} /><span className="eyebrow">{community.genre}</span><strong>{community.name}</strong>
                  <span>{community.memberCount} members · {community.membershipRole}</span>
                </button>
                <div className="community-card-actions">
                  <button
                    className="button button-outline"
                    disabled={communityActionPending === community.id}
                    onClick={() => toggleCommunityNotifications(community)}
                  >
                    {community.notificationsMuted ? <Bell size={13} /> : <BellOff size={13} />}
                    {community.notificationsMuted ? "Unmute" : "Mute"}
                  </button>
                  {community.membershipRole === "OWNER"
                    ? <button className="button button-danger" disabled={communityActionPending === community.id} onClick={() => deleteCommunity(community)}><Trash2 size={13} />Delete</button>
                    : <button className="button-danger" disabled={communityActionPending === community.id} onClick={() => leaveCommunity(community)}><LogOut size={13} />Leave</button>}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="community-empty">You have not joined a community yet.</p>}
      </section>
    </div>
  );
}

function CommunityDashboard({ token, communityId, currentUser }) {
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [tab, setTab] = useState("announcements");
  const [announcements, setAnnouncements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [draft, setDraft] = useState("");
  const [announcementDraft, setAnnouncementDraft] = useState({ title: "", body: "" });
  const [activeLibraryId, setActiveLibraryId] = useState(null);
  const [selectedEntryType, setSelectedEntryType] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entryDialog, setEntryDialog] = useState(null);
  const [entrySearch, setEntrySearch] = useState("");
  const [sortEntriesNewest, setSortEntriesNewest] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [deletingEntryId, setDeletingEntryId] = useState(null);
  const [error, setError] = useState("");
  const [chatStatus, setChatStatus] = useState("connecting");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const [savingNotificationSetting, setSavingNotificationSetting] = useState(false);
  const [communityActionPending, setCommunityActionPending] = useState(false);
  const socketRef = useRef(null);
  const messageEndRef = useRef(null);

  const canManage = community?.membershipRole === "OWNER" || community?.membershipRole === "ADMIN";
  const canAdmin = community?.membershipRole === "OWNER";
  const activeLibrary = libraries.find((library) => library.id === activeLibraryId
    && MODEL_PAGES.some((model) => model.id === library.modelKey)) ?? null;
  const activeModel = MODEL_PAGES.find((model) => model.id === activeLibrary?.modelKey) ?? null;
  const activeEntryTypes = activeModel
    ? activeModel.types.map((typeId) => entryTypeForCategory(typeId)).filter(Boolean)
    : activeLibrary ? ENTRY_TYPES : [];
  const searchQuery = entrySearch.trim().toLocaleLowerCase();
  const visibleEntries = entries
    .filter((entry) => (!selectedEntryType || entry.entryType === entryTypeForCategory(selectedEntryType)?.entryType)
      && (!searchQuery
        || entry.title.toLocaleLowerCase().includes(searchQuery)
        || (entry.content ?? "").toLocaleLowerCase().includes(searchQuery)))
    .sort((first, second) => sortEntriesNewest
      ? new Date(second.createdAt) - new Date(first.createdAt)
      : first.title.localeCompare(second.title));

  async function refresh() {
    setLoadingCommunity(true);
    setError("");
    try {
      const [detail, announcementList, libraryList, memberList, notificationSettings] = await Promise.all([
        communityApi.get(token, communityId),
        communityApi.listAnnouncements(token, communityId),
        libraryApi.listCommunityLibraries(token, communityId),
        communityApi.listMembers(token, communityId),
        communityApi.getNotificationSettings(token, communityId),
      ]);
      setCommunity(detail);
      setAnnouncements(announcementList);
      setLibraries(libraryList);
      setMembers(memberList);
      setNotificationsMuted(notificationSettings.isMuted);
      setError("");
      const defaultLibrary = libraryList.find((library) => library.modelKey === MODEL_PAGES[0].id);
      if (defaultLibrary && !activeLibraryId) setActiveLibraryId(defaultLibrary.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingCommunity(false);
    }
  }

  useEffect(() => { refresh(); communityApi.listMessages(token, communityId).then(setMessages).catch((error) => setError(error.message)); }, [token, communityId]);

  useEffect(() => {
    if (!activeLibraryId) {
      setEntries([]);
      return undefined;
    }
    let active = true;
    setLoadingEntries(true);
    setError("");
    libraryApi.listCommunityEntries(token, communityId, activeLibraryId)
      .then((result) => active && setEntries(result))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoadingEntries(false));
    return () => { active = false; };
  }, [token, communityId, activeLibraryId]);

  useEffect(() => {
    const socket = io(getChatSocketUrl(), { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      setChatStatus("connected");
      socket.emit("joinCommunity", { communityId }, (result) => {
        if (!result?.ok) setError(result?.error || "Could not join this community chat.");
      });
    });
    socket.on("disconnect", () => setChatStatus("reconnecting"));
    socket.on("connect_error", (socketError) => {
      setChatStatus("reconnecting");
      setError(socketError.message || "Community chat connection lost.");
    });
    socket.on("newCommunityMessage", (message) => {
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    });
    return () => socket.disconnect();
  }, [token, communityId]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim() || sendingMessage) return;
    if (!socketRef.current?.connected) {
      setError("Chat is reconnecting. Your message has not been sent.");
      return;
    }
    setSendingMessage(true);
    setError("");
    socketRef.current?.emit("sendCommunityMessage", { communityId, body: draft.trim() }, (result) => {
      if (!result?.ok) setError(result?.error || "Message could not be sent.");
      else setDraft("");
      setSendingMessage(false);
    });
  }

  async function createAnnouncement(event) {
    event.preventDefault();
    try {
      const item = await communityApi.createAnnouncement(token, communityId, announcementDraft);
      setAnnouncements((current) => [item, ...current]);
      setAnnouncementDraft({ title: "", body: "" });
    } catch (requestError) { setError(requestError.message); }
  }

  async function saveCommunityEntry(category, details) {
    if (!activeLibraryId) throw new Error("Choose a shared model before adding an entry.");
    const type = entryTypeForCategory(category);
    if (!type) throw new Error("Choose a valid entry type.");
    if (entryDialog?.entry) {
      const updated = await libraryApi.updateCommunityEntry(
        token,
        communityId,
        activeLibraryId,
        entryDialog.entry.id,
        details,
      );
      setEntries((current) => current.map((entry) => entry.id === updated.id ? { ...entry, ...updated } : entry));
    } else {
      const created = await libraryApi.createCommunityEntry(token, communityId, activeLibraryId, {
        ...details,
        entryType: type.entryType,
      });
      setEntries((current) => [created, ...current]);
      setLibraries((current) => current.map((library) => library.id === activeLibraryId
        ? { ...library, entryCount: library.entryCount + 1 }
        : library));
    }
  }

  async function deleteCommunityEntry(entry) {
    setDeletingEntryId(entry.id);
    setError("");
    try {
      await libraryApi.deleteCommunityEntry(token, communityId, activeLibraryId, entry.id);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setLibraries((current) => current.map((library) => library.id === activeLibraryId
        ? { ...library, entryCount: Math.max(0, library.entryCount - 1) }
        : library));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingEntryId(null);
    }
  }

  async function removeCommunityMember(member) {
    if (!window.confirm(`Remove ${member.fullName || member.username} from ${community.name}?`)) return;
    setRemovingMemberId(member.id);
    setError("");
    try {
      await communityApi.removeMember(token, communityId, member.id);
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setCommunity((current) => ({ ...current, memberCount: Math.max(1, current.memberCount - 1) }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function createInvite() {
    try {
      const result = await communityApi.createInvite(token, communityId);
      setInvites((current) => [result.invite, ...current]);
      await navigator.clipboard?.writeText(result.code);
      setError("");
    } catch (requestError) { setError(requestError.message); }
  }

  async function toggleNotifications() {
    setSavingNotificationSetting(true);
    setError("");
    try {
      const settings = await communityApi.updateNotificationSettings(token, communityId, !notificationsMuted);
      setNotificationsMuted(settings.isMuted);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingNotificationSetting(false);
    }
  }

  async function leaveCommunity() {
    if (!window.confirm(`Leave ${community.name}? You will need an invitation to rejoin if it is private.`)) return;
    setCommunityActionPending(true);
    setError("");
    try {
      await communityApi.leave(token, communityId);
      navigate("/community");
    } catch (requestError) {
      setError(requestError.message);
      setCommunityActionPending(false);
    }
  }

  async function deleteCommunity() {
    if (!window.confirm(`Delete "${community.name}" and all of its content? This cannot be undone.`)) return;
    setCommunityActionPending(true);
    setError("");
    try {
      await communityApi.delete(token, communityId);
      navigate("/community");
    } catch (requestError) {
      setError(requestError.message);
      setCommunityActionPending(false);
    }
  }

  if (!community && loadingCommunity) return <PageLoading />;
  if (!community) {
    return (
      <div className="workspace page-workspace">
        <PageTitle eyebrow="THE COMMUNITY" title="Community unavailable" description="This community could not be opened. It may have been deleted, or your membership may have changed." />
        {error && <div className="page-alert" role="alert">{error}</div>}
        <div className="community-unavailable-actions">
          <button className="button button-primary" onClick={refresh}>Try again</button>
          <Link className="button button-outline" to="/community">Your communities</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="workspace page-workspace community-dashboard">
      <PageTitle eyebrow={community.genre} title={community.name} description={community.description || "A shared community for ideas and collaboration."} />
      {error && <div className="page-alert" role="alert">{error}</div>}
      <div className="community-toolbar">
        <div className="community-stats"><span><Users size={15} /> {community.memberCount} members</span><span><Shield size={15} /> {community.membershipRole}</span></div>
        <div className="community-dashboard-actions">
          <button className="button button-outline" type="button" disabled={savingNotificationSetting} onClick={toggleNotifications}>
            {notificationsMuted ? <BellOff size={14} /> : <Bell size={14} />}
            {notificationsMuted ? "Unmute notifications" : "Mute notifications"}
          </button>
          {canAdmin
            ? <button className="button button-danger" type="button" disabled={communityActionPending} onClick={deleteCommunity}><Trash2 size={14} />Delete community</button>
            : <button className="button-danger" type="button" disabled={communityActionPending} onClick={leaveCommunity}><LogOut size={14} />Leave community</button>}
        </div>
      </div>
      <nav className="community-tabs">
        <button className={tab === "announcements" ? "selected" : ""} onClick={() => setTab("announcements")}><Megaphone size={15} />Announcements</button>
        <button className={tab === "chat" ? "selected" : ""} onClick={() => setTab("chat")}><MessageCircle size={15} />General chat</button>
        <button className={tab === "libraries" ? "selected" : ""} onClick={() => setTab("libraries")}><Library size={15} />Shared libraries</button>
        {canManage && <button className={tab === "members" ? "selected" : ""} onClick={() => setTab("members")}><Users size={15} />Members & invites</button>}
      </nav>

      {tab === "announcements" && (
        <section className="community-section">
          {canManage && <form className="community-inline-form" onSubmit={createAnnouncement}><input placeholder="Announcement title" value={announcementDraft.title} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, title: event.target.value })} required /><textarea placeholder="Write an update…" value={announcementDraft.body} rows={3} onChange={(event) => setAnnouncementDraft({ ...announcementDraft, body: event.target.value })} required /><button className="button button-primary">Post announcement</button></form>}
          {announcements.map((item) => <article className="announcement-card" key={item.id}><h3>{item.title}</h3><p>{item.body}</p><small>{item.authorName || item.authorUsername} · {new Date(item.createdAt).toLocaleString()}</small></article>)}
          {!announcements.length && <p className="community-empty">No announcements yet.</p>}
        </section>
      )}

      {tab === "chat" && (
        <section className="chat-thread community-chat">
          <header className="chat-thread-header community-chat-header">
            <span className="mini-avatar community-chat-avatar"><Users size={17} /></span>
            <div><strong>General chat</strong><span>Everyone in {community.name}</span></div>
            <span className={`presence-dot ${chatStatus}`} />
          </header>
          <div className="chat-messages community-messages" aria-live="polite">
            {messages.length ? messages.map((message) => {
              const isMine = message.senderId === currentUser.id;
              return (
                <div className={`community-message-row ${isMine ? "mine" : ""}`} key={message.id}>
                  <span className="mini-avatar community-message-avatar">
                    {message.senderAvatarUrl
                      ? <img src={message.senderAvatarUrl} alt="" />
                      : <UserRound size={15} />}
                  </span>
                  <article className={`chat-bubble ${isMine ? "mine" : ""}`}>
                    <strong className="community-message-sender">{isMine ? "You" : message.senderName || message.senderUsername}</strong>
                    <p>{message.body}</p>
                    <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                  </article>
                </div>
              );
            }) : <div className="community-chat-empty"><MessageCircle size={22} /><span>No messages yet. Start the conversation.</span></div>}
            <div ref={messageEndRef} />
          </div>
          <form className="chat-compose" onSubmit={sendMessage}>
            <textarea value={draft} maxLength={4000} rows={2} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" aria-label="Message" />
            <button className="button button-primary" disabled={!draft.trim() || sendingMessage || chatStatus !== "connected"}><Send size={15} />{sendingMessage ? "Sending…" : "Send"}</button>
          </form>
        </section>
      )}

      {tab === "libraries" && (
        <section className="community-library-workspace">
          <div className="model-card-grid community-model-grid">
            {MODEL_PAGES.map((model) => {
              const modelLibrary = libraries.find((library) => library.modelKey === model.id);
              const Icon = model.icon;
              if (!modelLibrary) return null;
              return (
                <button
                  className={`model-card community-model-card ${activeLibraryId === modelLibrary.id ? "selected" : ""}`}
                  type="button"
                  key={model.id}
                  aria-pressed={activeLibraryId === modelLibrary.id}
                  onClick={() => {
                    setActiveLibraryId(modelLibrary.id);
                    setSelectedEntryType(null);
                    setEntrySearch("");
                  }}
                >
                  <span className="model-card-icon"><Icon size={22} /></span>
                  <strong>{model.label}</strong>
                  <span className="model-card-description">{model.description}</span>
                  <span className="community-model-count">{modelLibrary.entryCount} {modelLibrary.entryCount === 1 ? "entry" : "entries"}</span>
                </button>
              );
            })}
          </div>

          {activeLibrary && (
            <section className="community-selected-library">
              <header className="community-selected-library-header">
                <div>
                  <p className="eyebrow">{activeModel?.label ?? "EXISTING SHARED LIBRARY"}</p>
                  <h2>{activeModel?.label ?? activeLibrary.name}</h2>
                  <p>{activeModel?.description ?? activeLibrary.description ?? "Add entries for everyone in this community to discover."}</p>
                </div>
              </header>
              <div className="model-toolbar">
                <nav className="model-tabs" aria-label={`${activeModel?.label ?? activeLibrary.name} entry types`}>
                  <button
                    className={`model-tab ${selectedEntryType === null ? "active" : ""}`}
                    type="button"
                    onClick={() => setSelectedEntryType(null)}
                  >
                    All
                  </button>
                  {activeEntryTypes.map((type) => (
                    <button
                      className={`model-tab ${selectedEntryType === type.id ? "active" : ""}`}
                      type="button"
                      key={type.id}
                      onClick={() => setSelectedEntryType(type.id)}
                    >
                      {type.plural}
                    </button>
                  ))}
                </nav>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => setEntryDialog({ initialCategory: selectedEntryType ?? activeEntryTypes[0]?.id ?? "word" })}
                >
                  <Plus size={16} /> Add {entryTypeForCategory(selectedEntryType ?? activeEntryTypes[0]?.id)?.label.toLowerCase() ?? "entry"}
                </button>
              </div>
              <div className="page-list-tools">
                <label className="search-field">
                  <Search size={16} />
                  <input value={entrySearch} onChange={(event) => setEntrySearch(event.target.value)} placeholder="Search shared entries…" aria-label="Search shared entries" />
                </label>
                <button className={`sort-button ${sortEntriesNewest ? "sort-active" : ""}`} onClick={() => setSortEntriesNewest((current) => !current)}>
                  {sortEntriesNewest ? "Newest first" : "Alphabetical"}
                </button>
              </div>
              {loadingEntries ? <PageLoading /> : visibleEntries.length ? (
                <div className="entry-grid">
                  {visibleEntries.map((entry) => {
                    const category = categoryForEntry(entry);
                    const isContributor = String(entry.contributorId) === String(currentUser?.id);
                    const canEditEntry = canManage || isContributor;
                    const canDeleteEntry = canAdmin || isContributor;
                    return (
                      <WorkspaceEntryCard
                        key={`${entry.entryType}-${entry.id}`}
                        entry={entry}
                        category={category}
                        attribution={`Added by ${entry.contributorName || entry.contributorUsername || "a community member"}`}
                        onEdit={canEditEntry
                          ? () => setEntryDialog({ entry: { ...entry, category: category.id } })
                          : undefined}
                        onDelete={canDeleteEntry ? () => deleteCommunityEntry(entry) : undefined}
                        deleting={deletingEntryId === entry.id}
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyPage
                  title={entrySearch ? "No matching entries." : "No shared entries yet."}
                  description="Add an entry to make it available to everyone in this community."
                />
              )}
            </section>
          )}
        </section>
      )}

      {tab === "members" && (
        <section className="community-section">
          <div className="community-member-actions"><button className="button" onClick={async () => setInvites(await communityApi.listInvites(token, communityId))}>Load invitations</button><button className="button button-primary" onClick={createInvite}><Copy size={14} />Generate & copy code</button></div>
          {invites.map((invite) => <p className="community-invite" key={invite.id}>{invite.codePrefix ? `Invitation ${invite.codePrefix}…` : "Invitation"} · {invite.revokedAt ? "Revoked" : invite.usedAt ? "Used" : "Active"}{!invite.revokedAt && <button onClick={async () => await communityApi.revokeInvite(token, communityId, invite.id)}>Revoke</button>}</p>)}
          {members.map((member) => (
            <article className="community-member" key={member.id}>
              <div><strong>{member.fullName || member.username}</strong><small>@{member.username}</small></div>
              {canAdmin && member.role !== "OWNER" && (
                <CommunityRolePicker
                  value={member.role}
                  onChange={async (role) => {
                    try {
                      await communityApi.updateMemberRole(token, communityId, member.id, role);
                      await refresh();
                    } catch (requestError) {
                      setError(requestError.message);
                    }
                  }}
                />
              )}
              {canAdmin && member.role !== "OWNER" && (
                <button
                  className="button button-danger"
                  type="button"
                  disabled={removingMemberId === member.id}
                  onClick={() => removeCommunityMember(member)}
                >
                  <Trash2 size={14} />{removingMemberId === member.id ? "Removing…" : "Remove member"}
                </button>
              )}
            </article>
          ))}
        </section>
      )}
      {entryDialog && activeLibrary && (
        <EntryDialog
          initialCategory={entryDialog.entry?.category ?? entryDialog.initialCategory}
          initialEntry={entryDialog.entry}
          allowedCategories={activeEntryTypes.map((type) => type.id)}
          onClose={() => setEntryDialog(null)}
          onSave={saveCommunityEntry}
          saveLabel="Add to community library"
        />
      )}
    </div>
  );
}

function CommunityRolePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event) {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function selectRole(role) {
    if (role === value || saving) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onChange(role);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="community-role-picker" ref={pickerRef}>
      <button
        className={`community-role-trigger ${open ? "open" : ""}`}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={saving}
        onClick={() => setOpen((current) => !current)}
      >
        {value === "ADMIN" ? "Admin" : "Member"}
        <span className={`community-role-chevron ${open ? "open" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="community-role-options" role="listbox" aria-label="Community role">
          {["MEMBER", "ADMIN"].map((role) => (
            <button
              className={`community-role-option ${role === value ? "selected" : ""}`}
              type="button"
              role="option"
              aria-selected={role === value}
              key={role}
              onClick={() => selectRole(role)}
            >
              {role === "ADMIN" ? "Admin" : "Member"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
