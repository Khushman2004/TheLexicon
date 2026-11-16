import { useEffect, useState } from "react";
import { Check, LockKeyhole, Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { networkApi } from "../api.js";
import { PageTitle } from "./WorkspaceComponents.jsx";

export default function LibraryInvitePage({ token }) {
  const { shareToken } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [request, setRequest] = useState(null);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPending(true);
    setError("");
    networkApi.getInvitation(token, shareToken)
      .then(({ invitation: result }) => active && setInvitation(result))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token, shareToken]);

  async function requestAccess() {
    setSaving(true);
    setError("");
    try {
      const { request: result } = await networkApi.requestLibraryAccess(token, shareToken);
      setRequest(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (pending) return <div className="workspace page-workspace"><div className="page-loading">Checking invitation…</div></div>;
  if (error && !invitation) return <div className="workspace page-workspace"><PageTitle title="Invitation unavailable" description={error} /><Link className="back-link" to="/network">Back to network</Link></div>;
  if (!invitation) return null;

  const alreadyHasAccess = request?.alreadyHasAccess;
  const requestStatus = request?.status;

  return (
    <div className="workspace page-workspace invite-page">
      <div className="invite-card">
        <div className="invite-lock"><LockKeyhole size={23} /></div>
        <PageTitle eyebrow="PRIVATE LIBRARY INVITE" title={invitation.libraryName} description={`Shared by @${invitation.ownerUsername}. This private library is only available after the owner approves your request.`} />
        {error && <div className="page-alert" role="alert">{error}</div>}
        {alreadyHasAccess || requestStatus === "APPROVED" ? (
          <div className="invite-status"><Check size={17} /> You already have access. <Link to={`/shared/${invitation.libraryId}`}>Open library</Link></div>
        ) : requestStatus === "PENDING" ? (
          <div className="invite-status"><Check size={17} /> Access request sent. The owner will review it.</div>
        ) : requestStatus === "DECLINED" ? (
          <div className="invite-status">The owner declined your previous request. Ask them for a new invite link.</div>
        ) : (
          <button className="button button-primary" disabled={saving} onClick={requestAccess}><Send size={15} /> {saving ? "Sending request…" : "Request access"}</button>
        )}
        <p className="invite-expiry">Invite expires {new Date(invitation.expiresAt).toLocaleString()}.</p>
        <Link className="back-link" to="/network">Back to your network</Link>
      </div>
    </div>
  );
}
