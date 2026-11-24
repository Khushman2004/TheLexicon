import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, LockKeyhole, Shield, UserRound, X } from "lucide-react";
import { networkApi } from "../api.js";

export default function LibraryAccessPanel({ token, library }) {
  const [invites, setInvites] = useState([]);
  const [requests, setRequests] = useState([]);
  const [grants, setGrants] = useState([]);
  const [shareLink, setShareLink] = useState("");
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const [nextInvites, nextRequests, nextGrants] = await Promise.all([
      networkApi.listInvites(token, library.id),
      networkApi.listAccessRequests(token, library.id),
      networkApi.listAccessGrants(token, library.id),
    ]);
    setInvites(nextInvites);
    setRequests(nextRequests);
    setGrants(nextGrants);
  }, [token, library.id]);

  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    Promise.all([
      networkApi.listInvites(token, library.id),
      networkApi.listAccessRequests(token, library.id),
      networkApi.listAccessGrants(token, library.id),
    ])
      .then(([nextInvites, nextRequests, nextGrants]) => {
        if (!active) return;
        setInvites(nextInvites);
        setRequests(nextRequests);
        setGrants(nextGrants);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token, library.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh().catch((requestError) => setError(requestError.message));
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function createInvite() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const { invite } = await networkApi.createInvite(token, library.id);
      setShareLink(`${window.location.origin}/share/${invite.token}`);
      setInvites((current) => [invite, ...current]);
      setNotice("Invite link created. It expires in seven days.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setNotice("Share link copied.");
    } catch {
      setNotice("Copy was unavailable; select and copy the invite link below.");
    }
  }

  async function revokeInvite(inviteId) {
    setSaving(true);
    setError("");
    try {
      await networkApi.revokeInvite(token, library.id, inviteId);
      await refresh();
      setNotice("Invite revoked.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function resolveRequest(requestId, decision) {
    setSaving(true);
    setError("");
    try {
      await networkApi.resolveAccessRequest(token, library.id, requestId, decision);
      await refresh();
      setNotice(decision === "APPROVED" ? "Library access approved." : "Request declined.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function revokeGrant(userId) {
    setSaving(true);
    setError("");
    try {
      await networkApi.revokeAccess(token, library.id, userId);
      await refresh();
      setNotice("Library access revoked.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="library-access-panel">
      <div className="access-panel-heading">
        <span className="access-panel-icon"><LockKeyhole size={17} /></span>
        <div>
          <p className="eyebrow">LIBRARY ACCESS</p>
          <h2>{library.isPublic ? "Manage approved readers" : "Invite someone in"}</h2>
          <p>{library.isPublic
            ? "Review and revoke existing grants. Public models are discoverable; approved readers can also see private models."
            : "Create a secure link. The recipient must sign in and request access; you decide whether to approve it."}</p>
        </div>
        {!library.isPublic && (
          <button className="button button-outline" disabled={saving} onClick={createInvite}>
            <Link2 size={15} /> Create invite link
          </button>
        )}
      </div>
      {error && <div className="page-alert" role="alert">{error}</div>}
      {notice && <p className="access-panel-notice" role="status">{notice}</p>}
      {shareLink && (
        <div className="share-link-field">
          <input readOnly value={shareLink} aria-label="Private library invite URL" onFocus={(event) => event.target.select()} />
          <button className="button button-outline" onClick={copyShareLink}><Copy size={14} /> Copy link</button>
        </div>
      )}
      {pending ? <p className="access-panel-muted">Loading access settings…</p> : (
        <div className="access-panel-grid">
          <section>
            <h3><UserRound size={15} /> Access requests</h3>
            {requests.filter((request) => request.status === "PENDING").length ? (
              requests.filter((request) => request.status === "PENDING").map((request) => (
                <div className="access-list-row" key={request.id}>
                  <span><strong>{request.requesterName || request.requesterUsername}</strong><small>@{request.requesterUsername}</small></span>
                  <button disabled={saving} aria-label={`Approve ${request.requesterUsername}`} onClick={() => resolveRequest(request.id, "APPROVED")}><Check size={15} /></button>
                  <button disabled={saving} aria-label={`Decline ${request.requesterUsername}`} onClick={() => resolveRequest(request.id, "DECLINED")}><X size={15} /></button>
                </div>
              ))
            ) : <p className="access-panel-muted">No pending requests.</p>}
          </section>
          <section>
            <h3><Shield size={15} /> People with access</h3>
            {grants.length ? grants.map((grant) => (
              <div className="access-list-row" key={grant.userId}>
                <span><strong>{grant.fullName || grant.username}</strong><small>@{grant.username}</small></span>
                <button disabled={saving} aria-label={`Revoke access for ${grant.username}`} onClick={() => revokeGrant(grant.userId)}><X size={15} /></button>
              </div>
            )) : <p className="access-panel-muted">No one else has access yet.</p>}
          </section>
          <section>
            <h3><Link2 size={15} /> Active invite links</h3>
            {invites.filter((invite) => invite.isActive).length ? invites.filter((invite) => invite.isActive).map((invite) => (
              <div className="access-list-row" key={invite.id}>
                <span><strong>Invite link</strong><small>Expires {new Date(invite.expiresAt).toLocaleDateString()}</small></span>
                <button disabled={saving} aria-label="Revoke invite link" onClick={() => revokeInvite(invite.id)}><X size={15} /></button>
              </div>
            )) : <p className="access-panel-muted">No active links.</p>}
          </section>
        </div>
      )}
    </section>
  );
}
