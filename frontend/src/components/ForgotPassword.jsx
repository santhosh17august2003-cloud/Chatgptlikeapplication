import React, { useState } from 'react';

function ForgotPassword({
  API_BASE_URL,
  onSuccessRedirectToLogin,
  onNavigateToLogin,
  showError,
  errorMsg,
  setErrorMsg
}) {
  const [forgotUser, setForgotUser] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotPass, setForgotPass] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [otpStep, setOtpStep] = useState(1); // 1 = Request, 2 = Verify, 3 = Reset
  const [otpToken, setOtpToken] = useState(null);
  const [debugOtp, setDebugOtp] = useState('');
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

  const handleRequestOtpSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUser })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to request code');
      }

      setDebugOtp(data.otp_debug || '');
      setOtpStep(2);
    } catch (err) {
      showError(err.message || 'Failed to request OTP code.');
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: forgotUser,
          otp: forgotOtp
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setOtpToken(data.otp_token);
      setOtpStep(3);
    } catch (err) {
      showError(err.message || 'Verification code is invalid.');
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const passwordError = validatePassword(forgotPass);
    if (passwordError) {
      showError(passwordError);
      return;
    }

    if (forgotPass !== forgotConfirm) {
      showError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp_token: otpToken,
          password: forgotPass
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      onSuccessRedirectToLogin();
      setForgotUser('');
      setForgotOtp('');
      setForgotPass('');
      setForgotConfirm('');
      setOtpStep(1);
      setOtpToken(null);
      setDebugOtp('');
    } catch (err) {
      showError(err.message || 'Reset failed.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header-section">
          <div className="auth-logo">🔑</div>
          <h2 className="auth-title-text">Reset Password</h2>
          <p className="auth-subtitle-text">Recover your account using a 6-digit OTP code</p>
        </div>

        <div className="step-container">
          <div className={`step-dot ${otpStep >= 1 ? 'active' : ''}`}></div>
          <div className={`step-dot ${otpStep >= 2 ? 'active' : ''}`}></div>
          <div className={`step-dot ${otpStep >= 3 ? 'active' : ''}`}></div>
        </div>

        {errorMsg && (
          <div className="otp-box-preview" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {otpStep === 1 && (
          <form onSubmit={handleRequestOtpSubmit} className="auth-form-group">
            <div className="input-wrapper">
              <label className="input-label">Username / Email</label>
              <input
                type="text"
                className="input-field"
                required
                placeholder="Enter username or email to send OTP"
                value={forgotUser}
                onChange={e => setForgotUser(e.target.value)}
              />
            </div>
            <button type="submit" className="auth-submit-btn">Send OTP Code</button>
          </form>
        )}

        {otpStep === 2 && (
          <form onSubmit={handleVerifyOtpSubmit} className="auth-form-group">
            <div className="input-wrapper">
              <label className="input-label">Enter 6-Digit OTP</label>
              <input
                type="text"
                className="input-field"
                required
                maxLength="6"
                placeholder="123456"
                value={forgotOtp}
                onChange={e => setForgotOtp(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className="auth-submit-btn" style={{ flex: 1, margin: 0 }}>Verify Code</button>
              <button 
                type="button" 
                onClick={() => handleRequestOtpSubmit()} 
                className="auth-submit-btn" 
                style={{ 
                  flex: 1, 
                  margin: 0,
                  background: 'rgba(255, 255, 255, 0.08)', 
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'var(--text-muted)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                  e.target.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.target.style.color = 'var(--text-muted)';
                }}
              >
                Resend OTP
              </button>
            </div>
          </form>
        )}

        {otpStep === 3 && (
          <form onSubmit={handleResetPasswordSubmit} className="auth-form-group">
            <div className="input-wrapper">
              <label className="input-label">New Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPass ? "text" : "password"}
                  className="input-field"
                  style={{ width: '100%', paddingRight: '40px' }}
                  required
                  placeholder="••••••••"
                  value={forgotPass}
                  onChange={e => setForgotPass(e.target.value)}
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
              <label className="input-label">Confirm New Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  className="input-field"
                  style={{ width: '100%', paddingRight: '40px' }}
                  required
                  placeholder="••••••••"
                  value={forgotConfirm}
                  onChange={e => setForgotConfirm(e.target.value)}
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
            <button type="submit" className="auth-submit-btn">Reset Password</button>
          </form>
        )}

        <div className="auth-footer">
          <a className="auth-link" onClick={onNavigateToLogin}>Back to Login</a>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
