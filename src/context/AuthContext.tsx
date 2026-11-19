import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { writeStatsShardIncrement } from '../services/campusService';
import { type UserProfile, VALIDATION_LIMITS } from '../types/campusfix';

const BOOTSTRAPPED_ADMIN_EMAIL = 'rakshanayak290@gmail.com';

interface RegisterStudentParams {
  fullName: string;
  studentId: string;
  email: string;
  department: string;
  password: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  authReady: boolean;
  loginSuccessMessage: string | null;
  clearLoginSuccess: () => void;
  registerStudent: (params: RegisterStudentParams) => Promise<void>;
  loginWithEmail: (
    email: string,
    password: string,
    rememberMe: boolean,
    portal: 'student' | 'admin'
  ) => Promise<void>;
  loginWithGoogle: (portal: 'student' | 'admin') => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  reloadProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function formatFirebaseAuthError(error: unknown): Error {
  const code = (error as { code?: string })?.code || '';
  const message = error instanceof Error ? error.message : String(error);

  switch (code) {
    case 'auth/operation-not-allowed':
      return new Error(
        'Email/Password sign-in is not yet enabled in Firebase Authentication. Enable "Email/Password" in Firebase Console -> Authentication -> Sign-in method, or use "Continue with Google" below.'
      );
    case 'auth/email-already-in-use':
      return new Error('An account with this email address already exists. Try signing in instead.');
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return new Error('Invalid email or password. Please check your credentials and try again.');
    case 'auth/weak-password':
      return new Error('Password is too weak. Please choose at least 6 characters.');
    case 'auth/invalid-email':
      return new Error('Please enter a valid college email address.');
    case 'auth/popup-closed-by-user':
      return new Error('Google sign-in popup was closed before completion.');
    case 'auth/popup-blocked':
      return new Error('Sign-in popup was blocked by your browser. Please allow popups and try again.');
    case 'auth/too-many-requests':
      return new Error('Too many attempts. Please wait a moment and try again.');
    default:
      return new Error(message);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);

  const clearLoginSuccess = () => setLoginSuccessMessage(null);

  const syncUserDocument = async (user: User): Promise<{ profile: UserProfile | null; admin: boolean }> => {
    const isBootstrappedOwner =
      user.emailVerified && user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();

    const adminRef = doc(db, 'admins', user.uid);
    const userRef = doc(db, 'users', user.uid);

    let adminExists = false;
    try {
      const adminSnap = await getDoc(adminRef);
      adminExists = adminSnap.exists();
    } catch {
      adminExists = false;
    }

    if (isBootstrappedOwner && !adminExists) {
      try {
        await setDoc(adminRef, {
          uid: user.uid,
          email: user.email || BOOTSTRAPPED_ADMIN_EMAIL,
          fullName: (user.displayName || 'Campus Administrator').slice(0, 100),
          createdAt: serverTimestamp(),
        });
        adminExists = true;
      } catch (err) {
        console.warn('Could not auto-bootstrap admin registry:', err);
      }
    }

    let userSnap;
    try {
      userSnap = await getDoc(userRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    }

    if (userSnap && userSnap.exists()) {
      const d = userSnap.data();
      const loadedProfile: UserProfile = {
        uid: String(d.uid ?? user.uid),
        fullName: String(d.fullName ?? user.displayName ?? 'Campus User'),
        studentId: String(d.studentId ?? ''),
        email: String(d.email ?? user.email ?? ''),
        department: String(d.department ?? ''),
        role: d.role === 'admin' || adminExists || isBootstrappedOwner ? 'admin' : 'student',
        createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : null,
        updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : null,
      };
      return {
        profile: loadedProfile,
        admin: loadedProfile.role === 'admin' || adminExists || isBootstrappedOwner,
      };
    }

    // Create default profile if signed in via Google on first login
    if (user.email) {
      const defaultRole = isBootstrappedOwner || adminExists ? 'admin' : 'student';
      const safeName = (user.displayName || 'AIET Student')
        .trim()
        .slice(0, VALIDATION_LIMITS.fullName.max);
      const safeFullName = safeName.length >= 2 ? safeName : 'AIET Student';
      try {
        await setDoc(userRef, {
          uid: user.uid,
          fullName: safeFullName,
          studentId: '4AL25CS122',
          email: user.email,
          department: 'Computer Science & Engineering (CSE)',
          role: defaultRole,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (defaultRole === 'student') {
          await writeStatsShardIncrement({ registeredStudents: 1 }).catch(() => undefined);
        }
        return {
          profile: {
            uid: user.uid,
            fullName: safeFullName,
            studentId: '4AL25CS122',
            email: user.email,
            department: 'Computer Science & Engineering (CSE)',
            role: defaultRole,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          admin: defaultRole === 'admin',
        };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
      }
    }

    return { profile: null, admin: isBootstrappedOwner || adminExists };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }
      try {
        const result = await syncUserDocument(user);
        setProfile(result.profile);
        setIsAdmin(result.admin);
      } catch (err) {
        console.error('Failed syncing user document:', err);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const registerStudent = async (params: RegisterStudentParams) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
      const safeName = params.fullName.trim().slice(0, VALIDATION_LIMITS.fullName.max);
      await updateProfile(cred.user, { displayName: safeName });

      const userRef = doc(db, 'users', cred.user.uid);
      await setDoc(userRef, {
        uid: cred.user.uid,
        fullName: safeName,
        studentId: params.studentId.trim().slice(0, VALIDATION_LIMITS.studentId.max),
        email: params.email.trim(),
        department: params.department.trim().slice(0, VALIDATION_LIMITS.department.max),
        role: 'student',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await sendEmailVerification(cred.user).catch(() => undefined);
      await writeStatsShardIncrement({ registeredStudents: 1 }).catch(() => undefined);

      setProfile({
        uid: cred.user.uid,
        fullName: safeName,
        studentId: params.studentId.trim(),
        email: params.email.trim(),
        department: params.department.trim(),
        role: 'student',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setIsAdmin(false);
      setLoginSuccessMessage('Successfully logged in to the Student Portal.');
    } catch (error) {
      throw formatFirebaseAuthError(error);
    }
  };

  const loginWithEmail = async (
    email: string,
    password: string,
    rememberMe: boolean,
    portal: 'student' | 'admin'
  ) => {
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const synced = await syncUserDocument(cred.user);

      if (portal === 'admin' && !synced.admin) {
        await signOut(auth);
        throw new Error('This account does not have administrator privileges.');
      }
      setProfile(synced.profile);
      setIsAdmin(synced.admin);
      setLoginSuccessMessage(
        portal === 'admin'
          ? 'Successfully logged in to the Administrator Console.'
          : 'Successfully logged in to the Student Portal.'
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('administrator privileges')) {
        throw error;
      }
      throw formatFirebaseAuthError(error);
    }
  };

  const loginWithGoogle = async (portal: 'student' | 'admin') => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const synced = await syncUserDocument(cred.user);

      if (portal === 'admin' && !synced.admin) {
        await signOut(auth);
        throw new Error('This Google account is not registered as a CampusFix Administrator.');
      }
      setProfile(synced.profile);
      setIsAdmin(synced.admin);
      setLoginSuccessMessage(
        portal === 'admin'
          ? 'Successfully logged in to the Administrator Console.'
          : 'Successfully logged in to the Student Portal.'
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('CampusFix Administrator')) {
        throw error;
      }
      throw formatFirebaseAuthError(error);
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (error) {
      throw formatFirebaseAuthError(error);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const refreshVerificationStatus = async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const updatedUser = auth.currentUser;
    setFirebaseUser(updatedUser);
    if (updatedUser.emailVerified) {
      const synced = await syncUserDocument(updatedUser);
      setProfile(synced.profile);
      setIsAdmin(synced.admin);
    }
    return updatedUser.emailVerified;
  };

  const reloadProfile = async () => {
    if (!auth.currentUser) return;
    const synced = await syncUserDocument(auth.currentUser);
    setProfile(synced.profile);
    setIsAdmin(synced.admin);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    setIsAdmin(false);
    setLoginSuccessMessage(null);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        isAdmin,
        authReady,
        loginSuccessMessage,
        clearLoginSuccess,
        registerStudent,
        loginWithEmail,
        loginWithGoogle,
        sendPasswordReset,
        resendVerificationEmail,
        refreshVerificationStatus,
        reloadProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
