import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Mail,
  MapPin,
  Menu,
  Phone,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '../components/ui/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { submitContactMessage, subscribePublicStats } from '../services/campusService';
import { MAX_STUDENT_COHORT_CAPACITY, type PublicStats } from '../types/campusfix';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

const FEATURES = [
  {
    number: '01',
    title: 'Easy Issue Reporting',
    description:
      'Log classroom, hostel, electrical, or network issues in under 60 seconds with structured building and room selection.',
    icon: ClipboardList,
    featured: true,
  },
  {
    number: '02',
    title: 'Real-Time Tracking',
    description:
      'Follow every ticket live from submission through administrative review, maintenance dispatch, and final sign-off.',
    icon: Activity,
    featured: false,
  },
  {
    number: '03',
    title: 'Image-Based Reporting',
    description:
      'Attach clear photographs directly from phone or desktop so technicians arrive with the right tools on the first visit.',
    icon: Camera,
    featured: false,
  },
  {
    number: '04',
    title: 'Smart Priority Management',
    description:
      'Classify severity from Low to Critical so urgent safety hazards and power outages jump straight to the front of the queue.',
    icon: SlidersHorizontal,
    featured: false,
  },
  {
    number: '05',
    title: 'Transparent Administration',
    description:
      'Every status change includes timestamped administrator remarks and a complete audit log visible to the reporting student.',
    icon: Eye,
    featured: false,
  },
  {
    number: '06',
    title: 'Faster Issue Resolution',
    description:
      'Automated notifications eliminate phone tag between students, department coordinators, and campus maintenance crews.',
    icon: Zap,
    featured: true,
  },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Report an issue',
    detail:
      'Describe the problem, choose the campus building and room, assign priority, and attach a photo.',
  },
  {
    step: '02',
    title: 'Administration reviews it',
    detail:
      'Facilities coordinators receive an instant alert, verify severity, and post initial remarks.',
  },
  {
    step: '03',
    title: 'Maintenance team takes action',
    detail:
      'Technicians are dispatched to the exact location while the ticket updates to In Progress.',
  },
  {
    step: '04',
    title: 'Student sees the resolution',
    detail:
      'Once fixed, the issue is marked Resolved with completion notes and a downloadable PDF record.',
  },
];

