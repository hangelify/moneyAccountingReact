import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { Header } from '@/components/Header';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { LoadingFallback } from '@/components/common/LoadingFallback';

// Lazy load pages
const HouseholdsPage = lazy(() =>
  import('@/pages/households/HouseholdsPage').then((m) => ({
    default: m.HouseholdsPage,
  }))
);
const CategoryLimitsPage = lazy(() =>
  import('@/pages/households/limits/CategoryLimitsPage').then((m) => ({
    default: m.CategoryLimitsPage,
  }))
);
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
const DuplicateSuggestions = lazy(() =>
  import('@/pages/bills/DuplicateSuggestions').then((m) => ({
    default: m.DuplicateSuggestions,
  }))
);
const BillDetailRoute = lazy(() =>
  import('@/pages/bills/BillDetailRoute').then((m) => ({
    default: m.BillDetailRoute,
  }))
);

// Component showcase (HAN-107): dev builds only. In production the condition
// is a constant false and Vite drops the import with the page.
const DevUi = import.meta.env.DEV
  ? lazy(() =>
      import('@/pages/dev/ui/DevUiPage').then((m) => ({
        default: m.DevUiPage,
      }))
    )
  : null;

const guard = (page: ReactElement): ReactElement => (
  <RequireAuth>{page}</RequireAuth>
);

function App(): ReactElement {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={guard(<Dashboard />)} />
            <Route path="/bills/review" element={guard(<NewBillReview />)} />
            <Route path="/bills/confirmed" element={guard(<ConfirmedBills />)}>
              <Route path=":id" element={<BillDetailRoute />} />
            </Route>
            <Route path="/bills/drafts" element={guard(<DraftBills />)}>
              <Route path=":id" element={<BillDetailRoute />} />
            </Route>
            <Route
              path="/bills/duplicates"
              element={guard(<DuplicateSuggestions />)}
            />
            <Route path="/bills" element={guard(<BillsCards />)}>
              <Route path=":id" element={<BillDetailRoute />} />
            </Route>
            <Route path="/households" element={guard(<HouseholdsPage />)} />
            <Route
              path="/households/:id/limits"
              element={guard(<CategoryLimitsPage />)}
            />
            <Route
              path="/households/settings"
              element={<Navigate to="/households" replace />}
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {DevUi && <Route path="/dev/ui" element={<DevUi />} />}
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
