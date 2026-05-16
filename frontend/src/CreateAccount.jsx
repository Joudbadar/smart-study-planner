import React, { useState } from 'react';
import './CreateAccount.css';
import { Link } from 'react-router-dom';
import { signUp, getAuthErrorMessage } from "./services/AuthService";

const ALLOWED_DOMAINS = [
  'gmail.com', 'hotmail.com', 'outlook.com',
  'yahoo.com', 'ksu.edu.sa', 'icloud.com',
  'live.com', 'msn.com', 'protonmail.com' ,'student.ksu.edu.sa'
];

const isValidEmail = (email) => {
  const domain = email.split('@')[1];
  return ALLOWED_DOMAINS.includes(domain?.toLowerCase());
};

export default function CreateAccount() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleChange = (e) => {
  const { name, value } = e.target;
  setFormData(prev => ({ ...prev, [name]: value }));
  if (name === 'email') setError('');
  if (name === 'password') setError('');
  if (name === 'confirmPassword') setError('');
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isValidEmail(formData.email)) {
      setError('Invalid email format');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await signUp({
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
      });
      setVerificationSent(true);
    } catch (err) {
      setError(getAuthErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="create-account-container">
        <div className="create-account-wrapper">
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '60px', marginBottom: '16px' }}>📧</div>
            <h2 className="card-title">Check Your Email!</h2>
            <p style={{ color: '#666', margin: '12px 0 24px' }}>
              We sent a verification link to <strong>{formData.email}</strong>.
              <br />Please verify your email before signing in.
            </p>
            <Link to="/signin" className="btn btn-primary">
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-account-container">
      <div className="create-account-wrapper">
        <div className="page-header">
          <h1 className="page-title">Join StudyPlan</h1>
          <p className="page-description">
            Create your account and start organizing your studies
          </p>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Sign Up</h2>
            <p className="card-description">Join StudyPlan and start organizing your studies</p>
          </div>

          {error && (
            <div className="error-message"> {error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label"> Name *</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="form-input"
                placeholder="student@ksu.edu.sa"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="form-input"
                placeholder="Create a strong password (min 6 characters)"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="form-input"
                placeholder="Re-enter your password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>

            <div className="divider">OR</div>

            <Link to="/signin" className="btn btn-secondary">Sign In</Link>
          </form>
        </div>
      </div>
    </div>
  );
}