export function LandingPage({ onNavigate }: LandingPageProps) {
  const { firebaseUser, isAdmin } = useAuth();
  const [stats, setStats] = useState<PublicStats>({
    totalReported: 0,
    totalResolved: 0,
    activeRequests: 0,
    registeredStudents: 0,
    updatedAt: null,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribePublicStats(setStats);
    return () => unsub();
  }, []);

  const handleReportClick = () => {
    if (firebaseUser) {
      onNavigate('/dashboard/report');
    } else {
      onNavigate('/register');
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactFeedback(null);

    if (contactName.trim().length < 2) {
      setContactFeedback({ type: 'error', text: 'Please enter your full name.' });
      return;
    }
    if (!contactEmail.includes('@')) {
      setContactFeedback({ type: 'error', text: 'Please provide a valid email address.' });
      return;
    }
    if (contactSubject.trim().length < 2) {
      setContactFeedback({ type: 'error', text: 'Please enter a subject.' });
      return;
    }
    if (contactMessage.trim().length < 10) {
      setContactFeedback({ type: 'error', text: 'Message must be at least 10 characters.' });
      return;
    }

    setContactLoading(true);
    try {
      await submitContactMessage({
        name: contactName,
        email: contactEmail,
        subject: contactSubject,
        message: contactMessage,
      });
      setContactFeedback({
        type: 'success',
        text: 'Your inquiry has been sent to CampusFix Administration.',
      });
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
    } catch (error) {
      setContactFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to send message right now.',
      });
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div id="home" className="min-h-screen bg-[#F7F9FC] text-[#142B4A]">
      {/* Sticky Navigation Bar — 3-Zone Contract */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand */}
          <BrandLogo onClick={() => onNavigate('/')} />

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#home" className="hover:text-[#142B4A] transition-colors whitespace-nowrap shrink-0">
              Home
            </a>
            <a href="#about" className="hover:text-[#142B4A] transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#features" className="hover:text-[#142B4A] transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-[#142B4A] transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#contact" className="hover:text-[#142B4A] transition-colors whitespace-nowrap shrink-0">
              Contact
            </a>
          </nav>

          {/* Zone 3: Auth Actions */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {firebaseUser ? (
              <>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onNavigate('/dashboard')}
                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-[#142B4A] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Student Portal
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate(isAdmin ? '/admin' : '/dashboard')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3867F5] text-white text-sm font-medium hover:bg-[#2955d9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isAdmin ? 'Admin Console' : 'Open Dashboard'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#142B4A] hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Student Login
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="px-4 py-2 rounded-lg bg-[#3867F5] text-white text-sm font-medium hover:bg-[#2955d9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Register (500 Seats)
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg text-[#142B4A] hover:bg-slate-100 cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3">
            <div className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
              <a href="#home" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Home</a>
              <a href="#about" onClick={() => setMobileMenuOpen(false)} className="py-1.5">About</a>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Features</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="py-1.5">How It Works</a>
              <a href="#contact" onClick={() => setMobileMenuOpen(false)} className="py-1.5">Contact</a>
            </div>
            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
              {firebaseUser ? (
                <>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onNavigate('/dashboard');
                      }}
                      className="w-full py-2.5 rounded-lg border border-slate-200 text-[#142B4A] text-sm font-medium"
                    >
                      Student Portal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavigate(isAdmin ? '/admin' : '/dashboard');
                    }}
                    className="w-full py-2.5 rounded-lg bg-[#3867F5] text-white text-sm font-medium"
                  >
                    {isAdmin ? 'Admin Console' : 'Open Dashboard'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavigate('/login');
                    }}
                    className="w-full py-2.5 rounded-lg border border-slate-200 text-[#142B4A] text-sm font-medium"
                  >
                    Student Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavigate('/register');
                    }}
                    className="w-full py-2.5 rounded-lg bg-[#3867F5] text-white text-sm font-medium"
                  >
                    Register (500 Seats)
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200/80 bg-white">
        <div
          className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-[#3867F5]/[0.04] to-transparent pointer-events-none"
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left Copy Column */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-semibold text-[#3867F5] tracking-tight mb-2">
                Alva&apos;s Institute of Engineering &amp; Technology · Mijar, Moodabidri
              </p>
              <h1
                className="font-display font-extrabold text-[#142B4A] tracking-tight leading-[1.08] mb-5 text-balance"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.65rem)' }}
              >
                Building a Better Campus Starts With You.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                Report campus problems across AIET Mijar (Dakshina Kannada District), track their
                progress and help create a cleaner, safer and smarter learning environment.
              </p>

              <div className="flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={handleReportClick}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#3867F5] text-white font-semibold text-sm hover:bg-[#2955d9] transition-colors shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                >
                  Report an Issue
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-200 bg-white text-[#142B4A] font-semibold text-sm hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  Explore Features
                </a>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                <span>Report It. Track It. Fix It.</span>
                <span aria-hidden="true">·</span>
                <span>Open to all 500 AIET students (USN 001–500)</span>
                <span aria-hidden="true">·</span>
                <span>Exportable PDF reports</span>
              </div>
            </div>

            {/* Right Visual Column */}
            <div className="lg:col-span-6 flex flex-col">
              <div className="relative flex-1 min-h-[260px] sm:min-h-[340px] rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-br from-[#142B4A] via-[#1c3c66] to-[#3867F5]/90 shadow-sm">
                <img
                  src="/assets/aistudio/image_b29abb99.png"
                  alt="Alva's Institute of Engineering and Technology main campus building in Mijar, Moodabidri"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5">
                  <p className="text-xs font-semibold text-[#32C5F4]">Shobhavana Campus · Mijar</p>
                  <p className="text-sm font-medium text-white">
                    Alva&apos;s Institute of Engineering &amp; Technology · Moodabidri, Dakshina Kannada
                  </p>
                </div>
                <div className="hidden" aria-hidden="true">
                  <Building2 className="w-10 h-10 text-white/60" />
                </div>
              </div>
            </div>
          </div>

          {/* Live Campus Metrics Row — Real Firestore Aggregate Counters */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#F7F9FC] border border-slate-200/90 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Issues Reported</p>
                <p className="text-2xl font-display font-bold text-[#142B4A] tabular-nums mt-1">
                  {stats.totalReported}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#3867F5]/10 text-[#3867F5] flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#F7F9FC] border border-slate-200/90 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Issues Resolved</p>
                <p className="text-2xl font-display font-bold text-[#16A36A] tabular-nums mt-1">
                  {stats.totalResolved}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#16A36A]/10 text-[#16A36A] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#F7F9FC] border border-slate-200/90 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Active Requests</p>
                <p className="text-2xl font-display font-bold text-[#142B4A] tabular-nums mt-1">
                  {stats.activeRequests}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#32C5F4]/15 text-[#0284C7] flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#F7F9FC] border border-slate-200/90 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">Registered Students</p>
                <p className="text-2xl font-display font-bold text-[#142B4A] tabular-nums mt-1">
                  {Math.min(MAX_STUDENT_COHORT_CAPACITY, stats.registeredStudents ?? 0)}
                  <span className="text-sm font-medium text-slate-400">
                    {' '}/ {MAX_STUDENT_COHORT_CAPACITY}
                  </span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[#3867F5]/10 text-[#3867F5] flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-semibold text-[#3867F5] mb-2">Platform Capabilities</p>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#142B4A] tracking-tight text-balance">
            Built for Fast Campus Maintenance Operations
          </h2>
          <p className="text-slate-600 mt-3 leading-relaxed">
            Replace fragmented emails and paper logs with a single structured workflow connecting
            students, wardens, and facilities engineers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.number}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:border-[#3867F5]/40 transition-colors duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-10 h-10 rounded-lg bg-[#F7F9FC] border border-slate-200 text-[#3867F5] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-medium text-slate-400 tabular-nums">
                      {feature.number}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-lg text-[#142B4A] mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-sm font-semibold text-[#3867F5] mb-2">Four-Step Resolution</p>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#142B4A] tracking-tight mb-4 text-balance">
                How CampusFix Moves Issues From Report to Resolution
              </h2>
              <p className="text-slate-600 mb-8 leading-relaxed">
                Every complaint follows a transparent four-stage lifecycle so students never wonder
                whether their report was received.
              </p>

              <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                {WORKFLOW_STEPS.map((item) => (
                  <div key={item.step} className="py-4 flex items-start gap-4">
                    <span className="font-mono text-xs font-semibold text-[#3867F5] pt-1 tabular-nums shrink-0">
                      Step {item.step}
                    </span>
                    <div>
                      <h3 className="font-display font-semibold text-base text-[#142B4A]">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 flex">
              <div className="w-full min-h-[260px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <img
                  src="/src/assets/images/aiet_aerial_crisp_1795098803645.jpg"
                  alt="Aerial view of Alva's Institute of Engineering and Technology campus in Mijar, Moodabidri"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <div className="lg:col-span-6 order-2 lg:order-1 flex">
            <div className="w-full min-h-[260px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
              <img
                src="/assets/aistudio/image_b29abb99.png"
                alt="Alva's Institute of Engineering and Technology main academic block and campus walkway in Mijar"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-center"
              />
            </div>
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2 flex flex-col justify-center">
            <p className="text-sm font-semibold text-[#3867F5] mb-2">About AIET CampusFix</p>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#142B4A] tracking-tight mb-4 text-balance">
              Built for Alva&apos;s Institute of Engineering &amp; Technology, Mijar
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Located in Mijar, Moodabidri in the Dakshina Kannada District, our Shobhavana Campus
              spans engineering blocks, specialized research laboratories, libraries, and student
              hostels. When an electrical fault, water issue, or Wi-Fi outage goes unreported,
              academic work slows down.
            </p>
            <p className="text-slate-600 leading-relaxed mb-8">
              CampusFix gives AIET students a direct, USN-linked channel to report problems with
              exact building locations and photos, while equipping campus administrators with
              priority queues, analytics, and instant resolution notifications.
            </p>

            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200">
              <div>
                <p className="font-display font-bold text-2xl text-[#142B4A]">4-Stage</p>
                <p className="text-xs text-slate-500 mt-1">
                  Transparent workflow from Submitted to Resolved
                </p>
              </div>
              <div>
                <p className="font-display font-bold text-2xl text-[#142B4A]">USN-Linked</p>
                <p className="text-xs text-slate-500 mt-1">
                  Protected student privacy &amp; dedicated admin control
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-16 lg:py-24 bg-white border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-5">
              <p className="text-sm font-semibold text-[#3867F5] mb-2">Contact Administration</p>
              <h2 className="font-display font-bold text-3xl text-[#142B4A] tracking-tight mb-4">
                Questions About Campus Operations?
              </h2>
              <p className="text-slate-600 leading-relaxed mb-8">
                Reach out to the AIET Campus Facilities &amp; Operations Helpdesk at Mijar,
                Moodabidri for departmental onboarding, urgent escalations, or portal assistance.
              </p>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#3867F5] mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#142B4A]">
                      Alva&apos;s Institute of Engineering &amp; Technology
                    </p>
                    <p className="text-slate-600">
                      Shobhavana Campus, Mijar, Moodabidri – 574225 · Dakshina Kannada District, Karnataka
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-[#3867F5] mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#142B4A]">Operations Desk Email</p>
                    <p className="text-slate-600">facilities@aiet.org.in</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#3867F5] mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-[#142B4A]">Campus Maintenance Desk</p>
                    <p className="text-slate-600 font-mono tabular-nums">+91 8258 262725</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <form
                onSubmit={handleContactSubmit}
                className="bg-[#F7F9FC] border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Your name"
                      required
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="you@university.edu"
                      required
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="Department onboarding or facilities inquiry"
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#142B4A] mb-1.5">
                    Message
                  </label>
                  <textarea
                    rows={4}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Write your message here..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-[#142B4A] focus:outline-none focus:ring-2 focus:ring-[#3867F5]"
                  />
                </div>

                {contactFeedback && (
                  <p
                    className={`text-sm font-medium ${
                      contactFeedback.type === 'success' ? 'text-[#16A36A]' : 'text-[#EF5350]'
                    }`}
                  >
                    {contactFeedback.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={contactLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#142B4A] text-white text-sm font-semibold hover:bg-[#1d3c66] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {contactLoading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet SaaS Footer */}
      <footer className="bg-[#142B4A] text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/10">
            <div className="md:col-span-5">
              <BrandLogo inverted onClick={() => onNavigate('/')} />
              <p className="text-sm text-slate-300 mt-4 max-w-sm leading-relaxed">
                Smart Campus Issue Reporting &amp; Management System. Report It. Track It. Fix It.
              </p>
            </div>

            <div className="md:col-span-3 space-y-2.5 text-sm">
              <p className="font-semibold text-white mb-3">Navigation</p>
              <a href="#home" className="block hover:text-white transition-colors">Home</a>
              <a href="#about" className="block hover:text-white transition-colors">About</a>
              <a href="#features" className="block hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="block hover:text-white transition-colors">How It Works</a>
              <a href="#contact" className="block hover:text-white transition-colors">Contact</a>
            </div>

            <div className="md:col-span-4 space-y-2.5 text-sm">
              <p className="font-semibold text-white mb-3">Portals &amp; Support</p>
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="block hover:text-white transition-colors cursor-pointer"
              >
                Student Login
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/register')}
                className="block hover:text-white transition-colors cursor-pointer"
              >
                Student Registration
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/admin-login')}
                className="inline-flex items-center gap-1.5 text-[#32C5F4] hover:text-white transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                Administrator Login
              </button>
              <p className="text-xs text-slate-400 pt-2">
                facilities@aiet.org.in · AIET Mijar, Moodabidri, Dakshina Kannada – 574225
              </p>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} CampusFix · Alva&apos;s Institute of Engineering &amp; Technology.</p>
            <p>Mijar, Moodabidri · Dakshina Kannada District</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
