import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import React from 'react';
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  CalendarDays,
  BarChart3,
  GraduationCap,
  User,
  LogOut,
} from "lucide-react";


import NotificationBell from './NotificationBell'; 

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',           path: '/dashboard' },
  { icon: BookOpen,        label: 'My Courses',          path: '/courses' },
  { icon: CheckSquare,     label: 'Tasks & Deadlines',   path: '/tasks' },
  { icon: CalendarDays,    label: 'Study Schedule',      path: '/schedule' },
  { icon: BarChart3,       label: 'Progress & Analytics',path: '/track' },
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [isDesktop,   setIsDesktop]   = useState(window.innerWidth >= 750);

  const [name, setName] = useState(localStorage.getItem('userName') || 'User');

  const profileRef = useRef(null);
  const menuRef    = useRef(null);

  // Load user data from Firestore on auth
  useEffect(() => {
    const auth = getAuth();
    const db   = getFirestore();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) {
            setName(data.name);
            localStorage.setItem('userName', data.name);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (menuRef.current    && !menuRef.current.contains(e.target))    setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track viewport width for sidebar visibility
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 750);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = async () => {
    await signOut(getAuth());
    setProfileOpen(false);
    navigate('/');
  };

  return (
    <div className="dashboard">

      {/* Hidden SVG gradient for the GraduationCap icon */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#e67a5f" />
            <stop offset="100%" stopColor="#ee9b85" />
          </linearGradient>
        </defs>
      </svg>

      {/* ── Top Bar ── */}
      <header className="header">

        {/* Hamburger — mobile only */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            className="hamburger-btn"
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#2d2d2d',
              padding: '4px 8px',
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>

          {/* Mobile dropdown nav */}
          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              background: '#fff',
              border: '1px solid #fde0d6',
              borderRadius: '14px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              minWidth: '220px',
              zIndex: 1000,
              overflow: 'hidden',
              animation: 'fadeSlideIn 0.2s ease',
            }}>
              {NAV_ITEMS.map(({ icon: Icon, label, path }) => ( // eslint-disable-line no-unused-vars
                <Link
                  key={label}
                  to={path}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 18px',
                    textDecoration: 'none',
                    color:      location.pathname === path ? '#e67a5f' : '#2d2d2d',
                    fontWeight: location.pathname === path ? '700'     : '500',
                    background: location.pathname === path ? '#fef6f4' : 'none',
                    fontSize: '14px',
                    borderBottom: '1px solid #fef0ec',
                    transition: 'background 0.2s',
                  }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GraduationCap size={28} stroke="url(#logoGrad)" />
          <span style={{
            fontSize: '1.5rem',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #e67a5f, #ee9b85)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Smart Study Planner
          </span>
        </div>

        {/* Header right: bell + profile */}
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

         
          <NotificationBell />

          {/* Profile dropdown */}
          <div className="user-profile" ref={profileRef} style={{ position: 'relative', padding: '4px 8px', borderRadius: '999px', transition: 'background 0.2s, border 0.2s', border: '1.5px solid transparent', cursor: 'pointer' }}>
            <button
              className="profile-trigger"
              onClick={() => setProfileOpen(prev => !prev)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0',
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #fde0d6, #fef6f4)',
                border: '1.5px solid #e67a5f',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <User size={16} color="#e67a5f" />
              </div>
              <span className="user-name">{name}</span>
              <span style={{
                fontSize: '10px', color: '#888', transition: 'transform 0.2s',
                transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                display: 'inline-block',
              }}>▼</span>
            </button>

            {profileOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '180px',
                zIndex: 1000, overflow: 'hidden', animation: 'fadeSlideIn 0.15s ease',
              }}>
                {/* User info row */}
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #fde0d6, #fef6f4)',
                    border: '1.5px solid #e67a5f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <User size={18} color="#e67a5f" />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#2d2d2d' }}>{name}</span>
                </div>

                {/* Log out */}
                <div style={{ padding: '6px 0' }}>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      width: '100%', padding: '9px 16px',
                      textAlign: 'left', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '14px', color: '#e53e3e',
                      transition: 'background 0.15s',
                    }}
                  >
                    <LogOut size={15} />
                    Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="w-full flex">
        {/* Fixed Sidebar — desktop only */}
        <aside
          className="fixed top-0 left-0 h-screen bg-white overflow-y-auto shadow-md"
          style={{ width: '16rem', paddingTop: '120px', display: isDesktop ? 'block' : 'none' }}
        >
          <div>
            {NAV_ITEMS.map(({ icon: Icon, label, path }) => ( // eslint-disable-line no-unused-vars
              <Link
                key={label}
                to={path}
                className={`nav-item ${location.pathname === path ? 'active' : ''}`}
              >
                <span className="nav-icon"><Icon size={18} /></span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </aside>

        {/* Page Content */}
        <main
          className="flex-1 min-w-0 min-h-screen"
          style={{ marginLeft: isDesktop ? '16rem' : '0', padding: '2rem' }}
        >
          {children}
        </main>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .profile-trigger:hover { background: none !important; }
        .profile-trigger:focus { outline: none; }
        .user-profile:hover, .user-profile:focus-within { background: rgba(230, 122, 95, 0.08); border-color: #e67a5f !important; }

        @media (max-width: 768px) {
          .hamburger-btn { display: block !important; }
          .user-name { display: none; }
        }
      `}</style>
    </div>
  );
}