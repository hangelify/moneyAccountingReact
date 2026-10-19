import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import type { ReactElement } from 'react';
import { Header } from '@/components/Header';
import { RequireAuth } from '@/auth/RequireAuth';
import { LoadingFallback } from '@/components/common/LoadingFallback';

// Lazy load pages
const Home = lazy(() =>
  import('@/pages/home/Home').then((m) => ({ default: m.Home }))
);
const Dashboard = lazy(() =>
  import('@/pages/dashboard/Dashboard').then((m) => ({ default: m.Dashboard }))
);
const Login = lazy(() =>
  import('@/pages/auth/Login').then((m) => ({ default: m.Login }))
);
const Register = lazy(() =>
  import('@/pages/auth/Register').then((m) => ({ default: m.Register }))
);
const NewBillReview = lazy(() =>
  import('@/pages/bills/NewBillReview').then((m) => ({
    default: m.NewBillReview,
  }))
);

function App(): ReactElement {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/bills/review"
              element={
                <RequireAuth>
                  <NewBillReview />
                </RequireAuth>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
