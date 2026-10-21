import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  PackageCheck,
  Route,
  ShieldCheck,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { WorkspaceId } from '../../context/WmsContext';

interface AppGuideModalProps {
  onClose: () => void;
  onOpenWorkspace: (workspace: WorkspaceId) => void;
}

interface GuideDestination {
  id: WorkspaceId;
  label: string;
}

interface GuideStep {
  section: string;
  title: string;
  description: string;
  features: string[];
  icon: LucideIcon;
  destinations: GuideDestination[];
}

const guideSteps: GuideStep[] = [
  {
    section: 'เริ่มต้นใช้งาน',
    title: 'ยินดีต้อนรับสู่ระบบคลังสินค้า TTS',
    description: 'คู่มือนี้พาไปรู้จักหน้าทำงานหลักและวิธีส่งต่องาน ตั้งแต่ค้นหาสต็อก ไปจนถึงหยิบสินค้าและตรวจประวัติ',
    features: [
      'เลือกคลังและบทบาทผู้ใช้จากแถบด้านบนเพื่อดูงานตามหน้าที่',
      'เปิดหน้าทำงานจากเมนูด้านซ้าย หรือใช้ปุ่มพาไปยังหน้าในคู่มือนี้',
      'ฝ่ายขายเริ่มจากดูสินค้าพร้อมเสนอขาย [02] และติดตามรายการจองตั้งแต่ [03] ถึง [04]',
    ],
    icon: ShieldCheck,
    destinations: [{ id: 'WMS-05', label: 'ไปที่สินค้าพร้อมจอง' }],
  },
  {
    section: 'จองสินค้าและยืนยัน SO',
    title: 'จองสินค้าและแนบใบเสนอราคา',
    description: 'ฝ่ายขายเลือกหลายล็อตเป็นหนึ่งคำขอจองต่อหนึ่งใบเสนอราคา [02] → [03] รอคลังตรวจ แล้วแนบใบเสนอราคาที่ลูกค้ายืนยันเพื่อยืนยันเป็น [04]',
    features: [
      'รายการ [03] ที่ไม่มีใบเสนอราคาที่ลูกค้ายืนยันจะคืนเป็น [02] เมื่อครบ 7 วัน',
      'ระบบอ่านรายการสินค้าจากไฟล์ใบเสนอราคาและจับคู่กับล็อตที่จอง · วันส่งและประตูดึงจากใบเสนอราคาและ Logistics App',
      'ยืนยันแล้วระบบออกใบเบิกให้เอง: เหล็กสำเร็จรูปไปหยิบทันที เหล็กแปรรูปไปแปรรูปก่อน แล้วออกใบเบิกเมื่อ QC ผ่าน',
    ],
    icon: ClipboardList,
    destinations: [{ id: 'WMS-03', label: 'ไปที่รายการจองและติดตาม' }],
  },
  {
    section: 'ค้นหาสินค้าและสต็อก',
    title: 'ค้นหาสินค้าในคลัง',
    description: 'ทุกบทบาทเปิดดูสินค้า [02] ที่พร้อมจองได้ ส่วนปุ่มจองใช้ได้สำหรับฝ่ายขายเท่านั้น',
    features: [
      'ค้นหาด้วยรหัสสินค้า รายละเอียด เกรด หรือพิกัดช่องจัดเก็บ',
      'เลือกได้ทั้งเหล็กสำเร็จรูปและเหล็กที่ต้องแปรรูปตามข้อมูล SKU',
      'เมื่อจองแล้ว ปริมาณที่จองจะหายจากรายการ [02] และไปแสดงใน [03]',
    ],
    icon: Boxes,
    destinations: [{ id: 'WMS-05', label: 'ไปที่ค้นหาสินค้า' }],
  },
  {
    section: 'ตรวจสินค้าและแจ้งกำหนด',
    title: 'คลังตรวจตำแหน่ง สภาพ และวันรอ',
    description: 'Operator ตรวจสินค้าตามรายการจองและกรอกวันรอด้วยตนเอง ระบบแสดงเวลามาตรฐานและคิวเป็นคำแนะนำ',
    features: [
      'บันทึกตำแหน่งที่พบและสภาพสินค้า',
      'แยกของชำรุดเป็นสถานะ [07] และเสนอสินค้าทดแทนได้',
      'ฝ่ายขายรับทราบวันรอและข้อเสนอทดแทนก่อนดำเนินการต่อ',
    ],
    icon: ClipboardList,
    destinations: [{ id: 'WMS-04', label: 'ไปที่ตรวจสินค้า' }],
  },
  {
    section: 'คิวแปรรูป',
    title: 'ออกและติดตามใบงานแปรรูป',
    description: 'SKU master ระบุว่าสินค้าต้องผ่านการแปรรูปหรือไม่ และกำหนดจำนวนวันมาตรฐานให้ Operator ใช้ประกอบการวางคิว',
    features: [
      'ดูงานรอเริ่ม งานระหว่างแปรรูป และงานรอตรวจคุณภาพ',
      'พิมพ์ใบแปรรูปหรือบันทึกเป็น PDF ได้ในหน้าต้นแบบ',
      'ผลผ่านของงานที่ผูกกับ SO คงอยู่ใน [04] ไม่กลับไปขายซ้ำ',
    ],
    icon: Wrench,
    destinations: [{ id: 'WMS-07', label: 'ไปที่คิวแปรรูป' }],
  },
  {
    section: 'หยิบสินค้าและส่งมอบ',
    title: 'หยิบตามรายการจองและยืนยันส่งมอบ',
    description: 'WMS-06 แสดงงานหยิบจากรายการจองที่ผ่านเงื่อนไข ใช้บันทึกผลหยิบและตรวจสอบก่อนส่งมอบ',
    features: [
      'ตรวจใบหยิบและตำแหน่งสินค้าก่อนเริ่มงาน',
      'บันทึกผลหยิบและรายการตรวจสอบให้ครบ',
      'ส่งให้ผู้จัดการยืนยันสถานะพร้อมส่งมอบ [08] ก่อนส่งต่องานขนส่ง',
    ],
    icon: PackageCheck,
    destinations: [{ id: 'WMS-06', label: 'ไปที่งานหยิบและส่งมอบ' }],
  },
  {
    section: 'สถานะและประวัติสินค้า',
    title: 'ติดตามสถานะและประวัติการทำงาน',
    description: 'WMS-11 ใช้ติดตามการเปลี่ยนสถานะ การย้ายโซน งานแปรรูป และงานเคลม พร้อมตรวจย้อนหลังได้',
    features: [
      'ค้นหาสินค้าและตรวจสถานะปัจจุบัน',
      'ดูเหตุการณ์และผู้ดำเนินการจากประวัติการเปลี่ยนแปลง',
      'ตรวจข้อมูลก่อนย้ายโซนหรือส่งต่องานให้ผู้รับผิดชอบถัดไป',
    ],
    icon: Route,
    destinations: [{ id: 'WMS-11', label: 'ไปที่สถานะและประวัติ' }],
  },
  {
    section: 'ข้อมูลและแผนสต็อก',
    title: 'จัดการข้อมูลและวางแผนสต็อก',
    description: 'หน้าสนับสนุนช่วยตรวจข้อมูลตั้งต้นและวางแผนสินค้าคงคลังตามงานที่รับผิดชอบ',
    features: [
      'WMS-02 ตั้งค่ากลุ่มสินค้าและวันแปรรูปมาตรฐานแยกตาม SKU',
      'WMS-08 ติดตามอายุสินค้า เป้าหมายระบายสินค้า และกำลังรองรับของคลัง',
      'ใช้ข้อมูลในหน้าสรุปเพื่อประกอบการตรวจงานและจัดลำดับงาน',
    ],
    icon: Database,
    destinations: [
      { id: 'WMS-02', label: 'เปิดข้อมูลตั้งต้น' },
      { id: 'WMS-08', label: 'เปิดแผนเคลียร์สต็อก' },
    ],
  },
];

