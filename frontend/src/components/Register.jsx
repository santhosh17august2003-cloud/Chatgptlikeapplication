import React, { useState } from 'react';

function Register({ 
  API_BASE_URL, 
  onRegisterSuccess, 
  onNavigateToLogin, 
  showError, 
  errorMsg, 
  setErrorMsg 
}) {
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validatePassword = (password) => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      return 'Password must be at least 8 characters long and contain at least: one uppercase letter (A-Z), one lowercase letter (a-z), one number (0-9), and one special character (e.g. !, @, #, $, %, &, *).';
    }
    return null;
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const passwordError = validatePassword(regPass);
    if (passwordError) {
      showError(passwordError);
      return;
    }

    if (regPass !== regConfirm) {
      showError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUser,
          email: regEmail,
          password: regPass
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      onRegisterSuccess();
      setRegUser('');
      setRegEmail('');
      setRegPass('');
      setRegConfirm('');
    } catch (err) {
      showError(err.message || 'Registration failed.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header-section">
          <div className="auth-logo">🤖</div>
          <h2 className="auth-title-text">Create Account</h2>
          <p className="auth-subtitle-text">Register to start using Gemini workspace</p>
        </div>

        {errorMsg && (
          <div className="otp-box-preview" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="auth-form-group">
          <div className="input-wrapper">
            <label className="input-label">Username</label>
            <input
              type="text"
              className="input-field"
              required
              placeholder="e.g. janesmith"
              value={regUser}
              onChange={e => setRegUser(e.target.value)}
            />
          </div>
          <div className="input-wrapper">
            <label className="input-label">Email Address</label>
            <input
              type="email"
              className="input-field"
              required
              placeholder="e.g. jane@example.com"
              value={regEmail}
              onChange={e => setRegEmail(e.target.value)}
            />
          </div>
          <div className="input-wrapper">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPass ? "text" : "password"}
                className="input-field"
                style={{ width: '100%', paddingRight: '40px' }}
                required
                placeholder="••••••••"
                value={regPass}
                onChange={e => setRegPass(e.target.value)}
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
          <div className="input-wrapper">
            <label className="input-label">Confirm Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showConfirm ? "text" : "password"}
                className="input-field"
                style={{ width: '100%', paddingRight: '40px' }}
                required
                placeholder="••••••••"
                value={regConfirm}
                onChange={e => setRegConfirm(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
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
                {showConfirm ? '👁️' : '🙈'}
              </button>
            </div>
          </div>
          <button type="submit" className="auth-submit-btn">Register</button>
        </form>

        <div className="auth-footer">
          <span>Already have an account? <a className="auth-link" onClick={onNavigateToLogin}>Login here</a></span>
        </div>
      </div>
    </div>
  );
}

export default Register;
