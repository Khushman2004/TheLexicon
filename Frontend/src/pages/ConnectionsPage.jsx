import { useEffect, useState } from "react";
import { ArrowLeft, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { networkApi } from "../api.js";
import { EmptyPage, PageTitle } from "./WorkspaceComponents.jsx";

export default function ConnectionsPage({ token, currentUserId }) {
  const { userId, direction } = useParams();
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isFollowers = direction === "followers";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const profileRequest = String(currentUserId) === userId
      ? networkApi.getMyProfile(token).then((result) => result.profile)
      : networkApi.getUser(token, userId).then((result) => result.profile);
    Promise.all([
      profileRequest,
      networkApi.connections(token, direction, userId),
    ])
      .then(([nextProfile, nextUsers]) => {
        if (!active) return;
        setProfile(nextProfile);
        setUsers(nextUsers);
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token, userId, direction, currentUserId]);

  if (!["followers", "following"].includes(direction)) {
    return <div className="workspace page-workspace"><PageTitle title="List unavailable" description="Choose followers or following to view this list." /></div>;
  }

  const profilePath = String(currentUserId) === userId ? "/profile" : `/profiles/${userId}`;

  return (
    <div className="workspace page-workspace">
      <Link className="back-link" to={profilePath}><ArrowLeft size={14} /> Back to profile</Link>
      <PageTitle
        eyebrow={profile ? `@${profile.username}` : "YOUR NETWORK"}
        title={`${profile?.fullName || profile?.username || "Reader"}'s ${isFollowers ? "followers" : "following"}`}
        description={isFollowers ? "Readers who follow this profile." : "Readers this profile follows."}
      />
      {error && <div className="page-alert" role="alert">{error}</div>}
      {loading ? (
        <div className="page-loading">Loading people…</div>
      ) : users.length ? (
        <div className="person-card-grid connection-card-grid">
          {users.map((person) => (
            <article className="person-card" key={person.id}>
              <Link className="person-avatar" to={`/profiles/${person.id}`}><UserRound size={23} /></Link>
              <div className="person-copy">
                <Link to={`/profiles/${person.id}`}><strong>{person.fullName || person.username}</strong></Link>
                <span>@{person.username}</span>
                {person.bio && <p>{person.bio}</p>}
                <small>{person.followerCount} followers · {person.followingCount} following</small>
              </div>
            </article>
          ))}
        </div>
      ) : !error ? (
        <EmptyPage
          title={isFollowers ? "No followers yet." : "Not following anyone yet."}
          description={isFollowers ? "When readers follow this profile, they will appear here." : "People this reader follows will appear here."}
        />
      ) : null}
    </div>
  );
}
