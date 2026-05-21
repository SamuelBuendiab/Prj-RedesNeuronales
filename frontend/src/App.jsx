import { Navigate, Route, Routes } from "react-router-dom";
import { setAuthToken } from "./api/client.js";
import Dashboard from "./pages/Dashboard.jsx";
import History from "./pages/History.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

const token = localStorage.getItem("carsia_token");
if (token) setAuthToken(token);

function Protected({ children }) {
  const t = localStorage.getItem("carsia_token");
  if (!t) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <Protected>
            <Navigate to="/dashboard" replace />
          </Protected>
        }
      />
      <Route
        path="/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/historial"
        element={
          <Protected>
            <History />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
