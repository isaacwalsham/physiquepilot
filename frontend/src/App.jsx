import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./layouts/AppLayout";
import WeightTracking from "./pages/WeightTracking";
import Nutrition from "./pages/Nutrition";
import CardioSteps from "./pages/CardioSteps";
import Training from "./pages/Training";
import CheckIns from "./pages/CheckIns";
import Coach from "./pages/Coach";
import Settings from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app/onboarding" element={<Onboarding />} />

      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="weight" element={<WeightTracking />} />
        <Route path="nutrition" element={<Nutrition />} />
        <Route path="training" element={<Training />} />
        <Route path="cardio-steps" element={<CardioSteps />} />
        <Route path="check-ins" element={<CheckIns />} />
        <Route path="coach" element={<Coach />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;