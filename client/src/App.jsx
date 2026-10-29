import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Overview } from './pages/Overview';
import { AuthPage } from './pages/AuthPage';
import { lazy, Suspense } from 'react';
import { Loading } from './components/Status';
const Workspace = lazy(() =>
  import('./pages/Workspace').then((module) => ({ default: module.Workspace })),
);
import { Library } from './pages/Library';
import { CustomCode } from './pages/CustomCode';
import { NotFound } from './pages/ComingSoon';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="login" element={<AuthPage key="login" mode="login" />} />
        <Route path="register" element={<AuthPage key="register" mode="register" />} />
        <Route path="library" element={<Library />} />
        <Route path="custom-code" element={<CustomCode />} />
        <Route element={<ProtectedRoute />}>
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<Loading label="Opening your workspace…" />}>
                <Workspace />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
