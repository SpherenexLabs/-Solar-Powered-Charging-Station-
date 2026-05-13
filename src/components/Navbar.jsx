import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { currentUser, logout, isAdmin } = useAuth();

  const admin       = isAdmin();
  const displayName = currentUser?.name || currentUser?.email?.split("@")[0] || "User";
  const initial     = displayName.charAt(0).toUpperCase();

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <div className="brand-icon">☀️</div>
        <div>
          <h2>SolarHub</h2>
          <span>Smart Charging Station</span>
        </div>
      </Link>

      <nav className="menu">
        <NavLink to="/">Home</NavLink>

        {/* Admin sees only Admin Panel, regular user sees only User Panel */}
        {admin
          ? <NavLink to="/admin">Admin Panel</NavLink>
          : <NavLink to="/user">User Panel</NavLink>
        }
      </nav>

      <div className="nav-right">
        <div className="nav-live">
          <span className="live-dot" />
          <span className="live-label">Live</span>
        </div>

        <div className="nav-user">
          <div className="nav-avatar">{initial}</div>
          <div className="nav-user-info">
            <span className="nav-user-name">{displayName}</span>
            <span className="nav-user-role">{admin ? "Admin" : "User"}</span>
          </div>
        </div>

        <button className="nav-logout" onClick={logout} title="Sign out">⏻</button>
      </div>
    </header>
  );
}

export default Navbar;
