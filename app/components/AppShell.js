"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

// The menu on the left. "Create User" is only shown to the owner.
const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/categories", label: "Create Category" },
  { href: "/exercises", label: "Add Exercise" },
  { href: "/log", label: "Workout History" },
  { href: "/users", label: "Create User", ownerOnly: true }
];

// Remember the owner check while moving between pages,
// so the server is not asked again on every click.
let ownerCache = null; // { userId, isOwner }

const WIDE_SCREEN = "(min-width: 800px)";
const MENU_KEY = "menuOpen";

function isWide() {
  return typeof window !== "undefined" && window.matchMedia(WIDE_SCREEN).matches;
}

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);

      if (ownerCache && ownerCache.userId === session.user.id) {
        setIsOwner(ownerCache.isOwner);
      } else {
        let owner = false;
        try {
          const res = await fetch("/api/create-user", {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          const json = await res.json();
          owner = Boolean(json.isOwner);
        } catch (e) {
          owner = false;
        }
        ownerCache = { userId: session.user.id, isOwner: owner };
        if (!active) return;
        setIsOwner(owner);
      }

      // Big screen: menu is open unless you hid it before (we remember that).
      // Phone: menu starts closed, so it never covers the page.
      let saved = null;
      try {
        saved = window.localStorage.getItem(MENU_KEY);
      } catch (e) {
        saved = null;
      }
      setMenuOpen(isWide() ? saved !== "0" : false);
      setReady(true);
    }
    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // Escape closes the menu on a phone
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !isWide()) setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleMenu() {
    const next = !menuOpen;
    setMenuOpen(next);
    if (isWide()) {
      try {
        window.localStorage.setItem(MENU_KEY, next ? "1" : "0");
      } catch (e) {
        /* ignore: the menu still works, it just will not be remembered */
      }
    }
  }

  async function handleSignOut() {
    ownerCache = null;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="wrap">
        <p className="sub">Loading…</p>
      </div>
    );
  }

  const links = LINKS.filter((l) => !l.ownerOnly || isOwner);

  return (
    <div className="shell">
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
      {menuOpen && (
        <aside className="sidebar" id="app-menu">
          <button className="ghost side-close" onClick={() => setMenuOpen(false)}>✕ Close</button>
          <nav aria-label="Main menu">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="side-link"
                aria-current={pathname === l.href ? "page" : undefined}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="side-signout">
            <button className="side-link" onClick={handleSignOut}>Sign out</button>
          </div>
        </aside>
      )}

      <div className="main">
        <div className="wrap">
          <div className="topbar">
            <div className="topbar-left">
              <button
                className="menu-toggle"
                onClick={toggleMenu}
                aria-expanded={menuOpen}
                aria-controls="app-menu"
                aria-label={menuOpen ? "Hide menu" : "Show menu"}
                title={menuOpen ? "Hide menu" : "Show menu"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="menu-toggle-text">{menuOpen ? "Hide menu" : "Show menu"}</span>
              </button>
              <div>
                <h1>🏋️ Workout Log</h1>
                <div className="sub">{user?.email}</div>
              </div>
            </div>
          </div>

          {typeof children === "function" ? children({ user, isOwner }) : children}
        </div>
      </div>
    </div>
  );
}
