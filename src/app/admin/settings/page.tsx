'use client';
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useSiteSettings, type SiteSettings } from '@/components/layout/SiteSettings';
import { isFirebaseConfigured, requireFirebaseDatabase } from '@/lib/firebase/client';
import { doc, setDoc } from 'firebase/firestore';

const labels: Record<string,string> = { agency_name:'ชื่อบริษัท', phone:'โทรศัพท์', line_id:'ชื่อ LINE', email:'อีเมล', address:'ที่อยู่', hours:'เวลาทำการ' };
export default function SettingsPage() {
  const { settings, refresh } = useSiteSettings();
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setForm(settings); }, [settings]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setMessage(''); setError('');
    if (!isFirebaseConfigured && !supabase) { setError('ยังไม่ได้เชื่อมต่อฐานข้อมูล'); return; }
    setBusy(true);
    try {
      if (isFirebaseConfigured) {
        await setDoc(doc(requireFirebaseDatabase(), 'site_settings', '1'), { ...form, id: 1 });
      } else {
        const { data, error } = await supabase!.from('site_settings').upsert({ ...form, id:1 }).select('*').single();
        if (error || !data) throw error;
      }
      await refresh(); setMessage('บันทึกข้อมูลแล้ว หน้าเว็บไซต์จะแสดงข้อมูลใหม่นี้');
    } catch { setError('บันทึกไม่สำเร็จ ต้องใช้บัญชีผู้ดูแลระบบและติดตั้งตารางการตั้งค่าก่อน'); }
    finally { setBusy(false); }
  }
  return <div className="max-w-3xl space-y-6">
    <div><p className="text-sm text-gold-700">ข้อมูลบริษัท</p><h1 className="text-3xl font-semibold mt-2">ตั้งค่าเว็บไซต์</h1><p className="mt-3 text-sm text-slate-500">ข้อมูลติดต่อที่แสดงให้ลูกค้าเห็นบนเว็บไซต์</p></div>
    <form onSubmit={save} className="bg-white rounded-2xl border p-6 space-y-5">
      {error && <p role="alert" className="text-red-700 rounded-lg bg-red-50 p-3">{error}</p>}
      {message && <p role="status" className="text-emerald-800 rounded-lg bg-emerald-50 p-3">{message}</p>}
      {Object.entries(labels).map(([key,label]) => <label key={key} className="block text-sm">{label}<input required={key === 'agency_name' || key === 'phone'} maxLength={key === 'agency_name' ? 150 : key === 'phone' ? 30 : 500} type={key === 'email' ? 'email' : 'text'} value={form[key as keyof SiteSettings]} onChange={e => setForm({ ...form, [key]:e.target.value })} className="block mt-2 rounded-xl border p-3 w-full" /></label>)}
      <button disabled={busy} className="rounded-xl bg-navy-950 text-white px-6 py-3 text-sm">{busy ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</button>
    </form>
  </div>;
}