export const AppGuideModal: React.FC<AppGuideModalProps> = ({ onClose, onOpenWorkspace }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, []);

  const step = guideSteps[currentStep];
  const StepIcon = step.icon;
  const isLastStep = currentStep === guideSteps.length - 1;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        aria-labelledby="app-guide-title"
        aria-modal="true"
        className="flex max-h-[min(90dvh,46rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <header className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-shell)]">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
              <StepIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-bold sm:text-base" id="app-guide-title">คู่มือแนะนำใช้งานระบบคลังสินค้า</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--text-secondary)] sm:text-xs">
                <span>ขั้นตอนที่ {currentStep + 1} จากทั้งหมด {guideSteps.length}</span>
                <span aria-hidden="true" className="rounded-full bg-blue-500/10 px-2 py-0.5 font-medium text-blue-700 dark:text-blue-200">{step.section}</span>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              aria-label="ปิดคู่มือ"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-blue-500"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            aria-label={`ความคืบหน้าคู่มือ ${currentStep + 1} จาก ${guideSteps.length} ขั้นตอน`}
            aria-valuemax={guideSteps.length}
            aria-valuemin={0}
            aria-valuenow={currentStep + 1}
            className="h-1 w-full bg-[var(--border-color)]"
            role="progressbar"
          >
            <div className="h-full bg-blue-600 transition-[width] duration-300" style={{ width: `${((currentStep + 1) / guideSteps.length) * 100}%` }} />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5" aria-live="polite">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-shell)] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-blue-600 shadow-sm dark:text-blue-300">
                <StepIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold leading-snug sm:text-lg">{step.title}</h3>
                <p className="mt-1 text-xs font-medium leading-relaxed text-blue-700 dark:text-blue-200 sm:text-sm">{step.section}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{step.description}</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] sm:text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              สิ่งที่ทำได้ในขั้นตอนนี้
            </h4>
            <ul className="space-y-2">
              {step.features.map((feature) => (
                <li className="flex items-start gap-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 text-xs leading-relaxed sm:text-sm" key={feature}>
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              <strong className="text-amber-700 dark:text-amber-300">ระบบตัวอย่าง:</strong> ข้อมูลและเหตุการณ์ในแอปเป็นข้อมูลจำลอง
            </p>
            <div className="flex flex-wrap gap-2">
              {step.destinations.map((destination) => (
                <button
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  key={destination.id}
                  onClick={() => onOpenWorkspace(destination.id)}
                  type="button"
                >
                  {destination.label}<ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] bg-[var(--bg-shell)] px-4 py-3 sm:px-6">
          <button
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((index) => Math.max(0, index - 1))}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />ย้อนกลับ
          </button>
          <div className="ml-auto flex items-center gap-2">
            {!isLastStep && (
              <button
                className="min-h-9 rounded-lg px-3 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                onClick={onClose}
                type="button"
              >
                ข้ามคู่มือ
              </button>
            )}
            <button
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              onClick={() => isLastStep ? onClose() : setCurrentStep((index) => Math.min(guideSteps.length - 1, index + 1))}
              type="button"
            >
              {isLastStep ? 'เสร็จสิ้น' : 'ถัดไป'}
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
};
