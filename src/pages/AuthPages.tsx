import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { BrandLogo } from '../components/ui/BrandLogo';
import { UsnSelector } from '../components/ui/UsnSelector';
import { useAuth } from '../context/AuthContext';
import { subscribePublicStats } from '../services/campusService';
import { DEPARTMENTS, MAX_STUDENT_COHORT_CAPACITY } from '../types/campusfix';

interface AuthPageProps {
  mode: 'login' | 'register' | 'admin-login';
  onNavigate: (path: string) => void;
}

export function AuthPages({ mode, onNavigate }: AuthPageProps) {
  const { registerStudent, loginWithEmail, loginWithGoogle, sendPasswordReset } = useAuth();

  // Shared state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);

  // Registration specific fields
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('4AL25CS122');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registeredStudents, setRegisteredStudents] = useState(0);
  const [goToReportAfterRegister, setGoToReportAfterRegister] = useState(true);

  useEffect(() => {
    if (mode !== 'register') return;
    const unsub = subscribePublicStats((stats) => {
      setRegisteredStudents(Number(stats.registeredStudents ?? 0));
    });
    return () => unsub();
  }, [mode]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const portal = mode === 'admin-login' ? 'admin' : 'student';
      await loginWithGoogle(portal);
      onNavigate(
        portal === 'admin'
          ? '/admin'
          : mode === 'register' && goToReportAfterRegister
            ? '/dashboard/report'
            : '/dashboard'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (forgotMode) {
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter your college email address to reset your password.');
        return;
      }
      setLoading(true);
      try {
        await sendPasswordReset(email);
        setInfoMessage('Password reset instructions have been sent to your email.');
        setForgotMode(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send reset email.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      if (registeredStudents >= MAX_STUDENT_COHORT_CAPACITY) {
        setError('Student registration has reached the 500-member cohort capacity.');
        return;
      }
      if (fullName.trim().length < 2) {
        setError('Please enter your full name.');
        return;
      }
      if (studentId.trim().length < 2) {
        setError('Please enter your Student ID.');
        return;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid college email address.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      setLoading(true);
      try {
        await registerStudent({
          fullName,
          studentId,
          email,
          department,
          password,
        });
        onNavigate(goToReportAfterRegister ? '/dashboard/report' : '/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Student Login or Admin Login
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const portal = mode === 'admin-login' ? 'admin' : 'student';
      await loginWithEmail(email, password, rememberMe, portal);
      onNavigate(portal === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const isAdminPortal = mode === 'admin-login';

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-8 ${
        isAdminPortal ? 'bg-[#142B4A]' : 'bg-[#F7F9FC]'
      }`}
    >
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <BrandLogo inverted={isAdminPortal} onClick={() => onNavigate('/')} />
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer ${
            isAdminPortal ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-[#142B4A]'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      <div className="my-8 flex items-center justify-center">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {!isAdminPortal && !forgotMode && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 mb-5">
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-[#142B4A] shadow-sm'
                    : 'text-slate-600 hover:text-[#142B4A]'
                }`}
              >
                Student Sign In
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-[#142B4A] shadow-sm'
                    : 'text-slate-600 hover:text-[#142B4A]'
                }`}
              >
                New Student (Register)
              </button>
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            {isAdminPortal ? (
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#3867F5] mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Restricted Operations Portal</span>
              </div>
            ) : (
              <p className="text-xs font-semibold text-[#3867F5] mb-1.5">
                Student Portal · Open to All 500 Students
              </p>
            )}
            <h1 className="font-display font-bold text-2xl text-[#142B4A] tracking-tight">
              {forgotMode
                ? 'Reset Password'
                : mode === 'register'
                  ? 'Create Student Account'
                  : isAdminPortal
                    ? 'Administrator Sign In'
                    : 'Welcome Back'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {forgotMode
                ? 'Enter your registered email to receive a reset link.'
                : mode === 'register'
                  ? 'Any student can register, select their own USN (001–500), and submit complaints.'
                  : isAdminPortal
                    ? 'Sign in with an authorized CampusFix administrator account.'
                    : 'Sign in with your own account to report and track campus issues.'}
            </p>
          </div>

          {mode === 'register' && !forgotMode && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#F7F9FC] border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-[#142B4A]">
                  <Users className="w-3.5 h-3.5 text-[#3867F5]" />
                  Cohort Registration Capacity
                </span>
                <span className="font-mono font-bold text-[#3867F5] tabular-nums">
                  {registeredStudents} / {MAX_STUDENT_COHORT_CAPACITY}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-[#3867F5] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((registeredStudents / MAX_STUDENT_COHORT_CAPACITY) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Up to 500 students (USN 001–500) can register and submit complaints concurrently.
              </p>
            </div>
          )}

          {/* Alerts */}
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-[#EF5350]/10 border border-[#EF5350]/25 text-xs sm:text-sm text-[#B71C1C] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF5350]" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-5 p-3.5 rounded-lg bg-[#16A36A]/10 border border-[#16A36A]/25 text-xs sm:text-sm text-[#15803D] flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16A36A]" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Google Sign-In (Works instantly out-of-the-box with Provisioned Firebase) */}
          {!forgotMode && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-[#142B4A] text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                {isAdminPortal
                  ? 'Sign in with Google (Admin)'
                  : 'Continue with Google (Instant Student Access)'}
              </button>

              {!isAdminPortal && (
                <p className="mt-2 text-[11px] text-slate-500 text-center">
                  Any student can sign in instantly with Google and choose their own USN (001–500) to submit complaints.
                </p>
              )}

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400">or use email &amp; password</span>
                </div>
              </div>
            </>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && !forgotMode && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Priya Sharma"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                    />
                  </div>
                </div>

                <UsnSelector
                  value={studentId}
                  onChange={setStudentId}
                  label="Student USN (Choose last 3 digits)"
                />

                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                    Department
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] bg-white focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                {isAdminPortal ? 'Administrator Email' : 'College Email'}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAdminPortal ? 'Enter administrator email' : 'Enter your college email'}
                  autoComplete="off"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                />
              </div>
            </div>

            {!forgotMode && (
              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && !forgotMode && (
              <div>
                <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && !forgotMode && (
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={goToReportAfterRegister}
                  onChange={(e) => setGoToReportAfterRegister(e.target.checked)}
                  className="rounded border-slate-300 text-[#3867F5] focus:ring-[#3867F5]"
                />
                <span>Open Report an Issue page right after registering</span>
              </label>
            )}

            {mode === 'login' && !forgotMode && (
              <div className="flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-[#3867F5] focus:ring-[#3867F5]"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setError(null);
                  }}
                  className="font-medium text-[#3867F5] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer ${
                isAdminPortal
                  ? 'bg-[#142B4A] hover:bg-[#1e3d66]'
                  : 'bg-[#3867F5] hover:bg-[#2955d9]'
              }`}
            >
              {loading
                ? 'Please wait...'
                : forgotMode
                  ? 'Send Reset Link'
                  : mode === 'register'
                    ? 'Create Student Account'
                    : isAdminPortal
                      ? 'Sign In to Admin Console'
                      : 'Sign In'}
            </button>

            {forgotMode && (
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setError(null);
                }}
                className="w-full py-2 text-xs font-medium text-slate-600 hover:text-[#142B4A] cursor-pointer"
              >
                Return to Sign In
              </button>
            )}
          </form>

          {/* Footer Switch Links */}
          <div className="mt-6 pt-5 border-t border-slate-200 text-center space-y-2 text-xs text-slate-500">
            {mode === 'register' ? (
              <p>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="font-semibold text-[#3867F5] hover:underline cursor-pointer"
                >
                  Student Login
                </button>
              </p>
            ) : mode === 'login' ? (
              <>
                <p>
                  New to CampusFix?{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/register')}
                    className="font-semibold text-[#3867F5] hover:underline cursor-pointer"
                  >
                    Create Student Account
                  </button>
                </p>
                <p>
                  Facilities staff?{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('/admin-login')}
                    className="font-semibold text-[#142B4A] hover:underline cursor-pointer"
                  >
                    Administrator Login
                  </button>
                </p>
              </>
            ) : (
              <p>
                Looking for student reporting?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="font-semibold text-[#3867F5] hover:underline cursor-pointer"
                >
                  Go to Student Login
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        CampusFix · Secured with Firebase Authentication
      </p>
    </div>
  );
}
