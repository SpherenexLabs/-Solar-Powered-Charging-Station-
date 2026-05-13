import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import UserPanel from "./pages/UserPanel";
import AdminPanel from "./pages/AdminPanel";
import Login from "./pages/Login";

function AppRoutes() {
  const { currentUser, isAdmin } = useAuth();

  /* Not logged in → show login page */
  if (!currentUser) return <Login />;

  const admin = isAdmin();

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />

        {/* User panel — only for regular users */}
        <Route
          path="/user"
          element={admin ? <Navigate to="/admin" replace /> : <UserPanel />}
        />

        {/* Admin panel — only for admin */}
        <Route
          path="/admin"
          element={admin ? <AdminPanel /> : <Navigate to="/user" replace />}
        />

        {/* Catch-all: redirect based on role */}
        <Route
          path="*"
          element={<Navigate to={admin ? "/admin" : "/user"} replace />}
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
