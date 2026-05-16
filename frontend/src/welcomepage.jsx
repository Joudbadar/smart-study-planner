import React, { useState } from 'react';
import './WelcomePage.css';
import { Link } from 'react-router-dom';
import { GraduationCap, Menu, X } from "lucide-react";

export default function WelcomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(prev => !prev);
  const closeMenu  = () => setMenuOpen(false);

  return (
    <div className="welcome-container">

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E89B8E" />
            <stop offset="100%" stopColor="#E07856" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── Navbar ── */}
      <header>
        <nav className="navbar">
          <div className="logo">
            <GraduationCap size={32} stroke="url(#logoGrad)" />
            <span>Smart Study Planner</span>
          </div>

          <button className="menu-btn" onClick={toggleMenu}>
            {menuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          <div className={`nav-links ${menuOpen ? 'active' : ''}`}>
            <a href="#features" className="nav-link" onClick={closeMenu}>Features</a>
            <Link to="/create-account" className="btn btn-secondary" onClick={closeMenu}>Sign Up</Link>
            <Link to="/SignIn" className="btn btn-secondary" onClick={closeMenu}>Sign In</Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">Study Smarter,<br />Not Harder</h1>
          <p className="hero-subtitle">
            Your intelligent study companion that automatically schedules sessions,
            tracks progress, and keeps you on top of every deadline.
          </p>
          
        </div>

        <div className="hero-visual">
          <div className="mockup-preview">
            <div className="preview-header">
              <div className="preview-text">
                <h3>Smart Study Planner</h3>
                <p>Your AI-powered study assistant</p>
              </div>
            </div>
            <div className="preview-stats">
              <div className="stat-box">
                <div className="stat-number">12</div>
                <div className="stat-label">Study Sessions</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">85%</div>
                <div className="stat-label">Completion Rate</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">4</div>
                <div className="stat-label">Active Courses</div>
              </div>
              <div className="stat-box">
                <div className="stat-number">3</div>
                <div className="stat-label">Upcoming Tasks</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="features" id="features">
        <div className="section-header">
          <span className="section-tag">FEATURES</span>
          <h2 className="section-title">Everything You Need to Succeed</h2>
          <p className="section-description">
            Powerful tools designed to help students manage their time and achieve their academic goals.
          </p>
        </div>

        <div className="features-grid">
          {[
            { icon: '📅', title: 'Smart Scheduling', desc: 'Automatically generates optimized study sessions based on your availability and deadlines.', bg: 'linear-gradient(135deg, #ffeee6, #ffd4c4)' },
            { icon: '✅', title: 'Task Management', desc: 'Keep track of all your assignments and projects with priority-based organization.', bg: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)' },
            { icon: '📊', title: 'Progress Analytics', desc: 'Visualize your study patterns and completion rates with detailed analytics.', bg: 'linear-gradient(135deg, #e3f2fd, #bbdefb)' },
            { icon: '🔔', title: 'Smart Reminders', desc: 'Never miss a study session with intelligent notifications sent at the right time.', bg: 'linear-gradient(135deg, #fff3e0, #ffe0b2)' },
            { icon: '🔄', title: 'Auto Rescheduling', desc: 'Missed a session? The system automatically reschedules it to keep you on track.', bg: 'linear-gradient(135deg, #fce4ec, #f8bbd0)' },
            { icon: '🤖', title: 'AI Assistant', desc: 'Get instant help and study tips from your personal AI-powered study companion.', bg: 'linear-gradient(135deg, #f3e5f5, #e1bee7)' },
          ].map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon" style={{ background: f.bg }}>{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-description">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta">
        <h2 className="cta-title">Ready to Transform Your Study Habits?</h2>
        <p className="cta-description">
          Join students who are already studying smarter with Smart Study Planner.
        </p>
        <div className="cta-buttons">
          <Link to="/create-account" className="btn btn-white">Get Started</Link>
          
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Smart Study Planner</h4>
          </div>
          
          
        </div>
        <div className="footer-bottom">
          <p>© 2026 Smart Study Planner. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}