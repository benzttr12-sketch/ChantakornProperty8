'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { 
  MessageSquare, 
  Phone, 
  MessageCircle, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Filter,
  User,
  Images,
  X,
  LoaderCircle
} from 'lucide-react';
import { fetchInquiries, updateInquiryStatus } from '@/lib/store/properties-store';
import { Inquiry } from '@/lib/types';
import { formatThaiDate } from '@/lib/utils';
import { consignmentPhotoLinks, releaseConsignmentPhotoLinks } from '@/lib/uploads';

type PreviewState = {
  status: 'loading' | 'ready' | 'error';
  url?: string;
};

function ConsignmentPhotoPreview({ paths }: { paths: string[] }) {
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const links: string[] = [];
    setPreviews(Object.fromEntries(paths.map(path => [path, { status: 'loading' as const }])));

    // Resolve each path independently: a deleted/expired object must not prevent
    // staff from previewing the other photos in this submission.
    paths.forEach(async path => {
      try {
        const [url] = await consignmentPhotoLinks([path]);
        if (!url) throw new Error('รูปไม่พร้อมใช้งาน');
        if (cancelled) { releaseConsignmentPhotoLinks([url]); return; }
        links.push(url);
        if (!cancelled) setPreviews(current => ({ ...current, [path]: { status: 'ready', url } }));
      } catch {
        if (!cancelled) setPreviews(current => ({ ...current, [path]: { status: 'error' } }));
      }
    });

    const expiry = setTimeout(() => {
      releaseConsignmentPhotoLinks(links);
      setPreviews(Object.fromEntries(paths.map(path => [path, { status: 'error' as const }])));
    }, 300_000);
    return () => { cancelled = true; clearTimeout(expiry); releaseConsignmentPhotoLinks(links); };
  }, [open, paths, reload]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-navy-950 px-3 py-2 text-[11px] font-bold text-gold-400 hover:bg-navy-900"
      >
        <Images className="h-3.5 w-3.5" />
        ดูรูปแนบ ({paths.length})
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="รูปภาพที่ลูกค้าแนบ"
          onKeyDown={event => { if (event.key === 'Escape') close(); }}
          onClick={close}
        >
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-navy-950">รูปภาพที่ลูกค้าแนบ</h2>
                <p className="text-[11px] text-gray-500">ลิงก์รูปนี้ใช้ได้ชั่วคราวและเปิดให้เฉพาะเจ้าหน้าที่</p>
              </div>
              <button type="button" onClick={close} aria-label="ปิดรูปภาพ" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-navy-950">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {paths.map((path, index) => {
                const preview = previews[path];
                return (
                  <div key={`${path}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    {preview?.status === 'ready' && preview.url ? (
                      <Image src={preview.url} alt={`รูปแนบที่ ${index + 1}`} fill unoptimized sizes="(max-width: 640px) 50vw, 33vw" className="object-contain"
                        onError={() => setPreviews(current => ({ ...current, [path]: { status: 'error' } }))} />
                    ) : preview?.status === 'loading' ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-[11px] text-gray-500">
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                        กำลังเปิดรูป...
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-gray-500">
                        รูปนี้ไม่พร้อมใช้งานหรือหมดอายุแล้ว
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setReload(value => value + 1)} className="mt-4 rounded-lg border px-3 py-2 text-xs text-navy-950">โหลดรูปใหม่</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | Inquiry['status']>('all');

  useEffect(() => {
    fetchInquiries().then(setInquiries).catch(() => setError('โหลดข้อมูลไม่ได้ กรุณาตรวจการเชื่อมต่อและสิทธิ์เข้าใช้งาน')).finally(() => setLoading(false));
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: Inquiry['status']) => {
    setError('');
    try {
      await updateInquiryStatus(id, newStatus);
      setInquiries(current => current.map(inq => inq.id === id ? { ...inq, status: newStatus } : inq));
    } catch {
      setError('เปลี่ยนสถานะไม่สำเร็จ กรุณาลองใหม่');
    }
  };

  const filtered = inquiries.filter((inq) => {
    if (statusFilter !== 'all' && inq.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-20">
      {error && <p role="alert" className="p-4 bg-red-50 text-red-700 rounded-xl">{error}</p>}
      {loading && <p role="status">กำลังโหลดข้อมูล...</p>}
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-surface-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-950">รายการผู้ติดต่อ & ฝากขายทรัพย์</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            ระบบจัดการข้อความ ลูกค้าที่นัดชมทรัพย์ และรายการที่เจ้าของทรัพย์ส่งมาฝากขาย
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'all' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            ทั้งหมด ({inquiries.length})
          </button>
          <button
            onClick={() => setStatusFilter('new')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'new' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            รอดำเนินการ ({inquiries.filter((i) => i.status === 'new').length})
          </button>
          <button
            onClick={() => setStatusFilter('contacted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'contacted' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            ติดต่อแล้ว ({inquiries.filter((i) => i.status === 'contacted').length})
          </button>
          <button
            onClick={() => setStatusFilter('scheduled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'scheduled' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            นัดหมายแล้ว ({inquiries.filter((i) => i.status === 'scheduled').length})
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              statusFilter === 'closed' ? 'bg-navy-950 text-gold-400' : 'bg-gray-100 text-gray-600'
            }`}
          >
            ปิดงาน ({inquiries.filter((i) => i.status === 'closed').length})
          </button>
        </div>
      </div>

      {/* Inquiries Cards List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-surface-border">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-navy-950 text-base">ไม่พบรายการผู้ติดต่อในสถานะนี้</h3>
          </div>
        ) : (
          filtered.map((inq) => (
            <div
              key={inq.id}
              className="bg-white rounded-2xl p-6 border border-surface-border shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between gap-6"
            >
              {/* Left Details */}
              <div className="space-y-3 flex-grow max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    inq.status === 'new'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : inq.status === 'contacted'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : inq.status === 'scheduled'
                      ? 'bg-blue-100 text-blue-900 border border-blue-300'
                      : 'bg-purple-100 text-purple-900 border border-purple-300'
                  }`}>
                    {inq.status === 'new'
                      ? '• รอดำเนินการ (ใหม่)'
                      : inq.status === 'contacted'
                      ? '✓ ติดต่อลูกค้าแล้ว'
                      : inq.status === 'scheduled'
                      ? '◷ นัดหมายแล้ว'
                      : '✓ ปิดงาน'}
                  </span>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                    {inq.inquiry_type === 'viewing'
                      ? 'นัดหมายเข้าชมสถานที่จริง'
                      : inq.inquiry_type === 'consignment_sell'
                      ? 'ฝากขายบ้าน / ที่ดิน'
                      : 'สอบถามรายละเอียดทรัพย์'}
                  </span>

                  <span className="text-[11px] text-gray-400 ml-auto flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatThaiDate(inq.created_at)}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-navy-950 flex items-center space-x-2">
                    <User className="w-4 h-4 text-gold-600" />
                    <span>{inq.name}</span>
                  </h3>
                  {inq.property_title && (
                    <div className="text-xs text-gold-700 font-semibold mt-0.5">
                      อสังหาริมทรัพย์ที่สนใจ: {inq.property_title}
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl text-xs text-gray-800 leading-relaxed whitespace-pre-line border border-gray-100">
                  {inq.message}
                </div>

                {inq.consignment_details && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] text-gray-600 bg-gold-50/60 p-3 rounded-xl border border-gold-200">
                    <div>
                      <span className="text-gray-400 block">ประเภท:</span>
                      <strong className="text-navy-950">{inq.consignment_details.property_type}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">ทำเล:</span>
                      <strong className="text-navy-950">{inq.consignment_details.district}, {inq.consignment_details.province}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">ราคาที่ต้องการ:</span>
                      <strong className="text-gold-700">฿{new Intl.NumberFormat('th-TH').format(inq.consignment_details.expected_price)}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block">รูปถ่ายที่แนบ:</span>
                      <strong className="text-navy-950">{inq.consignment_details.photos_count || 0} ภาพ</strong>
                    </div>
                    {inq.consignment_details.photo_paths?.length ? (
                      <div className="col-span-2 sm:col-span-4">
                        <ConsignmentPhotoPreview paths={inq.consignment_details.photo_paths} />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Right Action Buttons */}
              <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 space-y-3 flex-shrink-0 md:w-56">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    ช่องทางติดต่อกลับ
                  </span>
                  <a
                    href={`tel:${inq.phone}`}
                    className="w-full py-2 px-3 bg-navy-950 hover:bg-navy-900 text-gold-400 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>โทร: {inq.phone}</span>
                  </a>

                  {inq.line_id && (
                    <a
                      href={`https://line.me/R/ti/p/${inq.line_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 px-3 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-current" />
                      <span>LINE: {inq.line_id}</span>
                    </a>
                  )}
                </div>

                <div className="pt-2">
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    เปลี่ยนสถานะ
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleUpdateStatus(inq.id, 'contacted')}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                        inq.status === 'contacted'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-emerald-100 hover:text-emerald-800'
                      }`}
                    >
                      ติดต่อแล้ว
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(inq.id, 'scheduled')}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                        inq.status === 'scheduled'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-800'
                      }`}
                    >
                      นัดหมายแล้ว
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(inq.id, 'closed')}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                        inq.status === 'closed'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-800'
                      }`}
                    >
                      ปิดงาน
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
