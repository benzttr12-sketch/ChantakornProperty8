'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, MessageSquare, Plus, ArrowUpRight } from 'lucide-react';
import { fetchProperties, fetchInquiries } from '@/lib/store/properties-store';
import type { Property, Inquiry } from '@/lib/types';
import { formatThaiDate, formatPrice } from '@/lib/utils';

export default function Dashboard() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([fetchProperties(undefined, true), fetchInquiries()]).then(([p, i]) => {
      if (active) { setProperties(p); setInquiries(i); }
    }).catch(() => { if (active) setError('โหลดข้อมูลไม่สำเร็จ กรุณาตรวจการเชื่อมต่อฐานข้อมูล'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const stats = [
    ['ทรัพย์ทั้งหมด', properties.length],
    ['เผยแพร่แล้ว', properties.filter(p => p.published).length],
    ['ฉบับร่าง', properties.filter(p => !p.published).length],
    ['ผู้ติดต่อรอดำเนินการ', inquiries.filter(i => i.status === 'new').length],
  ];
  return <div className="space-y-8">
    <div className="flex flex-wrap justify-between gap-5 items-end"><div><p className="text-sm text-gold-700">CHANTAKORN · WORKSPACE</p><h1 className="text-3xl font-semibold mt-2">ภาพรวมธุรกิจของคุณ</h1><p className="text-slate-500 mt-3 text-sm">รายการทรัพย์และลูกค้าที่ต้องติดตาม จากข้อมูลในระบบ</p></div><Link href="/admin/properties/new" className="inline-flex gap-2 bg-navy-950 text-white px-5 py-3 rounded-xl text-sm"><Plus size={18} />เพิ่มทรัพย์ใหม่</Link></div>
    {error && <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</p>}
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{stats.map(([label, value]) => <div key={label} className="bg-white rounded-2xl border p-5"><p className="text-sm text-slate-500">{label}</p><p className="text-4xl font-semibold mt-4">{loading || error ? '—' : value}</p></div>)}</div>
    <div className="grid lg:grid-cols-2 gap-6">
      <section className="bg-white rounded-2xl border p-6"><div className="flex justify-between gap-3"><h2 className="font-semibold flex gap-2"><MessageSquare size={20} />ผู้ติดต่อล่าสุด</h2><Link href="/admin/inquiries" className="text-sm text-gold-700">ดูทั้งหมด</Link></div>
        {!loading && !inquiries.length && <p className="py-12 text-center text-slate-500">ยังไม่มีข้อความจากลูกค้า</p>}
        {inquiries.slice(0, 5).map(i => <Link key={i.id} href="/admin/inquiries" className="block border-t mt-4 pt-4"><div className="flex justify-between text-sm"><strong>{i.name}</strong><span className="text-slate-400">{formatThaiDate(i.created_at)}</span></div><p className="text-sm text-slate-500 line-clamp-2 mt-2">{i.message}</p></Link>)}
      </section>
      <section className="bg-white rounded-2xl border p-6"><div className="flex justify-between gap-3"><h2 className="font-semibold flex gap-2"><Building2 size={20} />ทรัพย์ล่าสุด</h2><Link href="/admin/properties" className="text-sm text-gold-700">จัดการทรัพย์</Link></div>
        {!loading && !properties.length && <p className="py-12 text-center text-slate-500">เริ่มต้นด้วยการเพิ่มทรัพย์แรกของคุณ</p>}
        {[...properties].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,5).map(p => <Link key={p.id} href={`/admin/properties/${p.id}/edit`} className="flex justify-between gap-3 border-t mt-4 pt-4"><div><p className="text-sm font-medium line-clamp-1">{p.title}</p><p className="text-xs text-slate-500 mt-2">{formatPrice(p.price, p.status)} · {p.published ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}</p></div><ArrowUpRight size={18} className="shrink-0" /></Link>)}
      </section>
    </div>
  </div>;
}
