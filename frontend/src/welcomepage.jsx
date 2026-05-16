import React, { useState } from 'react';
import './WelcomePage.css';
import { Link } from 'react-router-dom';
import { GraduationCap, Menu, X } from "lucide-react";

export default function WelcomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(prev => !prev);
  const closeMenu = () => setMenuOpen(false);

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

      <header>
        <nav className="navbar">

          {/* Logo */}
          <div className="logo">
            <GraduationCap size={32} stroke="url(#logoGrad)" />
            <span>Smart Study Planner</span>
          </div>

          {/* Hamburger Button */}
          <button className="menu-btn" onClick={toggleMenu}>
            {menuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          {/* Nav Links */}
          <div className={`nav-links ${menuOpen ? 'active' : ''}`}>
            <a href="#features" className="nav-link" onClick={closeMenu}>Features</a>
            <Link to="/create-account" className="btn btn-secondary" onClick={closeMenu}>
              Sign Up
            </Link>
            <Link to="/SignIn" className="btn btn-secondary" onClick={closeMenu}>
              Sign In
            </Link>
          </div>

        </nav>
      </header>
      </div>
  );
} 
  

      