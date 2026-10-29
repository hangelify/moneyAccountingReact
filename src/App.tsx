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
const ConfirmedBills = lazy(() =>
  import('@/pages/bills/ConfirmedBills').then((m) => ({
    default: m.ConfirmedBills,
  }))
);
const BillsCards = lazy(() =>
  import('@/pages/bills/BillsCards').then((m) => ({
    default: m.BillsCards,
  }))
);
const DraftBills = lazy(() =>
  import('@/pages/bills/DraftBills').then((m) => ({
    default: m.DraftBills,
  }))
);
const BillDetailDrawer = lazy(() =>
  import('@/pages/bills/BillDetailDrawer').then((m) => ({
    default: m.BillDetailDrawer,
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
            <Route
              path="/bills/confirmed"
              element={
                <RequireAuth>
                  <ConfirmedBills />
                </RequireAuth>
              }
            >
              <Route path=":id" element={<BillDetailDrawer />} />
            </Route>
            <Route
              path="/bills/drafts"
              element={
                <RequireAuth>
                  <DraftBills />
                </RequireAuth>
              }
            >
              <Route path=":id" element={<BillDetailDrawer />} />
            </Route>
            <Route
              path="/bills"
              element={
                <RequireAuth>
                  <BillsCards />
                </RequireAuth>
              }
            >
              <Route path=":id" element={<BillDetailDrawer />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
