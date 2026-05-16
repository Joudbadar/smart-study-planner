import React from 'react';
import './WelcomePage.css';
import { Link } from 'react-router-dom';
import { GraduationCap } from "lucide-react";

export default function WelcomePage() {
  return (
    <div className="welcome-container">

      {/* Hidden SVG gradient for the logo */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E89B8E" />
            <stop offset="100%" stopColor="#E07856" />
          </linearGradient>
        </defs>
      </svg>

      <header>
        <nav className="navbar">
          <div className="logo">
            <GraduationCap size={32} stroke="url(#logoGrad)" />
            <span>Smart Study Planner</span>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <Link to="/create-account" className="btn btn-secondary">Sign Up</Link>
            <Link to="/SignIn" className="btn btn-secondary">Sign In</Link>
          </div>
        </nav>
      </header>

      <main>

        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content">
            <h1 className="hero-title">Plan Smarter, Study Better 🎯</h1>
            <p className="hero-subtitle">
              Transform your study routine with smart scheduling, personalized plans, and progress tracking. 
              Stay organized, meet deadlines, and achieve your academic goals effortlessly.
            </p>
          </div>

          <div className="hero-visual">
            <div className="mockup-preview">
              <div className="preview-header">
                <div className="preview-icon">📊</div>
                <div className="preview-text">
                  <h3>Your Study Dashboard</h3>
                  <p>Everything in one place</p>
                </div>
              </div>

              <div className="preview-stats">
                <div className="stat-box">
                  <div className="stat-number">24h</div>
                  <div className="stat-label">Study Hours</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number">87%</div>
                  <div className="stat-label">Completion</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number">12</div>
                  <div className="stat-label">Sessions Done</div>
                </div>
                <div className="stat-box">
                  <div className="stat-number">5</div>
                  <div className="stat-label">Deadlines</div>
                </div>
              </div>
            </div>

            <div className="floating-element floating-1 animate-float">
              ✅ Session completed! +2hrs
            </div>
            <div className="floating-element floating-2 animate-float-delayed">
              🔔 Deadline in 3 days
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features" id="features">
          <div className="section-header">
            <span className="section-tag">WHY CHOOSE US</span>
            <h2 className="section-title">Everything You Need to Excel</h2>
            <p className="section-description">
              Smart Study Planner combines intelligent scheduling, progress tracking, and deadline management 
              to help you stay on top of your studies.
            </p>
          </div>

          <div className="features-grid">

            <article className="feature-card">
              <div className="feature-icon" style={{background: 'linear-gradient(135deg, #FFE5D6 0%, #FFD6C8 100%)'}}>📅</div>
              <h3 className="feature-title">Smart Scheduling</h3>
              <p className="feature-description">
                AI-powered study plans that adapt to your courses, deadlines, and learning pace.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon" style={{background: 'linear-gradient(135deg, #D6F4E8 0%, #C8EDD9 100%)'}}>📊</div>
              <h3 className="feature-title">Progress Tracking</h3>
              <p className="feature-description">
                Visual insights into your study hours and performance trends.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon" style={{background: 'linear-gradient(135deg, #E5D6FF 0%, #D6C8FF 100%)'}}>🔔</div>
              <h3 className="feature-title">Deadline Manager</h3>
              <p className="feature-description">
                Never miss an assignment or exam again with smart reminders.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon" style={{background: 'linear-gradient(135deg, #FFE5E5 0%, #FFD6D6 100%)'}}>🎯</div>
              <h3 className="feature-title">Goal Setting</h3>
              <p className="feature-description">
                Set targets, track achievements, and stay motivated.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon" style={{background: 'linear-gradient(135deg, #C4D6FF 0%, #B8CAFF 100%)'}}>🔄</div>
              <h3 className="feature-title">Flexible Planning</h3>
              <p className="feature-description">
                Easily adjust your schedule and stay on track.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon" style={{background: 'linear-gradient(135deg, #B8E6D5 0%, #A7DEC9 100%)'}}>📱</div>
              <h3 className="feature-title">Multi-Platform</h3>
              <p className="feature-description">
                Access your study plans anywhere across devices.
              </p>
            </article>

          </div>
        </section>

        {/* CTA Section */}
        <section className="cta">
          <h2 className="cta-title">Ready to Transform Your Studies?</h2>
          <p className="cta-description">
            Join thousands of students who are studying smarter, not harder.
          </p>
          <div className="cta-buttons">
            <Link to="/create-account" className="btn btn-white">Get Started</Link>
          </div>
        </section>

      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <GraduationCap size={20} color="#fff" />
              Smart Study Planner
            </h4>
            <p style={{color: 'rgba(255, 255, 255, 0.7)', marginTop: '12px', maxWidth: '300px'}}>
              Empowering students to achieve their academic goals through intelligent planning.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          Smart Study Planner. All rights reserved.
        </div>
      </footer>

    </div>
  );
}