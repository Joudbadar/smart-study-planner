import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './SignIn.css';
import { signIn, getAuthErrorMessage } from "./services/AuthService";

const ALLOWED_DOMAINS = [
  'gmail.com', 'hotmail.com', 'outlook.com',
  'yahoo.com', 'ksu.edu.sa', 'icloud.com',
  'live.com', 'msn.com', 'protonmail.com'
];

const isValidEmail = (email) => {
  const domain = email.split('@')[1];
  return ALLOWED_DOMAINS.includes(domain?.toLowerCase());
};

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(email)) {
      setError('Invalid email format');
      return;
    }

    setLoading(true);

    try {
      await signIn({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <h1 className='app-title'>Smart Study Planner</h1>
      <div className="auth-card">

        <h1 className="auth-title">Sign In</h1>
        <p className="auth-subtitle">Welcome Back</p>

        {error && (
          <div className="error-message">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email<span className="required">*</span>
            </label>
            <input
              id="email"
              type="text"
              className="form-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password <span className="required">*</span>
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              required
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>

          <div className="signup-section">
            <span className="signup-text">Don't have an account?</span>
            <Link to="/create-account" className="signup-link">Sign Up</Link>
          </div>
        </form>

      </div>
    </div>
  );
}