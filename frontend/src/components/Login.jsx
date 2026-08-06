import React, { useState } from 'react';

function Login({ 
  API_BASE_URL, 
  onLoginSuccess, 
  onNavigateToRegister, 
  onNavigateToForgot, 
  showError, 
  errorMsg, 
  setErrorMsg 
}) {
  const [loginUser, setLoginUser] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUser,
          password: loginPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.token, data.username);
      setLoginUser('');
      setLoginPassword('');
    } catch (err) {
      showError(err.message || 'Login failed.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header-section">
          <div className="auth-logo">🤖</div>
          <h2 className="auth-title-text">Welcome Back</h2>
          <p className="auth-subtitle-text">Log in to enter your chat session</p>
        </div>

        {errorMsg && (
          <div className="otp-box-preview" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="auth-form-group">
          <div className="input-wrapper">
            <label className="input-label">Username / Email</label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="Enter username or email"
              value={loginUser}
              onChange={e => setLoginUser(e.target.value)}
            />
          </div>
          <div className="input-wrapper">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="input-label">Password</label>
              <a className="auth-link" style={{ fontSize: '11px' }} onClick={onNavigateToForgot}>
                Forgot Password?
              </a>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPass ? "text" : "password"}
                className="input-field"
                style={{ width: '100%', paddingRight: '40px' }}
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none'
                }}
              >
                {showPass ? '👁️' : '🙈'}
              </button>
            </div>
          </div>
          <button type="submit" className="auth-submit-btn">Log In</button>
        </form>

        <div className="auth-footer">
          <span>New user? <a className="auth-link" onClick={onNavigateToRegister}>Register Account</a></span>
        </div>
      </div>
    </div>
  );
}

export default Login;
