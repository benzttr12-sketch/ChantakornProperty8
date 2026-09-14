'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import type { UserProfile } from '@/lib/types';
import { isFirebaseConfigured, requireFirebaseDatabase } from '@/lib/firebase/client';
import { firebaseProfile } from '@/lib/firebase/auth';
import { collection, doc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentId, setCurrentId] = useState('');
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (isFirebaseConfigured) {
          const profile = await firebaseProfile();
          if (profile?.role !== 'ADMIN') throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการสมาชิกได้');
          const snapshot = await getDocs(query(collection(requireFirebaseDatabase(), 'profiles'), orderBy('full_name')));
          if (active) {
            setUsers(snapshot.docs.map(item => ({ ...item.data(), id: item.id } as UserProfile)));
            setCurrentId(profile.id); setAllowed(true);
          }
          return;
        }
        if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูล');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('กรุณาเข้าสู่ระบบ');
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'ADMIN') throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการสมาชิกได้');
        const { data, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error) throw error;
        if (active) { setUsers(data || []); setCurrentId(user.id); setAllowed(true); }
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'โหลดสมาชิกไม่สำเร็จ'); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing || (!isFirebaseConfigured && !supabase) || busy) return;
    setBusy(true); setError(''); setSaved(false);
    try {
      if (isFirebaseConfigured) {
        const values = { full_name: editing.full_name.trim(), phone: editing.phone || '', role: editing.role };
        await updateDoc(doc(requireFirebaseDatabase(), 'profiles', editing.id), values);
        setUsers(list => list.map(item => item.id === editing.id ? { ...item, ...values } : item));
        setEditing(null); setSaved(true);
        return;
      }
      const { data, error } = await supabase!.from('profiles').update({
        full_name: editing.full_name.trim(), phone: editing.phone || null, role: editing.role,
      }).eq('id', editing.id).select('*').single();
      if (error) throw error;
      setUsers(list => list.map(item => item.id === data.id ? data : item));
      setEditing(null); setSaved(true);
    } catch { setError('บันทึกไม่สำเร็จ ตรวจสอบสิทธิ์หรือสถานะแอดมินคนสุดท้าย'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div><p className="text-sm text-gold-700">ทีมงานและสมาชิก</p><h1 className="text-3xl font-semibold mt-2">จัดการสมาชิก</h1><p className="text-slate-500 mt-3 text-sm">สมาชิกใหม่สมัครผ่าน <Link className="underline" href="/register">หน้าสมัครสมาชิก</Link> แล้วผู้ดูแลจึงกำหนดสิทธิ์ให้</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {saved && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-800">บันทึกข้อมูลเรียบร้อยแล้ว</p>}
    {loading ? <p>กำลังโหลด...</p> : allowed && <>
      <input aria-label="ค้นหาสมาชิก" placeholder="ค้นหาชื่อหรือเบอร์โทร" value={search} onChange={e => setSearch(e.target.value)} className="w-full max-w-md rounded-xl border p-3" />
      <div className="rounded-2xl border bg-white overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">ชื่อสมาชิก</th><th>โทรศัพท์</th><th>สิทธิ์</th><th className="p-4">จัดการ</th></tr></thead><tbody>
        {users.filter(u => (u.full_name + (u.phone || '')).includes(search)).map(u => <tr key={u.id} className="border-t"><td className="p-4">{u.full_name || 'ยังไม่ระบุชื่อ'}{u.id === currentId && <span className="ml-2 text-slate-400">(คุณ)</span>}</td><td>{u.phone || '—'}</td><td>{u.role}</td><td className="p-4"><button onClick={() => { setEditing(u); setSaved(false); }} className="rounded-lg border px-3 py-2">แก้ไข</button></td></tr>)}
      </tbody></table></div>
      {!users.length && <p>ยังไม่มีสมาชิก</p>}
    </>}
    {editing && <div role="dialog" aria-modal="true" aria-label="แก้ไขสมาชิก" className="fixed inset-0 z-[100] bg-navy-950/60 flex items-center justify-center p-5"><form onSubmit={save} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
      <h2 className="text-xl font-semibold">แก้ไขสมาชิก</h2>
      {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
      <label className="block text-sm">ชื่อ<input required maxLength={120} value={editing.full_name} onChange={e => setEditing({ ...editing, full_name: e.target.value })} className="block w-full rounded-lg border p-3 mt-1" /></label>
      <label className="block text-sm">โทรศัพท์<input maxLength={30} value={editing.phone || ''} onChange={e => setEditing({ ...editing, phone: e.target.value })} className="block w-full rounded-lg border p-3 mt-1" /></label>
      <label className="block text-sm">สิทธิ์<select disabled={editing.id === currentId} value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value as UserProfile['role'] })} className="block w-full rounded-lg border p-3 mt-1"><option value="USER">สมาชิก</option><option value="AGENT">เจ้าหน้าที่</option><option value="ADMIN">ผู้ดูแลระบบ</option></select></label>
      <div className="flex gap-3"><button disabled={busy} className="bg-navy-950 text-white rounded-xl px-5 py-3">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button><button disabled={busy} type="button" onClick={() => setEditing(null)} className="rounded-xl border px-5 py-3">ยกเลิก</button></div>
    </form></div>}
  </div>;
}
