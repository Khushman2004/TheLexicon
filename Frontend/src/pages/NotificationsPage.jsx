import { useCallback, useEffect, useState } from "react";
import { Bell, Bookmark, Check, MessageCircle, UserRound, Users, X, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { chatApi, networkApi } from "../api.js";
import { EmptyPage, PageTitle } from "./WorkspaceComponents.jsx";

const NOTIFICATION_DETAILS = {
  FOLLOW: {
    icon: Users,
    describe: (notification) => `${notification.actorName || notification.actorUsername} started following you.`,
    href: (notification) => `/profiles/${notification.actorId}`,
  },
  LIBRARY_ACCESS_REQUEST: {
    icon: Bookmark,
    describe: (notification) => `${notification.actorName || notification.actorUsername} requested access to ${notification.libraryName || "your library"}.`,
    href: (notification) => `/libraries/${notification.libraryId}`,
  },
  LIBRARY_ACCESS_APPROVED: {
    icon: Bookmark,
    describe: (notification) => `${notification.actorName || notification.actorUsername} approved your request to ${notification.libraryName || "a library"}.`,
    href: (notification) => `/shared/${notification.libraryId}`,
  },
  LIBRARY_ACCESS_DECLINED: {
    icon: Bookmark,
    describe: (notification) => `${notification.actorName || notification.actorUsername} declined your request to ${notification.libraryName || "a library"}.`,
    href: () => "/saved",
  },
  LIBRARY_SAVED: {
    icon: Bookmark,
    describe: (notification) => `${notification.actorName || notification.actorUsername} saved your library${notification.libraryName ? ` "${notification.libraryName}"` : ""}.`,
    href: (notification) => `/libraries/${notification.libraryId}`,
  },
  CHAT_MESSAGE: {
    icon: MessageCircle,
    describe: (notification) => `${notification.actorName || notification.actorUsername} sent you a message.`,
    href: (notification) => `/messages/${notification.conversationId}`,
  },
  CHAT_REQUEST: {
    icon: MessageCircle,
    describe: (notification) => `${notification.actorName || notification.actorUsername} wants to chat with you.`,
    href: (notification) => `/profiles/${notification.actorId}`,
  },
  CHAT_REQUEST_ACCEPTED: {
    icon: MessageCircle,
    describe: (notification) => `${notification.actorName || notification.actorUsername} accepted your chat request.`,
    href: (notification) => `/messages/${notification.conversationId}`,
  },
  CHAT_REQUEST_DECLINED: {
    icon: MessageCircle,
    describe: (notification) => `${notification.actorName || notification.actorUsername} declined your chat request.`,
    href: (notification) => `/profiles/${notification.actorId}`,
  },
  COMMUNITY_ACTIVITY: {
    icon: Users,
    describe: (notification) => `${notification.actorName || notification.actorUsername || "Someone"} ${notification.details || "was active"}${notification.communityName ? ` in "${notification.communityName}"` : " in your community"}.`,
    href: (notification) => notification.communityId ? `/community/${notification.communityId}` : "/community",
  },
};

export default function NotificationsPage({ token, onUnreadCountChange }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [respondingRequestId, setRespondingRequestId] = useState(null);
  const [clearing, setClearing] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await networkApi.getNotifications(token);
      setNotifications(result.notifications);
      onUnreadCountChange(result.unreadCount);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token, onUnreadCountChange]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function openNotification(event, notification) {
    event.preventDefault();
    if (!notification.readAt) {
      try {
        await networkApi.markNotificationRead(token, notification.id);
        setNotifications((current) => current.map((item) => item.id === notification.id
          ? { ...item, readAt: new Date().toISOString() }
          : item));
        onUnreadCountChange((count) => Math.max(0, count - 1));
      } catch (requestError) {
        setError(requestError.message);
        return;
      }
    }
    const details = NOTIFICATION_DETAILS[notification.type];
    if (details) navigate(details.href(notification));
  }

  async function markAllRead() {
    setError("");
    try {
      await networkApi.markAllNotificationsRead(token);
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      onUnreadCountChange(0);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function clearAll() {
    if (!window.confirm("Clear all notifications? This cannot be undone.")) return;
    setClearing(true);
    setError("");
    try {
      await networkApi.clearAllNotifications(token);
      setNotifications([]);
      onUnreadCountChange(0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setClearing(false);
    }
  }

  async function respondToChatRequest(event, notification, decision) {
    event.preventDefault();
    event.stopPropagation();
    setRespondingRequestId(notification.chatRequestId);
    setError("");
    try {
      const request = await chatApi.respondToRequest(token, notification.chatRequestId, decision);
      setNotifications((current) => current.map((item) => item.id === notification.id
        ? { ...item, readAt: item.readAt ?? new Date().toISOString(), chatRequestStatus: request.status }
        : item));
      if (!notification.readAt) onUnreadCountChange((count) => Math.max(0, count - 1));
      if (decision === "ACCEPTED" && request.conversationId) {
        navigate(`/messages/${request.conversationId}`);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRespondingRequestId(null);
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="workspace page-workspace">
      <PageTitle
        eyebrow="YOUR ACCOUNT"
        title="Notifications"
        description="Keep up with follows, library access, messages, community activity, and chat requests."
      />
      {error && <div className="page-alert" role="alert">{error}</div>}
      <div className="notifications-toolbar">
        <span>{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</span>
        <div className="notifications-toolbar-actions">
          <button className="button button-outline" disabled={!unreadCount} onClick={markAllRead}>
            Mark all as read
          </button>
          <button className="button button-outline" disabled={!notifications.length || clearing} onClick={clearAll}>
            <Trash2 size={14} />{clearing ? "Clearing…" : "Clear all"}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="page-loading">Gathering your notifications…</div>
      ) : notifications.length ? (
        <div className="notification-list">
          {notifications.map((notification) => {
            const details = NOTIFICATION_DETAILS[notification.type];
            const Icon = details?.icon ?? UserRound;
            return (
              <div
                className={`notification-item ${notification.readAt ? "read" : "unread"}`}
                key={notification.id}
              >
                <Link
                  className="notification-main"
                  to={details?.href(notification) ?? "/notifications"}
                  onClick={(event) => openNotification(event, notification)}
                >
                  <span className="notification-icon"><Icon size={17} /></span>
                  <span className="notification-copy">
                    <strong>{details?.describe(notification) ?? "There is an update to your account."}</strong>
                    <time dateTime={notification.createdAt}>
                      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
                        .format(new Date(notification.createdAt))}
                    </time>
                  </span>
                  {!notification.readAt && <span className="notification-unread-dot" aria-label="Unread" />}
                </Link>
                {notification.type === "CHAT_REQUEST" && notification.chatRequestStatus === "PENDING" && (
                  <div className="notification-actions">
                    <button
                      className="button button-outline"
                      disabled={respondingRequestId === notification.chatRequestId}
                      onClick={(event) => respondToChatRequest(event, notification, "DECLINED")}
                    >
                      <X size={14} /> Decline
                    </button>
                    <button
                      className="button button-primary"
                      disabled={respondingRequestId === notification.chatRequestId}
                      onClick={(event) => respondToChatRequest(event, notification, "ACCEPTED")}
                    >
                      <Check size={14} /> Accept
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyPage
          title="No notifications yet."
          description="New followers, library activity, chat requests, and messages will show up here."
        />
      )}
      <Link className="notifications-profile-link" to="/profile">
        <Bell size={14} /> Manage your public profile
      </Link>
    </div>
  );
}
