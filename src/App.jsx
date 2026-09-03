import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { seedPlantsToFirestore } from './data/seedPlants';
import { setSyncUser } from './lib/beds';
import { pruneAutoDone } from './lib/tasks';
import { useBeds } from './hooks/useBeds';
import { applyTheme, getStoredTheme, T } from './theme';
import { LogoMark } from './components/Logo';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import BedPlanner from './pages/BedPlanner';
import SeasonSwitcher from './pages/SeasonSwitcher';
import AutoPlan from './pages/AutoPlan';
import CalendarPage from './pages/CalendarPage';
import PlantsPage from './pages/PlantsPage';
import BeetsOverview from './pages/BeetsOverview';
import './index.css';

function Splash() {
  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
      <LogoMark size={64} />
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:T.inkMute, letterSpacing:'0.1em' }}>HOCHBEET-PLANER</div>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  const beds = useBeds();
  // `null` until we know whether the account has beds waiting in Firestore —
  // routing before that would bounce returning users into onboarding.
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (user === undefined) return;
    let cancelled = false;
    (async () => {
      await setSyncUser(user?.uid || null);
      if (!cancelled) setSynced(true);
    })();
    if (user) seedPlantsToFirestore();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => { pruneAutoDone(); }, []);

  if (user === undefined || !synced) return <Splash />;

  const hasBeds = beds.length > 0;
  // Deliberately a helper that returns an element, not a component defined in
  // render — a fresh component type on every render would remount the whole
  // page and throw away its state on each store update.
  // eslint-disable-next-line no-unused-vars
  const guard = (element) => (hasBeds ? element : <Navigate to="/onboarding" replace />);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={hasBeds ? '/dashboard' : '/onboarding'} replace />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/dashboard" element={guard(<Dashboard />)} />
      <Route path="/bed/:bedId" element={guard(<BedPlanner />)} />
      <Route path="/bed/:bedId/seasons" element={guard(<SeasonSwitcher />)} />
      <Route path="/autoplan" element={<AutoPlan />} />
      <Route path="/calendar" element={guard(<CalendarPage />)} />
      <Route path="/plants" element={<PlantsPage />} />
      <Route path="/beds" element={guard(<BeetsOverview />)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => { applyTheme(getStoredTheme()); }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
