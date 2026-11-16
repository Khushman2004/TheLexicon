import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { ArrowRight, Bookmark, MessageCircle, Save, Shield, UserRound, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getChatSocketUrl, networkApi } from "../api.js";
import { EmptyPage, PageTitle } from "./WorkspaceComponents.jsx";

export default function ProfilePage({ token, currentUserId, onProfileUpdated }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isSelf = !userId || String(currentUserId) === userId;
  const [profile, setProfile] = useState(null);
  const [libraries, setLibraries] = useState([]);
  const [form, setForm] = useState({ fullName: "", bio: "", avatarUrl: "", isPublic: true });
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    const request = isSelf
      ? networkApi.getMyProfile(token).then(async ({ profile: result }) => ({
        profile: result,
        libraries: await networkApi.discoverLibraries(token, result.id),
      }))
      : networkApi.getUser(token, userId);
    request
      .then((result) => {
        if (!active) return;
        setProfile(result.profile);
        setLibraries(result.libraries ?? []);
        setForm({
          fullName: result.profile.fullName ?? "",
          bio: result.profile.bio ?? "",
          avatarUrl: result.profile.avatarUrl ?? "",
          isPublic: result.profile.isPublic,
        });
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token, isSelf, userId]);

  useEffect(() => {
    if (isSelf || !profile?.isMutual) {
      setIsOnline(false);
      return undefined;
    }
    const socket = io(getChatSocketUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socket.on("presenceSnapshot", (ids) => setIsOnline(ids.includes(profile.id)));
    socket.on("presenceUpdate", ({ userId: changedId, isOnline: online }) => {
      if (changedId === profile.id) setIsOnline(online);
    });
    socket.on("disconnect", () => setIsOnline(false));
    return () => socket.disconnect();
  }, [token, isSelf, profile?.id, profile?.isMutual]);

  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { profile: updated } = await networkApi.updateProfile(token, form);
      setProfile(updated);
      setForm({
        fullName: updated.fullName ?? "",
        bio: updated.bio ?? "",
        avatarUrl: updated.avatarUrl ?? "",
        isPublic: updated.isPublic,
      });
      onProfileUpdated(updated);
      setEditing(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleFollow() {
    setSaving(true);
    setError("");
    try {
      if (profile.isFollowing) await networkApi.unfollow(token, profile.id);
      else await networkApi.follow(token, profile.id);
      setProfile((current) => ({
        ...current,
        isFollowing: !current.isFollowing,
        followerCount: Math.max(0, current.followerCount + (current.isFollowing ? -1 : 1)),
        isMutual: !current.isFollowing && current.followsViewer,
      }));
      if (profile.isFollowing && profile.isMutual) {
        setProfile((current) => ({ ...current, isMutual: false }));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSave(library) {
    setSaving(true);
    setError("");
    try {
      if (library.isSaved) await networkApi.unsaveLibrary(token, library.id);
      else await networkApi.saveLibrary(token, library.id);
      setLibraries((current) => current.map((item) => item.id === library.id
        ? { ...item, isSaved: !library.isSaved }
        : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (pending) return <div className="workspace page-workspace"><div className="page-loading">Opening profile…</div></div>;
  if (error && !profile) return <div className="workspace page-workspace"><PageTitle title="Profile unavailable" description={error} /><Link className="back-link" to="/network">Back to network</Link></div>;
  if (!profile) return null;

  return (
    <div className="workspace page-workspace">
      <PageTitle eyebrow={isSelf ? "YOUR PROFILE" : "READER PROFILE"} title={profile.fullName || profile.username} description={`@${profile.username}`} />
      {error && <div className="page-alert" role="alert">{error}</div>}
      <section className="profile-hero">
        <div className="profile-avatar">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <UserRound size={32} />}
        </div>
        <div className="profile-summary">
          <div className="profile-identity"><h2>{profile.fullName || profile.username}</h2><span>@{profile.username}</span></div>
          <p>{profile.bio || (isSelf ? "Add a short introduction to your profile." : "This reader hasn't added a bio yet.")}</p>
          <div className="profile-stats">
            <span><strong>{profile.followerCount}</strong> followers</span>
            <span><strong>{profile.followingCount}</strong> following</span>
            <span><Shield size={14} /> {profile.isPublic ? "Public profile" : "Private profile"}</span>
            {!isSelf && profile.isMutual && <span className={`profile-presence ${isOnline ? "online" : ""}`}><i />{isOnline ? "Online now" : "Offline"}</span>}
          </div>
          <div className="profile-actions">
            {isSelf ? (
              <button className="button button-primary" onClick={() => setEditing((current) => !current)}><Save size={15} /> {editing ? "Cancel editing" : "Edit profile"}</button>
            ) : (
              <>
                <button className="button button-outline" disabled={saving} onClick={toggleFollow}>{profile.isFollowing ? "Following" : "Follow"}</button>
                {profile.isMutual && <button className="button button-primary" onClick={() => navigate(`/messages/new/${profile.id}`)}><MessageCircle size={15} /> Message</button>}
              </>
            )}
          </div>
        </div>
      </section>

      {isSelf && editing && (
        <form className="profile-edit-form" onSubmit={saveProfile}>
          <label>Display name<input maxLength={100} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} /></label>
          <label>Bio<textarea maxLength={500} rows={4} value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} /></label>
          <label>Avatar image URL<input type="url" maxLength={2048} value={form.avatarUrl} onChange={(event) => setForm((current) => ({ ...current, avatarUrl: event.target.value }))} placeholder="https://" /></label>
          <label className="profile-visibility-option"><input type="checkbox" checked={form.isPublic} onChange={(event) => setForm((current) => ({ ...current, isPublic: event.target.checked }))} /> Make profile visible in people search</label>
          <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
        </form>
      )}

      <div className="profile-library-heading"><h2><Bookmark size={18} /> {isSelf ? "Your public shelves" : "Public libraries"}</h2><Link to="/network"><Users size={14} /> Network</Link></div>
      {libraries.length ? (
        <div className="library-card-grid">
          {libraries.map((library) => (
            <article className="network-library-card" key={library.id}>
              <Link className="model-card" to={`/discover/${library.id}`}>
                <span className="model-card-icon"><Bookmark size={20} /></span>
                <strong>{library.name}</strong>
                <span className="model-card-description">{library.publicModelCount} public {library.publicModelCount === 1 ? "model" : "models"}</span>
                <span className="model-card-link">Browse library <ArrowRight size={14} /></span>
              </Link>
              <button className="button button-outline" disabled={saving} onClick={() => toggleSave(library)}>
                <Bookmark size={14} /> {library.isSaved ? "Saved" : "Save library"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyPage title="No public libraries to show." description={isSelf ? "Make one of your libraries public so other readers can discover it." : "This reader has not shared a public library."} />
      )}
    </div>
  );
}
