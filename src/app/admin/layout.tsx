'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { auth, isFirebaseConfigured, requireFirebaseDatabase } from '@/lib/firebase/client';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Building2, 
  PlusCircle, 
  MessageSquare, 
  Users, 
  Settings, 
  LogOut, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>({
    full_name: 'ผู้ดูแลระบบ (Admin)',
    role: 'ADMIN',
    email: 'admin@chantakornproperty.com',
  });

  useEffect(() => {
    if (isFirebaseConfigured) {
      if (!auth) { router.replace('/login'); return; }
      let stopProfile: (() => void) | undefined;
      const stopAuth = onAuthStateChanged(auth, user => {
        stopProfile?.();
        setIsAuthorized(false);
        if (!user || !user.emailVerified) { router.replace('/login'); return; }
        stopProfile = onSnapshot(doc(requireFirebaseDatabase(), 'profiles', user.uid), snapshot => {
          const profile = snapshot.data();
          if (!profile || !['ADMIN', 'AGENT'].includes(profile.role)) {
            setIsAuthorized(false);
            router.replace('/login');
            return;
          }
          setCurrentUser({ ...profile, id: user.uid, email: user.email });
          setIsAuthorized(true);
        }, () => { setIsAuthorized(false); router.replace('/login'); });
      }, () => { setIsAuthorized(false); router.replace('/login'); });
      return () => { stopAuth(); stopProfile?.(); };
    }
    async function authorize() {
      if (isSupabaseConfigured && supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, phone')
          .eq('id', user.id)
          .single();
        if (!profile || !['ADMIN', 'AGENT'].includes(profile.role)) {
          await supabase.auth.signOut();
          router.replace('/login');
          return;
        }
        setCurrentUser({ ...profile, email: user.email });
        setIsAuthorized(true);
        return;
      }

      if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true' && typeof window !== 'undefined') {
        const stored = localStorage.getItem('chantakorn_auth_user');
        if (stored) {
          try {
            const user = JSON.parse(stored);
            if (['ADMIN', 'AGENT'].includes(user.role)) {
              setCurrentUser(user);
              setIsAuthorized(true);
              return;
            }
          } catch {}
        }

      }
      router.replace('/login');
    }
    authorize();
  }, [router]);

  const handleLogout = async () => {
    if (isFirebaseConfigured) {
      if (auth) await signOut(auth);
      setIsAuthorized(false);
      router.replace('/login');
      return;
    }
    if (isSupabaseConfigured && supabase) await supabase.auth.signOut();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chantakorn_auth_user');
    }
    router.push('/');
  };

  const navItems = [
    { label: 'แดชบอร์ดภาพรวม', href: '/admin', icon: LayoutDashboard },
    { label: 'จัดการอสังหาริมทรัพย์', href: '/admin/properties', icon: Building2 },
    { label: 'เพิ่มทรัพย์ใหม่', href: '/admin/properties/new', icon: PlusCircle },
    { label: 'รายการผู้ติดต่อ & ฝากขาย', href: '/admin/inquiries', icon: MessageSquare },
    { label: 'จัดการสมาชิก & สิทธิ์', href: '/admin/users', icon: Users },
    { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings },
  ];

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-navy-950 text-white p-4 flex items-center justify-between border-b border-navy-800">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-1.5 text-gray-300 hover:text-white"
          >
            {mobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="font-bold text-sm tracking-wide">CHANTAKORN CRM</span>
        </div>
        <Link href="/" className="text-xs text-gold-400 font-semibold flex items-center">
          <span>หน้าเว็บไซต์</span>
          <ExternalLink className="w-3 h-3 ml-1" />
        </Link>
      </div>

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`fixed md:sticky top-0 z-50 h-screen w-64 bg-navy-950 text-gray-300 flex flex-col justify-between p-5 border-r border-navy-800/80 transition-transform duration-300 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="pb-6 border-b border-navy-800 flex items-center justify-between">
            <Link href="/admin" className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 font-bold shadow-md">
                <Building2 className="w-5 h-5 text-navy-950" />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-sm tracking-wider leading-none">
                  CHANTAKORN
                </span>
                <span className="text-gold-400 text-[10px] font-semibold tracking-widest leading-tight">
                  ADMIN DASHBOARD
                </span>
              </div>
            </Link>
          </div>

          {/* User Badge */}
          <div className="mt-4 p-3 bg-navy-900/80 rounded-xl border border-navy-800 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gold-500/20 text-gold-400 flex items-center justify-center font-bold text-xs border border-gold-500/40">
              {currentUser.full_name?.charAt(0) || 'A'}
            </div>
            <div className="min-w-0 flex-grow">
              <span className="text-xs font-bold text-white block truncate">
                {currentUser.full_name}
              </span>
              <span className="text-[10px] text-gold-400 block font-semibold">
                บทบาท: {currentUser.role}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1.5">
            {navItems.filter(item => currentUser.role === 'ADMIN' || !['/admin/users', '/admin/settings'].includes(item.href)).map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gold-500 text-navy-950 font-bold shadow-sm'
                      : 'text-gray-300 hover:bg-navy-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 border-t border-navy-800 space-y-2">
          <Link
            href="/"
            target="_blank"
            className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-gray-400 hover:text-gold-400 hover:bg-navy-900 rounded-xl transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>ดูหน้าเว็บลูกค้า</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/40 rounded-xl transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-4 sm:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
