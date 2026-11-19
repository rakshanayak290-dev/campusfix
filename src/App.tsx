import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminPortal } from './pages/admin/AdminPortal';
import { AuthPages } from './pages/AuthPages';
import { LandingPage } from './pages/LandingPage';
import { StudentPortal } from './pages/student/StudentPortal';

function RouterView() {
  const { firebaseUser, isAdmin, authReady } = useAuth();
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [historyStack, setHistoryStack] = useState<string[]>(() => [
    window.location.pathname || '/',
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const current = window.location.pathname || '/';
      setPathname(current);
      setHistoryStack((prev) => (prev[prev.length - 1] === current ? prev : [...prev, current]));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const canonicalUrl = `${window.location.origin}${pathname}`;
    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    let ogUrlMeta = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrlMeta) {
      ogUrlMeta = document.createElement('meta');
      ogUrlMeta.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrlMeta);
    }
    ogUrlMeta.setAttribute('content', canonicalUrl);
  }, [pathname]);

  const navigate = (nextPath: string) => {
    if (nextPath !== pathname) {
      window.history.pushState({}, '', nextPath);
      setPathname(nextPath);
      setHistoryStack((prev) => [...prev, nextPath]);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const goBack = (fallback = '/dashboard') => {
    const trimmed = [...historyStack];
    trimmed.pop(); // remove current page
    while (
      trimmed.length > 0 &&
      (trimmed[trimmed.length - 1] === '/login' ||
        trimmed[trimmed.length - 1] === '/register' ||
        trimmed[trimmed.length - 1] === '/admin-login' ||
        trimmed[trimmed.length - 1] === pathname)
    ) {
      trimmed.pop();
    }
    const target = trimmed[trimmed.length - 1] || fallback;
    window.history.pushState({}, '', target);
    setPathname(target);
    setHistoryStack(trimmed.length > 0 ? trimmed : [target]);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#3867F5] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Loading CampusFix...</p>
        </div>
      </div>
    );
  }

  // Public landing page
  if (pathname === '/' || pathname === '') {
    return <LandingPage onNavigate={navigate} />;
  }

  // Auth routes
  if (pathname === '/login') {
    if (firebaseUser) {
      return isAdmin ? (
        <AdminPortal section="dashboard" onNavigate={navigate} />
      ) : (
        <StudentPortal section="overview" onNavigate={navigate} onBack={() => goBack('/')} />
      );
    }
    return <AuthPages mode="login" onNavigate={navigate} />;
  }

  if (pathname === '/register') {
    if (firebaseUser) {
      return isAdmin ? (
        <AdminPortal section="dashboard" onNavigate={navigate} />
      ) : (
        <StudentPortal section="overview" onNavigate={navigate} onBack={() => goBack('/')} />
      );
    }
    return <AuthPages mode="register" onNavigate={navigate} />;
  }

  if (pathname === '/admin-login') {
    if (firebaseUser && isAdmin) {
      return <AdminPortal section="dashboard" onNavigate={navigate} />;
    }
    return <AuthPages mode="admin-login" onNavigate={navigate} />;
  }

  // Protected Student Portal routes
  if (pathname.startsWith('/dashboard')) {
    if (!firebaseUser) {
      return <AuthPages mode="login" onNavigate={navigate} />;
    }
    if (pathname === '/dashboard/report') {
      return (
        <StudentPortal section="report" onNavigate={navigate} onBack={() => goBack('/dashboard')} />
      );
    }
    if (pathname === '/dashboard/complaints') {
      return (
        <StudentPortal
          section="complaints"
          onNavigate={navigate}
          onBack={() => goBack('/dashboard')}
        />
      );
    }
    if (pathname === '/dashboard/track') {
      return (
        <StudentPortal section="track" onNavigate={navigate} onBack={() => goBack('/dashboard')} />
      );
    }
    if (pathname === '/dashboard/cohort') {
      return (
        <StudentPortal
          section="cohort"
          onNavigate={navigate}
          onBack={() => goBack('/dashboard')}
        />
      );
    }
    if (pathname === '/dashboard/notifications') {
      return (
        <StudentPortal
          section="notifications"
          onNavigate={navigate}
          onBack={() => goBack('/dashboard')}
        />
      );
    }
    if (pathname === '/dashboard/profile') {
      return (
        <StudentPortal
          section="profile"
          onNavigate={navigate}
          onBack={() => goBack('/dashboard')}
        />
      );
    }
    return <StudentPortal section="overview" onNavigate={navigate} onBack={() => goBack('/')} />;
  }

  // Protected Administrator Portal routes
  if (pathname.startsWith('/admin')) {
    if (!firebaseUser) {
      return <AuthPages mode="admin-login" onNavigate={navigate} />;
    }
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-[#EF5350]/10 text-[#EF5350] flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="font-display font-bold text-xl text-[#142B4A]">
              Administrator Access Required
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Your current account does not have administrator privileges. Student accounts are
              restricted from accessing campus administration consoles.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2.5 rounded-lg bg-[#3867F5] text-white text-sm font-semibold hover:bg-[#2955d9] cursor-pointer"
              >
                Go to Student Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-[#142B4A] hover:bg-slate-50 cursor-pointer"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (pathname === '/admin/complaints') {
      return <AdminPortal section="all" onNavigate={navigate} />;
    }
    if (pathname === '/admin/pending') {
      return <AdminPortal section="pending" onNavigate={navigate} />;
    }
    if (pathname === '/admin/in-progress') {
      return <AdminPortal section="in-progress" onNavigate={navigate} />;
    }
    if (pathname === '/admin/resolved') {
      return <AdminPortal section="resolved" onNavigate={navigate} />;
    }
    if (pathname === '/admin/students') {
      return <AdminPortal section="students" onNavigate={navigate} />;
    }
    if (pathname === '/admin/analytics') {
      return <AdminPortal section="analytics" onNavigate={navigate} />;
    }
    if (pathname === '/admin/settings') {
      return <AdminPortal section="settings" onNavigate={navigate} />;
    }
    return <AdminPortal section="dashboard" onNavigate={navigate} />;
  }

  return <LandingPage onNavigate={navigate} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterView />
      </AuthProvider>
    </ErrorBoundary>
  );
}
