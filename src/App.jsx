
import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase/config";
import {
  getUsers,
  getOrCreateConversation,
  listenToMessages,
  sendMessage,
} from "./services/chatService";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      return;
    }

    let cancelled = false;
    setLoadingUsers(true);

    getUsers(user.uid)
      .then((result) => {
        if (!cancelled) setUsers(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingUsers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setMessages([]);

    if (!activeConversation) {
      setLoadingMessages(false);
      return;
    }

    setLoadingMessages(true);
    setError("");

    const unsubscribe = listenToMessages(
      activeConversation.id,
      (result) => {
        setMessages(result);
        setLoadingMessages(false);
      },
      (err) => {
        setError(`Could not load messages: ${err.message}`);
        setLoadingMessages(false);
      }
    );

    return unsubscribe;
  }, [activeConversation]);

  async function handleAuth(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      if (isRegister) {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await updateProfile(credential.user, {
          displayName: name.trim(),
        });

        await setDoc(doc(db, "users", credential.user.uid), {
          displayName: name.trim(),
          email: email.trim(),
          photoURL: null,
          createdAt: serverTimestamp(),
        });

        setNotice("Account created successfully.");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    setActiveConversation(null);
    setActiveContact(null);
    setMessages([]);
  }

  async function handleOpenChat(contact) {
    if (!user || busy) return;

    setBusy(true);
    setError("");
    setNotice("");
    setMessages([]);

    try {
      const conversation = await getOrCreateConversation(user.uid, contact.id);
      setActiveConversation(conversation);
      setActiveContact(contact);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!messageText.trim() || !activeConversation || !user || busy) {
      return;
    }

    const textToSend = messageText;
    setMessageText("");
    setError("");
    setBusy(true);

    try {
      await sendMessage(activeConversation.id, user.uid, textToSend);
    } catch (err) {
      setError(err.message);
      setMessageText(textToSend);
    } finally {
      setBusy(false);
    }
  }

  const filteredUsers = users.filter((person) => {
    const term = search.toLowerCase();
    return (
      (person.displayName || "").toLowerCase().includes(term) ||
      (person.email || "").toLowerCase().includes(term)
    );
  });

  if (authLoading) {
    return <div className="screen-loading">Loading Campus Chat...</div>;
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark">C</div>
          <p className="eyebrow">YOUR CAMPUS, CONNECTED</p>
          <h1>Campus Chat</h1>
          <p className="auth-subtitle">
            A simple, private space to stay connected.
          </p>

          <form onSubmit={handleAuth} className="auth-form">
            {isRegister && (
              <label>
                Full name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </label>

            {error && <p className="error-message">{error}</p>}
            {notice && <p className="notice-message">{notice}</p>}

            <button className="primary-button" disabled={busy} type="submit">
              {busy
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="switch-auth">
            {isRegister ? "Already have an account?" : "New to Campus Chat?"}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
                setNotice("");
              }}
            >
              {isRegister ? "Sign in" : "Create account"}
            </button>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <h1>Campus Chat</h1>
            <p>Stay connected</p>
          </div>
        </div>

        <div className="account-controls">
          <span>{user.displayName || user.email}</span>
          <button className="secondary-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      {error && <div className="global-error">{error}</div>}
      {notice && <div className="global-notice">{notice}</div>}

      <section className="chat-layout">
        <aside className="people-panel">
          <div className="panel-heading">
            <p className="eyebrow">YOUR COMMUNITY</p>
            <h2>People</h2>
            <p>Find someone to chat with.</p>
          </div>

          <input
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
          />

          <div className="people-list">
            {loadingUsers && <p className="muted-text">Loading people...</p>}

            {!loadingUsers && filteredUsers.length === 0 && (
              <p className="muted-text">
                {users.length === 0
                  ? "No other users yet. Register another account to test chat."
                  : "No people match your search."}
              </p>
            )}

            {filteredUsers.map((person) => (
              <button
                key={person.id}
                className={`person-item ${
                  activeContact?.id === person.id ? "selected" : ""
                }`}
                onClick={() => handleOpenChat(person)}
                disabled={busy}
              >
                <span className="avatar">
                  {(person.displayName || person.email || "?")
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <span className="person-info">
                  <strong>{person.displayName || "Campus member"}</strong>
                  <small>{person.email}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="conversation-panel">
          {!activeConversation ? (
            <div className="conversation-empty">
              <div className="empty-icon">✉</div>
              <h2>Your conversations start here</h2>
              <p>Choose someone from the list to open a private chat.</p>
            </div>
          ) : (
            <>
              <header className="conversation-header">
                <div className="avatar large">
                  {(activeContact?.displayName || "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div>
                  <h2>{activeContact?.displayName || "Campus member"}</h2>
                  <p>{activeContact?.email}</p>
                </div>
              </header>

              <div className="messages-area">
                {loadingMessages && (
                  <p className="muted-text">Loading messages...</p>
                )}

                {!loadingMessages && messages.length === 0 && (
                  <div className="messages-empty">
                    <p>No messages yet.</p>
                    <span>Say hello to start the conversation!</span>
                  </div>
                )}

                {messages.map((message) => {
                  const ownMessage = message.senderId === user.uid;

                  return (
                    <div
                      key={message.id}
                      className={`message-row ${
                        ownMessage ? "message-own" : "message-other"
                      }`}
                    >
                      <div className="message-bubble">
                        <p>{message.text}</p>
                        <small>
                          {message.createdAt?.toDate
                            ? message.createdAt.toDate().toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" }
                              )
                            : "Sending..."}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form className="message-form" onSubmit={handleSendMessage}>
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Write a message..."
                  aria-label="Write a message"
                  maxLength={2000}
                />
                <button
                  className="primary-button send-button"
                  type="submit"
                  disabled={busy || !messageText.trim()}
                >
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;
