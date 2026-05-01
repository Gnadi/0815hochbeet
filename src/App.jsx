import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { seedPlantsToFirestore } from './data/seedPlants';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import BedPlanner from './pages/BedPlanner';
import SeasonSwitcher from './pages/SeasonSwitcher';
import AutoPlan from './pages/AutoPlan';
import PlantsPage from './pages/PlantsPage';
import './index.css';

function Guard({ children }) {
  const hasBeds = JSON.parse(localStorage.getItem('hb_beds') || '[]').length > 0;
  return hasBeds ? children : <Navigate to="/onboarding" replace />;
}

function AppRoutes() {
  const { user } = useAuth();

  // Seed plant data to Firestore once on first authenticated session
  useEffect(() => {
    if (user) seedPlantsToFirestore();
  }, [user]);

  const hasBeds = JSON.parse(localStorage.getItem('hb_beds') || '[]').length > 0;

  return (
    <Routes>
      <Route path="/" element={hasBeds ? <Navigate to="/dashboard" replace /> : <Navigate to="/onboarding" replace />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
      <Route path="/bed/:bedId" element={<Guard><BedPlanner /></Guard>} />
      <Route path="/bed/:bedId/seasons" element={<Guard><SeasonSwitcher /></Guard>} />
      <Route path="/autoplan" element={<Guard><AutoPlan /></Guard>} />
      <Route path="/plants" element={<Guard><PlantsPage /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
