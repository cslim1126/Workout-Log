"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

// The menu on the left, in two parts.
// The pages everyone uses are on top. The pages for managing people
// are at the bottom, and each one needs a permission from the person's role.
const TOP_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/exercises", label: "Create Exercise" },
  { href: "/log-set", label: "Log a Set" },
  { href: "/programs", label: "Programs" },
  { href: "/log", label: "Workout History" },
  { href: "/profile", label: "Profile" }
];

const BOTTOM_LINKS = [
  { href: "/users", label: "Create User", needs: ["users.create"] },
  { href: "/access", label: "User Access Management", needs: ["users.create", "users.remove", "roles.manage", "groups.manage"] },
  { href: "/roles", label: "Roles & Permissions", needs: ["roles.manage"] }
];

// Remember the owner/admin check while moving between pages,
// so the server is not asked again on every click.
let adminCache = null; // { userId, isOwner, permissions }

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
  const [permissions, setPermissions] = useState([]);
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

      if (adminCache && adminCache.userId === session.user.id) {
        setIsOwner(adminCache.isOwner);
        setPermissions(adminCache.permissions);
      } else {
        let owner = false;
        let perms = [];
        try {
          const res = await fetch("/api/create-user", {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          const json = await res.json();
          owner = Boolean(json.isOwner);
          perms = Array.isArray(json.permissions) ? json.permissions : [];
        } catch (e) {
          owner = false;
          perms = [];
        }
        adminCache = { userId: session.user.id, isOwner: owner, permissions: perms };
        if (!active) return;
        setIsOwner(owner);
        setPermissions(perms);
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
    adminCache = null;
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

    const can = (key) => isOwner || permissions.includes(key);
  const topLinks = TOP_LINKS.filter((l) => !l.needs || l.needs.some(can));
  const bottomLinks = BOTTOM_LINKS.filter((l) => !l.needs || l.needs.some(can));
  const fullName = user && user.user_metadata ? user.user_metadata.full_name : "";

  return (
    <div className="shell">
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
      {menuOpen && (
        <aside className="sidebar" id="app-menu">
          <button className="ghost side-close" onClick={() => setMenuOpen(false)}>✕ Close</button>
          <nav aria-label="Main menu">
            {topLinks.map((l) => (
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
          {bottomLinks.length > 0 && (
            <nav className="side-group" aria-label="Manage people">
              <div className="side-group-title">Manage</div>
              {bottomLinks.map((l) => (
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
          )}
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
                <div className="sub">{fullName ? `${fullName} · ${user?.email}` : user?.email}</div>
              </div>
            </div>
          </div>

          {typeof children === "function" ? children({ user, isOwner, permissions, can }) : children}
        </div>
      </div>
    </div>
  );
}
