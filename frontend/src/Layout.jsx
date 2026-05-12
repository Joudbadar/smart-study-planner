import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

const NAV_ITEMS = [
  { icon: '🏠', label: 'Dashboard',           path: '/dashboard'    },
  { icon: '📖', label: 'My Courses',           path: '/courses'      },
  { icon: '📅', label: 'Study Schedule',       path: '/schedule'     },
  { icon: '✅', label: 'Tasks & Deadlines',    path: '/tasks'        },
  { icon: '📊', label: 'Progress & Analytics', path: '/track'        },
  { icon: '🕒', label: 'Weekly Availability',  path: '/availability' },
  { icon: '📅', label: 'Study Plan',           path: '/study-plan'   },
];

const EMOJI_OPTIONS = ['\u{1F427}', '\u{1F428}', '\u{1F98A}', '\u{1F438}', '\u{1F98B}', '\u{1F43C}', '\u{1F984}', '\u{1F419}', '\u{1F981}', '\u{1F996}'];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [emoji, setEmoji] = useState('\u{1F427}');
  const profileRef = useRef(null);
  const menuRef = useRef(null);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setDisplayName(user.displayName || 'User');
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) setEmoji(snap.data().emoji || '\u{1F427}');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    setProfileOpen(false);
    navigate('/');
  };

  const handleEmojiChange = async (newEmoji) => {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;
    if (!user) return;
    setEmoji(newEmoji);
    await updateDoc(doc(db, "users", user.uid), { emoji: newEmoji });
  };

  return (
    <div className="dashboard">

      {/* ── Top Bar ── */}
      <header className="header">

        {/* Hamburger button — only visible on mobile */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#2d2d2d',
              padding: '4px 8px',
            }}
            className="hamburger-btn"
          >
            {menuOpen ? '✕' : '☰'}
          </button>

          {/* Dropdown nav menu */}
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
              {NAV_ITEMS.map(({ icon, label, path }) => (
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
                    color: location.pathname === path ? '#e67a5f' : '#2d2d2d',
                    fontWeight: location.pathname === path ? '700' : '500',
                    background: location.pathname === path ? '#fef6f4' : 'none',
                    fontSize: '14px',
                    borderBottom: '1px solid #fef0ec',
                    transition: 'background 0.2s',
                  }}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="logo">📚 Smart Study Planner</div>

        <div className="header-right">
          <div className="user-profile" ref={profileRef} style={{ position: 'relative' }}>
            <button
              className="profile-trigger"
              onClick={() => setProfileOpen(prev => !prev)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 8px', borderRadius: '8px', transition: 'background 0.2s',
              }}
            >
              <div className="user-avatar" style={{ fontSize: '22px', background: 'none' }}>
                {emoji}
              </div>
              <span className="user-name">{displayName}</span>
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
                <div style={{ padding: '6px 0' }}>
                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'block', width: '100%', padding: '9px 16px',
                      textAlign: 'left', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: '14px', color: '#e53e3e',
                      transition: 'background 0.15s',
                    }}
                  >
                    🚪 Log Out
                  </button>
                </div>

                <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                  <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px', marginTop: 0 }}>
                    Pick your emoji
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {EMOJI_OPTIONS.map(e => (
                      <button
                        key={e}
                        onClick={() => handleEmojiChange(e)}
                        style={{
                          fontSize: '18px',
                          background: emoji === e ? '#f0f0f0' : 'none',
                          border: emoji === e ? '2px solid #ccc' : '2px solid transparent',
                          borderRadius: '6px', cursor: 'pointer', padding: '2px',
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container">
        {/* ── Sidebar (desktop only) ── */}
        <aside className="sidebar">
          <nav>
            {NAV_ITEMS.map(({ icon, label, path }) => (
              <Link
                key={label}
                to={path}
                className={`nav-item ${location.pathname === path ? 'active' : ''}`}
              >
                <span className="nav-icon">{icon}</span>
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* ── Page content ── */}
        <main className="main-content">
          {children}
        </main>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .profile-trigger:hover { background: rgba(0,0,0,0.05) !important; }

        /* Show hamburger only on mobile */
        @media (max-width: 768px) {
          .hamburger-btn { display: block !important; }
          .user-name { display: none; }
        }
      `}</style>
    </div>
  );
}
