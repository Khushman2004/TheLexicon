import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { ArrowLeft, MessageCircle, Send, UserRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { chatApi, getChatSocketUrl } from "../api.js";
import { EmptyPage, PageTitle } from "./WorkspaceComponents.jsx";

export default function ChatPage({ token, currentUserId }) {
  const { conversationId, recipientId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [pending, setPending] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const activeId = conversationId ? Number(conversationId) : selectedId ?? conversations[0]?.id;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId),
    [conversations, activeId],
  );

  useEffect(() => {
    let active = true;
    setPending(true);
    chatApi.listConversations(token)
      .then((result) => active && setConversations(result))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!recipientId) return undefined;
    let active = true;
    setError("");
    chatApi.openConversation(token, recipientId)
      .then((conversation) => {
        if (!active) return;
        setConversations((current) => [
          conversation,
          ...current.filter((item) => item.id !== conversation.id),
        ]);
        setSelectedId(conversation.id);
        navigate(`/messages/${conversation.id}`, { replace: true });
      })
      .catch((requestError) => active && setError(requestError.message));
    return () => { active = false; };
  }, [token, recipientId, navigate]);

  useEffect(() => {
    const socket = io(getChatSocketUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;
    socket.on("connect", () => setSocketStatus("connected"));
    socket.on("disconnect", () => setSocketStatus("reconnecting"));
    socket.on("connect_error", (socketError) => {
      setSocketStatus("reconnecting");
      setError(socketError.message || "Chat connection lost.");
    });
    socket.on("presenceSnapshot", (ids) => setOnlineUsers(new Set(ids)));
    socket.on("presenceUpdate", ({ userId, isOnline }) => {
      setOnlineUsers((current) => {
        const next = new Set(current);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });
    socket.on("newMessage", (message) => {
      setConversations((current) => current.map((conversation) => (
        conversation.id === message.conversationId
          ? { ...conversation, lastMessage: message.body, lastMessageAt: message.createdAt, lastSenderId: message.senderId }
          : conversation
      )));
      if (message.conversationId === activeIdRef.current) {
        setMessages((current) => appendUnique(current, message));
      }
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (!activeId || !socketRef.current?.connected) return;
    socketRef.current.emit("joinConversation", { conversationId: activeId }, (result) => {
      if (!result?.ok) setError(result?.error || "Could not open this conversation.");
    });
  }, [activeId, socketStatus]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return undefined;
    }
    let active = true;
    setError("");
    chatApi.listMessages(token, activeId)
      .then((result) => active && setMessages((current) => mergeMessages(current, result)))
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setPending(false));
    return () => { active = false; };
  }, [token, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError("Chat is reconnecting. Your message has not been sent.");
      return;
    }
    setSending(true);
    setError("");
    socket.emit("sendMessage", { conversationId: activeId, body }, (result) => {
      if (!result?.ok) {
        setError(result?.error || "Message could not be sent.");
      } else {
        setMessages((current) => appendUnique(current, result.message));
        setConversations((current) => current.map((conversation) => (
          conversation.id === activeId
            ? { ...conversation, lastMessage: body, lastMessageAt: result.message.createdAt, lastSenderId: currentUserId }
            : conversation
        )));
        setDraft("");
      }
      setSending(false);
    });
  }

  return (
    <div className="workspace page-workspace chat-workspace">
      <PageTitle eyebrow="THE LEXICON NETWORK" title="Conversations" description="Live, private messages between readers who follow each other." />
      {error && <div className="page-alert" role="alert">{error}</div>}
      <div className="chat-connection-state"><span className={`presence-dot ${socketStatus}`} /> {socketStatus === "connected" ? "Connected · live messages" : "Reconnecting to chat…"}</div>
      <section className="chat-layout">
        <aside className="conversation-list">
          <div className="conversation-list-heading"><MessageCircle size={16} /><strong>Your conversations</strong></div>
          {pending && !conversations.length ? <div className="page-loading">Loading conversations…</div> : conversations.length ? conversations.map((conversation) => (
            <button
              className={`conversation-row ${conversation.id === activeId ? "selected" : ""}`}
              key={conversation.id}
              onClick={() => {
                setSelectedId(conversation.id);
                navigate(`/messages/${conversation.id}`);
              }}
            >
              <span className="mini-avatar">{conversation.otherAvatarUrl ? <img src={conversation.otherAvatarUrl} alt="" /> : <UserRound size={17} />}</span>
              <span className="conversation-copy">
                <strong>{conversation.otherName || conversation.otherUsername}</strong>
                <small>{conversation.lastMessage || "Say hello to start."}</small>
              </span>
              <span className={`presence-dot ${onlineUsers.has(conversation.otherUserId) ? "online" : ""}`} />
            </button>
          )) : <p className="conversation-empty">You have no chats yet. Send a chat request from a profile or accept one in your notifications.</p>}
          <Link className="conversation-discover-link" to="/network"><ArrowLeft size={14} /> Find readers</Link>
        </aside>
        <section className="chat-thread">
          {activeConversation ? (
            <>
              <header className="chat-thread-header">
                <span className="mini-avatar">{activeConversation.otherAvatarUrl ? <img src={activeConversation.otherAvatarUrl} alt="" /> : <UserRound size={17} />}</span>
                <div><Link to={`/profiles/${activeConversation.otherUserId}`}>{activeConversation.otherName || activeConversation.otherUsername}</Link><span>{onlineUsers.has(activeConversation.otherUserId) ? "Online now" : `@${activeConversation.otherUsername}`}</span></div>
                <span className={`presence-dot ${onlineUsers.has(activeConversation.otherUserId) ? "online" : ""}`} />
              </header>
              <div className="chat-messages">
                {messages.length ? messages.map((message) => (
                  <article className={`chat-bubble ${message.senderId === currentUserId ? "mine" : ""}`} key={message.id}>
                    <p>{message.body}</p>
                    <time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                  </article>
                )) : <EmptyPage title="A fresh conversation." description="Send a thoughtful first message." />}
                <div ref={bottomRef} />
              </div>
              <form className="chat-compose" onSubmit={sendMessage}>
                <textarea value={draft} maxLength={4000} rows={2} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" aria-label="Message" />
                <button className="button button-primary" disabled={!draft.trim() || sending || socketStatus !== "connected"}><Send size={15} /> Send</button>
              </form>
            </>
          ) : (
            <div className="chat-empty-state"><div><MessageCircle size={26} /></div><h2>Every good idea begins with a conversation.</h2><p>Once a chat request is accepted, your conversation will appear here.</p><Link className="button button-primary" to="/network">Find readers <ArrowLeft size={14} /></Link></div>
          )}
        </section>
      </section>
    </div>
  );
}

function appendUnique(current, message) {
  if (current.some((item) => item.id === message.id)) return current;
  return [...current, message].sort((first, second) => Number(first.id) - Number(second.id));
}

function mergeMessages(current, incoming) {
  const messages = new Map(current.map((message) => [String(message.id), message]));
  incoming.forEach((message) => messages.set(String(message.id), message));
  return [...messages.values()].sort((first, second) => Number(first.id) - Number(second.id));
}
