import React, { useState, useEffect, useRef } from 'react';
import './App.css';

import Login from './components/Login';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://chatgptlikeapplication.onrender.com/api';

function App() {
  // Authentication states
  const [userToken, setUserToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [authView, setAuthView] = useState(localStorage.getItem('token') ? 'chat' : 'login');

  // Chat workspace states
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeDocuments, setActiveDocuments] = useState([]);
  const [threadTitle, setThreadTitle] = useState('New Chat');
  const [chatMode, setChatMode] = useState('ai');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Input states
  const [inputValue, setInputValue] = useState('');
  const [pendingFile, setPendingFile] = useState(null);

  // Loading & Error states
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (authView === 'chat') {
      scrollToBottom();
    }
  }, [messages, isTyping, authView]);

  // Fetch threads on mount when authenticated
  useEffect(() => {
    if (userToken && authView === 'chat') {
      fetchThreads();
    }
  }, [userToken, authView]);

  // Fetch messages when active thread changes
  useEffect(() => {
    if (userToken && activeThreadId && authView === 'chat') {
      fetchMessages(activeThreadId);
    } else {
      setMessages([]);
      setActiveDocuments([]);
      setPendingFile(null);
      setThreadTitle('New Chat');
    }
  }, [activeThreadId, authView]);

  const handleAuthError = (status) => {
    if (status === 401) {
      handleLogout();
      showError('Session expired. Please login again.');
    }
  };

  const fetchThreads = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/threads/`, {
        headers: { 'Authorization': `Token ${userToken}` }
      });
      if (response.status === 401) return handleAuthError(401);
      if (!response.ok) throw new Error('Failed to fetch threads');
      const data = await response.json();
      setThreads(data);
      if (data.length > 0 && !activeThreadId) {
        setActiveThreadId(data[0].id);
      }
    } catch (err) {
      showError('Could not load chat history. Is the backend server running?');
    }
  };

  const fetchMessages = async (threadId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/threads/${threadId}/messages/`, {
        headers: { 'Authorization': `Token ${userToken}` }
      });
      if (response.status === 401) return handleAuthError(401);
      if (!response.ok) throw new Error('Failed to load messages');
      const data = await response.json();
      setMessages(data.messages || []);
      setActiveDocuments(data.documents || []);
      setThreadTitle(data.title || 'New Chat');
      setThreads(prev => prev.map(t =>
        t.id === threadId ? { ...t, title: data.title || 'New Chat' } : t
      ));
      if (data.documents && data.documents.length > 0) {
        setChatMode('doc');
      } else {
        setChatMode('ai');
      }
    } catch (err) {
      showError('Error loading conversation messages.');
    }
  };

  const createNewThread = async () => {
    try {
      setErrorMsg(null);
      const response = await fetch(`${API_BASE_URL}/threads/`, {
        method: 'POST',
        headers: { 'Authorization': `Token ${userToken}` }
      });
      if (response.status === 401) return handleAuthError(401);
      if (!response.ok) throw new Error('Failed to create new chat');
      const newThread = await response.json();

      setThreads(prev => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
    } catch (err) {
      showError('Failed to create a new chat session.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !activeThreadId) return;

    if (file.size > 10 * 1024 * 1024) {
      showError('File size exceeds the 10MB limit.');
      return;
    }

    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!activeThreadId) return;

    if (!inputValue.trim() && !pendingFile) return;

    if (chatMode === 'doc' && activeDocuments.length === 0 && !pendingFile) {
      showError('Please upload a document to proceed in Document mode.');
      return;
    }

    const userText = inputValue;
    setInputValue('');
    setErrorMsg(null);
    setIsTyping(true);

    try {
      if (pendingFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', pendingFile);

        const uploadResponse = await fetch(`${API_BASE_URL}/threads/${activeThreadId}/upload/`, {
          method: 'POST',
          headers: { 'Authorization': `Token ${userToken}` },
          body: formData,
        });

        if (uploadResponse.status === 401) {
          setIsUploading(false);
          setIsTyping(false);
          return handleAuthError(401);
        }

        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(uploadData.error || 'Upload failed');
        }

        // Add the uploaded document to activeDocuments list
        setActiveDocuments(prev => [...prev, uploadData.document]);
        setPendingFile(null);
        setIsUploading(false);

        // Fetch messages immediately so that the document upload bubble renders first
        await fetchMessages(activeThreadId);

        // If user typed some text, send it in same submit
        if (userText.trim()) {
          // Optimistically append user text message so it shows up next
          const tempUserMessage = {
            id: 'temp-user-text-' + Date.now(),
            role: 'user',
            content: userText,
            created_at: new Date().toISOString()
          };
          setMessages(prev => [...prev, tempUserMessage]);
          setIsTyping(true);

          const startTime = Date.now();
          const sendResponse = await fetch(`${API_BASE_URL}/threads/${activeThreadId}/send/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Token ${userToken}`
            },
            body: JSON.stringify({ content: userText, mode: chatMode })
          });

          if (sendResponse.status === 401) {
            setIsTyping(false);
            return handleAuthError(401);
          }

          const sendData = await sendResponse.json();
          if (!sendResponse.ok) {
            throw new Error(sendData.error || 'Server failed to respond');
          }

          if (sendData.thread_title) {
            setThreadTitle(sendData.thread_title);
            setThreads(prev => prev.map(t =>
              t.id === activeThreadId ? { ...t, title: sendData.thread_title } : t
            ));
          }

          // Enforce minimum typing delay (800ms) for natural conversational flow
          const elapsedTime = Date.now() - startTime;
          const minDelay = 800;
          if (elapsedTime < minDelay) {
            await new Promise(resolve => setTimeout(resolve, minDelay - elapsedTime));
          }

          // Fetch messages a final time to sync the official database messages list (replacing optimistic placeholder)
          await fetchMessages(activeThreadId);
        }
      } else {
        // Regular message sending
        // Optimistically add user message
        const tempUserMessage = {
          id: Date.now(),
          role: 'user',
          content: userText,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMessage]);

        const startTime = Date.now();
        const response = await fetch(`${API_BASE_URL}/threads/${activeThreadId}/send/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${userToken}`
          },
          body: JSON.stringify({ content: userText, mode: chatMode })
        });

        if (response.status === 401) {
          setIsTyping(false);
          return handleAuthError(401);
        }

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Server failed to respond');
        }

        if (data.thread_title) {
          setThreadTitle(data.thread_title);
          setThreads(prev => prev.map(t =>
            t.id === activeThreadId ? { ...t, title: data.thread_title } : t
          ));
        }

        // Enforce minimum typing delay (800ms) for natural conversational flow
        const elapsedTime = Date.now() - startTime;
        const minDelay = 800;
        if (elapsedTime < minDelay) {
          await new Promise(resolve => setTimeout(resolve, minDelay - elapsedTime));
        }

        setMessages(prev => [...prev, data.message]);
      }
    } catch (err) {
      showError(err.message || 'Failed to send message.');
    } finally {
      setIsTyping(false);
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!activeThreadId) return;
    setErrorMsg(null);
    setIsUploading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/threads/${activeThreadId}/document/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${userToken}` }
      });

      if (response.status === 401) return handleAuthError(401);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to detach document');
      }

      setActiveDocuments([]);
      setThreads(prev => prev.map(t =>
        t.id === activeThreadId ? { ...t, document_name: null } : t
      ));
    } catch (err) {
      showError(err.message || 'Failed to remove document.');
    } finally {
      setIsUploading(false);
    }
  };

  const deleteThread = async (e, threadId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat session?')) return;
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_BASE_URL}/threads/${threadId}/delete/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Token ${userToken}` }
      });

      if (response.status === 401) return handleAuthError(401);
      if (!response.ok) throw new Error('Failed to delete thread');

      const remainingThreads = threads.filter(t => t.id !== threadId);
      setThreads(remainingThreads);

      if (activeThreadId === threadId) {
        if (remainingThreads.length > 0) {
          setActiveThreadId(remainingThreads[0].id);
        } else {
          setActiveThreadId(null);
          setMessages([]);
          setActiveDocuments([]);
          setThreadTitle('New Chat');
        }
      }
    } catch (err) {
      showError('Could not delete the chat session.');
    }
  };

  // ----------------- Authentication Callback Handlers -----------------

  const handleLoginSuccess = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', user);
    setUserToken(token);
    setUsername(user);
    setAuthView('chat');
  };

  const handleRegisterSuccess = () => {
    showError('Registration successful! Please login to continue.');
    setAuthView('login');
  };

  const handleResetSuccess = () => {
    showError('Password reset successful! Please login with your new password.');
    setAuthView('login');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUserToken(null);
    setUsername('');
    setActiveThreadId(null);
    setThreads([]);
    setMessages([]);
    setAuthView('login');
  };

  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => {
      setErrorMsg(null);
    }, 8000);
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ----------------- Rendering Views -----------------

  // 1. REGISTER SCREEN
  if (authView === 'register') {
    return (
      <Register
        API_BASE_URL={API_BASE_URL}
        onRegisterSuccess={handleRegisterSuccess}
        onNavigateToLogin={() => { setAuthView('login'); setErrorMsg(null); }}
        showError={showError}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
      />
    );
  }

  // 2. LOGIN SCREEN
  if (authView === 'login') {
    return (
      <Login
        API_BASE_URL={API_BASE_URL}
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => { setAuthView('register'); setErrorMsg(null); }}
        onNavigateToForgot={() => { setAuthView('forgot'); setErrorMsg(null); }}
        showError={showError}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
      />
    );
  }

  // 3. FORGOT PASSWORD (OTP RESET) SCREEN
  if (authView === 'forgot') {
    return (
      <ForgotPassword
        API_BASE_URL={API_BASE_URL}
        onSuccessRedirectToLogin={handleResetSuccess}
        onNavigateToLogin={() => { setAuthView('login'); setErrorMsg(null); }}
        showError={showError}
        errorMsg={errorMsg}
        setErrorMsg={setErrorMsg}
      />
    );
  }

  // 4. MAIN CHAT WORKSPACE
  return (
    <div className="app-container">
      {/* Mobile Sidebar Overlay Backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 90
          }}
        />
      )}

      {/* Sidebar: Chat Threads */}
      <aside className={`sidebar ${sidebarOpen ? 'active' : ''}`}>
        <div className="sidebar-header">
          <div className="brand" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="brand-icon">🤖</div>
              <div className="brand-title">Santhosh Chat</div>
            </div>
            <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              &times;
            </button>
          </div>
          <button className="new-chat-btn" onClick={() => { createNewThread(); setSidebarOpen(false); }}>
            <span>➕</span> New Chat
          </button>
        </div>

        <div className="thread-list">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`thread-item ${activeThreadId === thread.id ? 'active' : ''}`}
              onClick={() => { setActiveThreadId(thread.id); setSidebarOpen(false); }}
            >
              <div className="thread-details">
                <span className="thread-title">{thread.title || 'New Chat'}</span>
                <div className="thread-meta">
                  <span>💬 Chat</span>
                </div>
              </div>
              <button
                className="delete-thread-btn"
                onClick={(e) => deleteThread(e, thread.id)}
                title="Delete Chat"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>

        {/* Sidebar User Details & Logout */}
        <div className="logout-container">
          <span className="username-display" title={username}>👤 {username}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      {/* Main Chat Panel */}
      <main className="main-panel">
        {/* Header Bar */}
        <header className="header-bar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
              &#9776;
            </button>
            <div className="header-title-container">
              <h1 className="header-title">{threadTitle}</h1>
              <span className="header-subtitle">
                {activeDocuments.length > 0 ? 'Document RAG Context Active' : 'Santhosh AI Assistant'}
              </span>
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {errorMsg && (
          <div className="error-banner">
            <span>⚠️ {errorMsg}</span>
            <button className="error-close" onClick={() => setErrorMsg(null)}>×</button>
          </div>
        )}

        {/* Chat Area */}
        <div className="chat-window">
          {activeThreadId ? (
            <>
              {/* Messages Container */}
              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">🤖</div>
                    <h2 className="empty-state-title">How can I help you today?</h2>
                    <p className="empty-state-desc">
                      Type your message to chat, or click the attachment icon below to upload a document (.pdf or .txt) and ask questions about it.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isDocUpload = msg.content.startsWith('📄 [Document Uploaded:');
                    const displayContent = isDocUpload
                      ? `📄 ${msg.content.replace('📄 [Document Uploaded:', '').replace(']', '').trim()}`
                      : msg.content;
                    const displayRole = isDocUpload ? 'user' : msg.role;
                    return (
                      <div key={msg.id} className={`message-wrapper ${displayRole}`}>
                        <div className={`message-bubble ${isDocUpload ? 'doc-upload-bubble' : ''}`}>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{displayContent}</div>
                          <span className="message-time">{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                {isTyping && (
                  <div className="message-wrapper assistant">
                    <div className="typing-bubble">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area (ChatGPT Style Unified) */}
              <div className="input-panel">
                {pendingFile && (
                  <div className="doc-preview-container" style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <div className="doc-preview-pill" style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '10px', fontSize: '12px' }}>
                      <span>📄 {pendingFile.name} ⏳ (Waiting...)</span>
                      <button
                        type="button"
                        onClick={() => setPendingFile(null)}
                        style={{ background: 'transparent', border: 'none', color: '#e9d5ff', cursor: 'pointer', marginLeft: '6px', fontWeight: 'bold', fontSize: '14px', lineHeight: 1 }}
                        title="Discard draft"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}

                {isUploading && (
                  <div className="upload-loading-pill">
                    <div className="spinner"></div>
                    <span>Processing Document...</span>
                  </div>
                )}

                {/* Mode Selector Toggles */}
                <div className="mode-toggle-bullets">
                  <button
                    type="button"
                    className={`mode-toggle-btn ${chatMode === 'ai' ? 'active' : ''}`}
                    onClick={() => setChatMode('ai')}
                  >
                    ✨ AI Chat
                  </button>
                  <button
                    type="button"
                    className={`mode-toggle-btn ${chatMode === 'doc' ? 'active' : ''}`}
                    onClick={() => setChatMode('doc')}
                  >
                    📄 Document Chat
                  </button>
                </div>

                <form onSubmit={handleSendMessage} className="input-container">
                  {/* Paperclip attachment button inside input container (Only in Doc mode) */}
                  {chatMode === 'doc' && (
                    <>
                      <input
                        type="file"
                        id="unified-doc-upload"
                        accept=".pdf,.txt"
                        className="file-input"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        disabled={isTyping || isUploading}
                      />
                      <label
                        htmlFor="unified-doc-upload"
                        className="attach-btn"
                        title="Attach PDF or TXT"
                      >
                        📎
                      </label>
                    </>
                  )}

                  <textarea
                    className="chat-textarea"
                    placeholder={activeDocuments.length > 0 ? "Ask something about the documents..." : "Message..."}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isTyping || isUploading}
                  />
                  <button
                    type="submit"
                    className="send-btn"
                    disabled={(!inputValue.trim() && !pendingFile) || isTyping || isUploading}
                  >
                    🚀
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🤖</div>
              <h2 className="empty-state-title">Welcome </h2>
              <p className="empty-state-desc">
                Create a new chat session to start a conversation or analyze documents.
              </p>
              <button className="new-chat-btn" onClick={createNewThread} style={{ marginTop: '16px' }}>
                Create New Chat
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
