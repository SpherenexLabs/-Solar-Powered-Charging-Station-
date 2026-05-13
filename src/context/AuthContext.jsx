import { createContext, useContext, useEffect, useState } from "react";
import { ref, get, set } from "firebase/database";
import { db } from "../firebase";

const AuthContext  = createContext();
const SESSION_KEY  = "solarhub_uid";

export function useAuth() { return useContext(AuthContext); }

export const ADMIN_EMAIL = "admin@gmail.com";
export const ADMIN_PASS  = "admin@123";

/* Simple unique-id generator (no external library needed) */
function genUid() {
  return "user_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Find a user document by email — loads all users and filters client-side
   (avoids needing a Firebase .indexOn rule) */
async function findUserByEmail(email) {
  const snapshot = await get(ref(db, "Solar/Users"));
  if (!snapshot.exists()) return null;
  let found = null;
  snapshot.forEach((child) => {
    const data = child.val();
    if (data?.email?.toLowerCase() === email.toLowerCase()) {
      found = { uid: child.key, ...data };
    }
  });
  return found;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading]         = useState(true);

  /* ── Restore session on page load ── */
  useEffect(() => {
    const uid = localStorage.getItem(SESSION_KEY);
    if (!uid) { setLoading(false); return; }

    get(ref(db, `Solar/Users/${uid}`))
      .then((snap) => {
        if (snap.exists()) setCurrentUser({ uid, ...snap.val() });
        else               localStorage.removeItem(SESSION_KEY);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ── Helper: persist session ── */
  function startSession(userData) {
    localStorage.setItem(SESSION_KEY, userData.uid);
    setCurrentUser(userData);
  }

  /* ════════════════════════════════════════
     LOGIN
     Stores & checks credentials in Solar/Users
  ════════════════════════════════════════ */
  const login = async (email, password) => {
    const normEmail = email.trim().toLowerCase();

    let user = await findUserByEmail(normEmail);

    /* First-time admin auto-create */
    if (!user && normEmail === ADMIN_EMAIL && password === ADMIN_PASS) {
      const uid      = "admin_" + Date.now().toString(36);
      const adminDoc = {
        name: "Admin", email: ADMIN_EMAIL,
        password: ADMIN_PASS, role: "admin",
        displayName: "Admin",
        createdAt: new Date().toISOString()
      };
      await set(ref(db, `Solar/Users/${uid}`), adminDoc);
      startSession({ uid, ...adminDoc });
      return;
    }

    if (!user) {
      const e = new Error("No account found with this email."); e.code = "no-account"; throw e;
    }
    if (user.password !== password) {
      const e = new Error("Wrong password.");                   e.code = "wrong-password"; throw e;
    }

    startSession(user);
  };

  /* ════════════════════════════════════════
     REGISTER
     Saves new user to Solar/Users
  ════════════════════════════════════════ */
  const register = async (name, email, password) => {
    const normEmail = email.trim().toLowerCase();

    if (normEmail === ADMIN_EMAIL) {
      const e = new Error("That email is reserved for admin."); e.code = "reserved-email"; throw e;
    }

    const existing = await findUserByEmail(normEmail);
    if (existing) {
      const e = new Error("An account with this email already exists."); e.code = "email-in-use"; throw e;
    }

    const uid     = genUid();
    const userDoc = {
      name, email: normEmail, password,
      role: "user", displayName: name,
      createdAt: new Date().toISOString()
    };
    await set(ref(db, `Solar/Users/${uid}`), userDoc);
    startSession({ uid, ...userDoc });
  };

  /* ════════════════════════════════════════
     LOGOUT
  ════════════════════════════════════════ */
  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  };

  const isAdmin = () => currentUser?.role === "admin";

  return (
    <AuthContext.Provider value={{ currentUser, login, register, logout, isAdmin }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
