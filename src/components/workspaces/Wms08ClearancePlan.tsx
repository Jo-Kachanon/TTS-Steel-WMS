import React, { useState, useMemo } from 'react';
import { useWms } from '../../context/WmsContext';
import {
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  ShieldCheck,
  Play,
  RotateCcw,
  Check,
  Sliders,
  Gauge,
  SlidersHorizontal,
} from 'lucide-react';

const clearanceStatusThai: Record<string, string> = {
  DRAFT: 'ฉบับร่าง', IN_REVIEW: 'รอตรวจทาน', APPROVED: 'อนุมัติแล้ว', ACTIVE: 'กำลังดำเนินงาน',
  PAUSED: 'พักแผน', CLOSED: 'ปิดแผน', REJECTED: 'ส่งกลับแก้ไข', SAVED: 'บันทึกแล้ว',
  PENDING: 'รอดำเนินการ', REVIEWED: 'ตรวจทานแล้ว', 'IN REVIEW': 'รอตรวจทาน',
  COMPLETED: 'สำเร็จตามแผน', BEHIND: 'ล่าช้ากว่าแผน', ON_TRACK: 'ตามแผน',
};

export const Wms08ClearancePlan: React.FC = () => {
  const {
    clearancePlan,
    policies,
    activePolicyId,
    inventory,
    currentRole,
    saveClearancePlanDraft,
    submitClearancePlanForReview,
    reviewClearancePlan,
    activateClearancePlan,
    pauseClearancePlan,
    closeClearancePlan,
    triggerGateBlocked,
  } = useWms();

  // 1. Shared WMS-02 Policy & Derived Threshold
  const currentPolicy = policies.find((p) => p.id === activePolicyId) || policies[0];
  const agingThreshold = currentPolicy.agingThresholdDays || 90;
  const canEditPlan = currentRole === 'warehouse_manager' && clearancePlan.status !== 'IN_REVIEW';
  const unknownAgeTons = inventory.filter((item) => item.ageDays <= 0).reduce((sum, item) => sum + item.totalWeightTons, 0);

  const [activeTab, setActiveTab] = useState<'plan' | 'scenario' | 'progress'>('plan');
  const [selectedHorizon, setSelectedHorizon] = useState<number>(clearancePlan.activeHorizonMonths);

  // 2. Editable Target Tonnes and Resources/Rate Inputs
  const totalBaseline = clearancePlan.baselineFrozenTons;
  const [targetTonsInput, setTargetTonsInput] = useState<number>(clearancePlan.targetTons);
  const [craneTonsPerShift, setCraneTonsPerShift] = useState<number>(clearancePlan.resourceAssumptions?.craneTonsPerShift || 50.0);
  const [shiftsPerDay, setShiftsPerDay] = useState<number>(clearancePlan.resourceAssumptions?.shiftsPerDay || 2);
  const [workDaysPerMonth, setWorkDaysPerMonth] = useState<number>(clearancePlan.resourceAssumptions?.workDaysPerMonth || 25);
  const [craneClearanceSharePct, setCraneClearanceSharePct] = useState<number>(clearancePlan.resourceAssumptions?.craneClearanceSharePct || 20);
  const [reviewNote, setReviewNote] = useState<string>('');
  const [closeNote, setCloseNote] = useState<string>('');

  // Calculate Target %
  const targetPercent = Math.min(100, Math.round((targetTonsInput / totalBaseline) * 1000) / 10);

  // Compute dedicated monthly crane capacity for clearance
  const dedicatedMonthlyCraneCapacity = useMemo(() => {
    return craneTonsPerShift * shiftsPerDay * workDaysPerMonth * (craneClearanceSharePct / 100);
  }, [craneTonsPerShift, shiftsPerDay, workDaysPerMonth, craneClearanceSharePct]);

  // Actual cleared is strictly from accepted LGX-03 events only
  const actualClearedTons = clearancePlan.monthlyTargets.reduce((sum, month) => sum + month.actualClearedTons, 0);
  const remainingTarget = Math.max(0, targetTonsInput - actualClearedTons);

  // 3. Computed Dynamic Scenarios for 3, 6, 9, 12, 24, 36 Months
  const horizonOptions = [3, 6, 9, 12, 24, 36];
  const computedScenarios = useMemo(() => {
    return horizonOptions.map((h) => {
      const runRate = targetTonsInput / h;
      const capacityGapTons = Math.max(0, runRate - dedicatedMonthlyCraneCapacity);
      const gapPct =
        capacityGapTons > 0 && dedicatedMonthlyCraneCapacity > 0
          ? Math.round((capacityGapTons / dedicatedMonthlyCraneCapacity) * 1000) / 10
          : capacityGapTons > 0
          ? 100
          : 0;
      const utilizationPct = dedicatedMonthlyCraneCapacity > 0
        ? (runRate / dedicatedMonthlyCraneCapacity) * 100
        : runRate > 0 ? 100 : 0;

      let feasibility: 'HIGH' | 'MEDIUM' | 'CAPACITY_CONSTRAINED' = 'HIGH';
      if (capacityGapTons > 0) {
        feasibility = 'CAPACITY_CONSTRAINED';
      } else if (utilizationPct >= 80 || h >= 24) {
        feasibility = 'MEDIUM';
      }

      const reason = capacityGapTons > 0
        ? `ต้องการ ${runRate.toFixed(1)} ตัน/เดือน แต่กำลังเครนเฉพาะ Clearance รองรับ ${dedicatedMonthlyCraneCapacity.toFixed(1)} ตัน/เดือน ขาด ${capacityGapTons.toFixed(1)} ตัน/เดือน (${gapPct.toFixed(1)}%); ต้องเพิ่มกะ/กำลังหรือเลือกระยะยาวขึ้น`
        : utilizationPct >= 80
        ? `อยู่ในกำลังที่คำนวณได้ แต่ใช้กำลัง ${utilizationPct.toFixed(1)}% เหลือ buffer ${(dedicatedMonthlyCraneCapacity - runRate).toFixed(1)} ตัน/เดือน; ยืนยันกำลังคนและคิวรถก่อนอนุมัติ`
        : h >= 24
        ? `กำลังเครนรองรับและเหลือ buffer ${(dedicatedMonthlyCraneCapacity - runRate).toFixed(1)} ตัน/เดือน แต่กรอบ ${h} เดือนยาว ควรทบทวนคุณภาพ stock และข้อมูลอายุระหว่างทาง`
        : `กำลังเครนรองรับและเหลือ buffer ${(dedicatedMonthlyCraneCapacity - runRate).toFixed(1)} ตัน/เดือน ภายใต้นโยบาย ${currentPolicy.version}`;

      return {
        horizonMonths: h,
        monthlyRunRateTons: runRate,
        feasibility,
        craneCapacityGapPercent: gapPct,
        capacityGapTons,
        utilizationPct,
        reason,
      };
    });
  }, [targetTonsInput, dedicatedMonthlyCraneCapacity, currentPolicy]);

  // 4. Dynamic Monthly Plan Table for Selected Horizon
  const dynamicMonthlyPlan = useMemo(() => {
    const monthlyTarget = targetTonsInput / selectedHorizon;
    const months = [
      'ต.ค. 2026',
      'พ.ย. 2026',
      'ธ.ค. 2026',
      'ม.ค. 2027',
      'ก.พ. 2027',
      'มี.ค. 2027',
      'เม.ย. 2027',
      'พ.ค. 2027',
      'มิ.ย. 2027',
      'ก.ค. 2027',
      'ส.ค. 2027',
      'ก.ย. 2027',
      'ต.ค. 2027',
      'พ.ย. 2027',
      'ธ.ค. 2027',
      'ม.ค. 2028',
      'ก.พ. 2028',
      'มี.ค. 2028',
      'เม.ย. 2028',
      'พ.ค. 2028',
      'มิ.ย. 2028',
      'ก.ค. 2028',
      'ส.ค. 2028',
      'ก.ย. 2028',
      'ต.ค. 2028',
      'พ.ย. 2028',
      'ธ.ค. 2028',
      'ม.ค. 2029',
      'ก.พ. 2029',
      'มี.ค. 2029',
      'เม.ย. 2029',
      'พ.ค. 2029',
      'มิ.ย. 2029',
      'ก.ค. 2029',
      'ส.ค. 2029',
      'ก.ย. 2029',
    ];

    return Array.from({ length: selectedHorizon }).map((_, idx) => {
      const monthName = months[idx] || `เดือนที่ ${idx + 1}`;
      const actual = clearancePlan.monthlyTargets[idx]?.actualClearedTons || 0;
      const variance = actual - monthlyTarget;
      const status: 'COMPLETED' | 'BEHIND' | 'ON_TRACK' =
        actual >= monthlyTarget ? 'COMPLETED' : idx === 0 ? 'BEHIND' : 'ON_TRACK';

      return {
        month: monthName,
        targetTons: monthlyTarget,
        actualClearedTons: actual,
        varianceTons: variance,
        owner: clearancePlan.monthlyTargets[idx]?.owner || 'สุชาติ ม. (ผจก.คลัง)',
        status,
      };
    });
  }, [targetTonsInput, selectedHorizon, clearancePlan.monthlyTargets]);

  const lifecycleSteps = [
    {
      step: '1. ร่างแผน',
      status: clearancePlan.status === 'DRAFT' ? 'DRAFT' : clearancePlan.status === 'REJECTED' ? 'REJECTED' : 'SAVED',
      complete: !['DRAFT', 'REJECTED'].includes(clearancePlan.status),
    },
    {
      step: '2. ตรวจทาน',
      status: clearancePlan.status === 'IN_REVIEW' ? 'IN REVIEW' : ['DRAFT', 'REJECTED'].includes(clearancePlan.status) ? 'PENDING' : 'REVIEWED',
      complete: ['APPROVED', 'ACTIVE', 'PAUSED', 'CLOSED'].includes(clearancePlan.status),
    },
    {
      step: '3. อนุมัติ',
      status: clearancePlan.status === 'REJECTED' ? 'REJECTED' : ['APPROVED', 'ACTIVE', 'PAUSED', 'CLOSED'].includes(clearancePlan.status) ? 'APPROVED' : 'PENDING',
      complete: ['APPROVED', 'ACTIVE', 'PAUSED', 'CLOSED'].includes(clearancePlan.status),
    },
    {
      step: '4. ดำเนินงาน',
      status: clearancePlan.status === 'ACTIVE' ? 'ACTIVE' : clearancePlan.status === 'PAUSED' ? 'PAUSED' : clearancePlan.status === 'CLOSED' ? 'CLOSED' : 'PENDING',
      complete: ['ACTIVE', 'PAUSED', 'CLOSED'].includes(clearancePlan.status),
    },
  ];

  const saveDraft = () => {
    const saved = saveClearancePlanDraft(targetTonsInput, selectedHorizon as 3 | 6 | 9 | 12 | 24 | 36, {
      craneTonsPerShift,
      shiftsPerDay,
      workDaysPerMonth,
      craneClearanceSharePct,
    });
    if (saved) setActiveTab('plan');
  };

  return (
    <div className="flex flex-col gap-4 text-[var(--text-primary)]">
      {/* Header Banner - Linked to Active Policy & Version */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[17px] font-bold">WMS-08 แผนระบายสินค้าและกำลังรองรับ</h1>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold border border-blue-500/30">
                  นโยบาย: {currentPolicy.name} ({currentPolicy.version})
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                  เกณฑ์อายุ: &gt;{agingThreshold} วัน
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                การจำลองกรอบเวลา 3–36 เดือน คำนวณความสอดคล้องกับขีดความสามารถการยกเครน และนับผลการส่งมอบจริง (LGX-03 เท่านั้น)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={`px-3 py-1 rounded-full text-[12px] font-mono font-bold border ${
                clearancePlan.status === 'ACTIVE'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : clearancePlan.status === 'REJECTED'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}
            >
              สถานะ: {clearanceStatusThai[clearancePlan.status] || clearancePlan.status} ({clearancePlan.version})
            </span>
            {currentRole === 'warehouse_manager' && clearancePlan.status !== 'IN_REVIEW' && (
              <button onClick={saveDraft} className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-[11px] font-bold">
                บันทึกร่างแผน
              </button>
            )}
            {currentRole === 'warehouse_manager' && clearancePlan.status === 'DRAFT' && (
              <button onClick={submitClearancePlanForReview} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold">
                ส่งผู้อนุมัติตรวจ
              </button>
            )}
            {currentRole === 'planning_approver' && clearancePlan.status === 'IN_REVIEW' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="เหตุผลเมื่อส่งกลับแก้" className="px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[11px]" />
                <button onClick={() => reviewClearancePlan('APPROVE', reviewNote)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">อนุมัติแผน</button>
                <button onClick={() => reviewClearancePlan('REJECT', reviewNote)} disabled={!reviewNote.trim()} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold disabled:opacity-50">ส่งกลับแก้</button>
              </div>
            )}
            {currentRole === 'warehouse_manager' && clearancePlan.status === 'APPROVED' && (
              <button onClick={activateClearancePlan} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">เปิดใช้แผน</button>
            )}
            {currentRole === 'warehouse_manager' && clearancePlan.status === 'ACTIVE' && (
              <button onClick={pauseClearancePlan} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold">พักแผน</button>
            )}
            {currentRole === 'warehouse_manager' && clearancePlan.status === 'PAUSED' && (
              <button onClick={activateClearancePlan} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">เปิดแผนต่อ</button>
            )}
          </div>
        </div>

        {/* Strict Policy Callout: Pure Physical Planning - Zero Prices */}
        <div className="mt-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200 text-[11.5px] font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>
              <strong>นโยบาย WMS:</strong> แสดงเฉพาะปริมาณน้ำหนัก (ตัน), กำลังยกเครน, และรอบส่งมอบจริง (ไม่มีการแสดงราคา ส่วนลด ต้นทุน หรือเงื่อนไขทางการค้า)
            </span>
          </div>
          <span className="text-[10px] text-blue-300">ข้อกำหนดส่วน 4.10</span>
        </div>

        {/* 3 Workspace Tabs */}
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto text-[12.5px]">
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'plan'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            1. แผนหลักและการปรับตั้งตัวแปร (Plan & Capacity Inputs)
          </button>
          <button
            onClick={() => setActiveTab('scenario')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'scenario'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            2. จำลองรอบเวลา 3–36 เดือน (Scenario Simulation)
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors ${
              activeTab === 'progress'
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-shell)]'
            }`}
          >
            3. ตารางแผนและผลรายเดือน ({selectedHorizon} เดือน)
          </button>
        </div>
      </div>

      {/* Tab 1: Plan Overview & Editable Capacity Inputs */}
      {activeTab === 'plan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Key Metrics Cards (4 Cards across 12 Cols) */}
          <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex flex-col gap-1">
              <span className="text-[11px] font-mono text-[var(--text-secondary)] uppercase">
                ยอดสต็อกแช่แข็งตั้งต้น (Frozen Baseline)
              </span>
              <span className="font-mono text-[22px] font-bold text-blue-400">
                {totalBaseline.toFixed(1)} <span className="text-[14px] text-[var(--text-primary)]">ตัน</span>
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                ตัดยอดเมื่อ: {clearancePlan.baselineDate}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex flex-col gap-1">
              <span className="text-[11px] font-mono text-[var(--text-secondary)] uppercase">
                เป้าหมายระบายสต็อก (Target Qty)
              </span>
              <span className="font-mono text-[22px] font-bold text-amber-400">
                {targetTonsInput.toFixed(1)} <span className="text-[14px] text-[var(--text-primary)]">ตัน</span>
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                คิดเป็น {targetPercent.toFixed(1)}% ของสต็อกแช่แข็ง
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex flex-col gap-1">
              <span className="text-[11px] font-mono text-[var(--text-secondary)] uppercase">
                ระบายออกสำเร็จจริง (Actual Cleared)
              </span>
              <span className="font-mono text-[22px] font-bold text-emerald-400">
                {actualClearedTons.toFixed(1)} <span className="text-[14px] text-[var(--text-primary)]">ตัน</span>
              </span>
              <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                นับเฉพาะยอด LGX-03 Handover ครั้งเดียว
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex flex-col gap-1">
              <span className="text-[11px] font-mono text-[var(--text-secondary)] uppercase">
                เป้าหมายคงเหลือ (Remaining Target)
              </span>
              <span className="font-mono text-[22px] font-bold text-slate-300">
                {remainingTarget.toFixed(1)} <span className="text-[14px] text-[var(--text-primary)]">ตัน</span>
              </span>
              <span className="text-[11px] text-[var(--text-secondary)] font-mono">
                กรอบเวลาที่เลือก: {selectedHorizon} เดือน
              </span>
            </div>
          </div>

          {/* Left: Editable Target & Resource Parameters */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Interactive Inputs Box */}
            <div className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                <span className="font-bold text-[14px] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-500" />
                  <span>กำหนดเป้าหมายและทรัพยากร</span>
                </span>
                <span className="text-[11px] font-mono text-emerald-400">ตัวอย่างผลคำนวณจากค่าที่กรอก</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[var(--text-secondary)]">
                    เป้าหมายการระบายสต็อก (ตัน):
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="10"
                    max={totalBaseline}
                    value={targetTonsInput}
                    onChange={(e) => setTargetTonsInput(parseFloat(e.target.value) || 0)}
                    disabled={!canEditPlan}
                    className="p-1.5 text-[14px] font-mono font-bold text-amber-400 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    สัดส่วน: {targetPercent.toFixed(1)}% จากสต็อกตั้งต้น {totalBaseline} ตัน
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[var(--text-secondary)]">
                    กำลังยกเครนหลัก (ตัน / กะ):
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="10"
                    value={craneTonsPerShift}
                    onChange={(e) => setCraneTonsPerShift(parseFloat(e.target.value) || 0)}
                    disabled={!canEditPlan}
                    className="p-1.5 text-[14px] font-mono font-bold text-blue-400 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                  <span className="text-[10px] text-[var(--text-secondary)]">กำลังรองรับเครนเหนือศีรษะ ช่อง 03</span>
                </div>

                <div className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[var(--text-secondary)]">
                    จำนวนกะต่อวัน และวันทำงานต่อเดือน:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={shiftsPerDay}
                      onChange={(e) => setShiftsPerDay(parseInt(e.target.value) || 1)}
                      disabled={!canEditPlan}
                      className="p-1.5 text-[13px] font-mono font-bold text-[var(--text-primary)] bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                    <input
                      type="number"
                      min="10"
                      max="31"
                      value={workDaysPerMonth}
                      onChange={(e) => setWorkDaysPerMonth(parseInt(e.target.value) || 20)}
                      disabled={!canEditPlan}
                      className="p-1.5 text-[13px] font-mono font-bold text-[var(--text-primary)] bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg"
                    />
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {shiftsPerDay} กะ/วัน • {workDaysPerMonth} วัน/เดือน
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-[var(--text-secondary)]">
                    สัดส่วนกำลังเครนสำหรับงาน Clearance (%):
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={craneClearanceSharePct}
                    onChange={(e) => setCraneClearanceSharePct(parseInt(e.target.value) || 20)}
                    disabled={!canEditPlan}
                    className="p-1.5 text-[14px] font-mono font-bold text-emerald-400 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg"
                  />
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    กำลังเครนเฉพาะส่วน: {dedicatedMonthlyCraneCapacity.toFixed(1)} ตัน / เดือน
                  </span>
                </div>
              </div>
            </div>

            {/* Governance Gates Box */}
            <div className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs flex flex-col gap-3">
              <span className="font-bold text-[14px] text-[var(--text-primary)]">
                กรอบนโยบายและการควบคุม (Governance Lifecycle Gates)
              </span>
              <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-mono">
                {lifecycleSteps.map((s, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg bg-[var(--bg-shell)] border font-bold ${s.complete ? 'border-emerald-500/30 text-emerald-400' : s.status === 'REJECTED' ? 'border-rose-500/30 text-rose-300' : 'border-[var(--border-color)] text-[var(--text-secondary)]'}`}
                  >
                    <div>{s.step}</div>
                    <span className="text-[10px]">{s.complete ? '✓ ' : ''}{clearanceStatusThai[s.status] || s.status}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-[var(--text-secondary)]">
                <div className="p-2 rounded bg-[var(--bg-shell)] border border-[var(--border-color)]">
                  ผู้ส่งตรวจ: <strong className="text-[var(--text-primary)]">{clearancePlan.submittedBy || 'ยังไม่ส่งตรวจ'}</strong>
                  {' '}• ผู้อนุมัติ: <strong className="text-[var(--text-primary)]">{clearancePlan.reviewedBy || 'ยังไม่มีผล'}</strong>
                </div>
                <div className="p-2 rounded bg-[var(--bg-shell)] border border-[var(--border-color)]">
                  ผู้เปิดใช้: <strong className="text-[var(--text-primary)]">{clearancePlan.activatedBy || 'ยังไม่เปิดใช้'}</strong>
                  {' '}• แผน version <strong className="font-mono text-blue-400">{clearancePlan.version}</strong>
                </div>
              </div>

              {currentRole === 'warehouse_manager' && ['ACTIVE', 'PAUSED'].includes(clearancePlan.status) && (
                <div className="flex flex-wrap gap-2">
                  <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="เหตุผลปิดแผน" className="flex-1 min-w-48 px-2 py-1.5 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[11px]" />
                  <button onClick={() => closeClearancePlan(closeNote)} disabled={!closeNote.trim()} className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold disabled:opacity-50">ปิดแผน</button>
                </div>
              )}

              <div className="divide-y divide-[var(--border-color)] rounded-lg border border-[var(--border-color)] bg-[var(--bg-shell)] px-3">
                {clearancePlan.history.slice(-4).reverse().map((event, idx) => (
                  <div key={`${event.date}-${idx}`} className="py-1.5 flex items-start justify-between gap-3 text-[10.5px]">
                    <span className="font-mono text-blue-400">{event.action}</span>
                    <span className="flex-1 text-[var(--text-primary)]">{event.note}</span>
                    <span className="text-[var(--text-secondary)]">{event.actor} · {event.date}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] text-[12px] font-mono leading-relaxed text-[var(--text-secondary)]">
                <div><strong>เกณฑ์การนับผลสำเร็จ:</strong></div>
                <p className="mt-1 text-[var(--text-primary)]">
                  การเคลียร์สต็อกที่แท้จริง จะนับเฉพาะยอดที่ตรวจรับขึ้นรถขนส่งและมีสัญญาณตอบรับ{' '}
                  <strong className="text-emerald-400">LGX-03 การส่งมอบออกจากคลัง</strong> สำเร็จแล้วเพียงครั้งเดียวเท่านั้น
                  (สถานะพร้อมส่งมอบ ใบจอง หรือคำขอของฝ่ายขายไม่ถือเป็นการเคลียร์สต็อก)
                </p>
              </div>
            </div>
          </div>

          {/* Right: Working Horizon Selector & Resource Capacity Status */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs flex flex-col gap-3">
              <span className="font-bold text-[13px] flex items-center gap-1.5 text-blue-400">
                <Calendar className="w-4 h-4" />
                <span>เลือกกรอบเวลาทำงาน</span>
              </span>
              <p className="text-[12px] text-[var(--text-secondary)]">
                เลือกกรอบเวลาเพื่อสร้างแผนงานรายเดือนและวิเคราะห์ความเป็นไปได้:
              </p>
              <div className="grid grid-cols-3 gap-2">
                {horizonOptions.map((h) => (
                  <button
                    key={h}
                    onClick={() => setSelectedHorizon(h)}
                    disabled={!canEditPlan}
                    className={`py-2 px-2.5 rounded-lg font-mono font-bold text-[12px] border transition-all ${
                      selectedHorizon === h
                        ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                        : 'bg-[var(--bg-shell)] text-[var(--text-primary)] border-[var(--border-color)] hover:border-blue-500/50'
                    }`}
                  >
                    {h} เดือน
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-[var(--bg-shell)] border border-[var(--border-color)] text-[11.5px] font-mono mt-1 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">กรอบเวลาที่เลือก:</span>
                  <span className="font-bold text-blue-400">{selectedHorizon} เดือน</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">อัตราเป้าหมายเฉลี่ย:</span>
                  <span className="font-bold text-amber-400">
                    {(targetTonsInput / selectedHorizon).toFixed(1)} ตัน / เดือน
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">กำลังเครนเฉพาะส่วน:</span>
                  <span className="font-bold text-emerald-400">
                    {dedicatedMonthlyCraneCapacity.toFixed(1)} ตัน / เดือน
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs flex flex-col gap-2.5">
              <span className="font-bold text-[13px] text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                คำเตือนคุณภาพข้อมูล (Data-Quality Warnings)
              </span>
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                {clearancePlan.dataQualityWarning}
              </p>
              <div className="p-2.5 rounded bg-[var(--bg-shell)] border border-[var(--border-color)] text-[11px] font-mono text-slate-300">
                สต็อกอายุไม่ทราบวันรับเข้า: {unknownAgeTons.toFixed(1)} ตัน{unknownAgeTons > 0 ? ' (ต้องตรวจสอบก่อนอนุมัติแผน)' : ' (ไม่พบในชุดข้อมูลจำลอง)'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Scenario Comparison (Computed dynamically) */}
      {activeTab === 'scenario' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-color)]">
            <div>
              <h2 className="font-bold text-[15px] flex items-center gap-2">
                <Gauge className="w-5 h-5 text-blue-400" />
                <span>เปรียบเทียบผลคำนวณตามกรอบเวลา 3 / 6 / 9 / 12 / 24 / 36 เดือน</span>
              </h2>
              <span className="text-[12px] text-[var(--text-secondary)]">
                คำนวณจากเป้าหมาย {targetTonsInput.toFixed(1)} ตัน และขีดความสามารถการยกเครน {dedicatedMonthlyCraneCapacity.toFixed(1)} ตัน/เดือน
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="px-2.5 py-1 rounded bg-[var(--bg-shell)] border border-[var(--border-color)]">
                นโยบาย: {currentPolicy.version}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {computedScenarios.map((sc) => (
              <div
                key={sc.horizonMonths}
                onClick={() => setSelectedHorizon(sc.horizonMonths)}
                className={`p-4 rounded-xl border flex flex-col gap-2.5 transition-all cursor-pointer ${
                  sc.horizonMonths === selectedHorizon
                    ? 'bg-blue-500/10 border-blue-500/60 shadow-md ring-1 ring-blue-500/40'
                    : 'bg-[var(--bg-shell)] border-[var(--border-color)] hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[15px] font-mono text-blue-400">
                    {sc.horizonMonths} เดือน
                  </span>
                  <span
                    className={`font-mono text-[10.5px] px-2 py-0.5 rounded font-bold ${
                      sc.feasibility === 'HIGH'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : sc.feasibility === 'CAPACITY_CONSTRAINED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {sc.feasibility}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11.5px] font-mono pt-2 border-t border-[var(--border-color)]">
                  <div>
                    <span className="text-[var(--text-secondary)] text-[10px] block">อัตราต่อเดือน:</span>
                    <span className="font-bold text-[var(--text-primary)] text-[13px]">
                      {sc.monthlyRunRateTons.toFixed(1)} ตัน
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)] text-[10px] block">กำลังเครนที่ขาด:</span>
                    <span
                      className={`font-bold text-[13px] ${
                        sc.craneCapacityGapPercent > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {sc.craneCapacityGapPercent > 0
                        ? `${sc.capacityGapTons.toFixed(1)} ตัน/เดือน · ${sc.craneCapacityGapPercent}%`
                        : '0.0 ตัน/เดือน'}
                    </span>
                  </div>
                </div>

                <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed mt-1">
                  {sc.reason}
                </p>

                {sc.horizonMonths === selectedHorizon && (
                  <span className="text-[10px] font-mono font-bold text-blue-400 mt-auto pt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ฉากทัศน์ที่เลือกใช้งาน (Active Horizon)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Monthly Progress / Detail Table */}
      {activeTab === 'progress' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xs p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-color)]">
            <div>
              <h2 className="font-bold text-[15px]">
                ตารางแผนและผลการระบายสต็อกรายเดือน (Monthly Plan & Progress Table)
              </h2>
              <span className="text-[12px] text-[var(--text-secondary)]">
                กรอบเวลา {selectedHorizon} เดือน • ยอดรวมเป้าหมาย {targetTonsInput.toFixed(1)} ตัน • เปรียบเทียบกับยอดตรวจรับขึ้นรถจริง (LGX-03)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[var(--text-secondary)]">สลับกรอบเวลา:</span>
              <select
                value={selectedHorizon}
                onChange={(e) => setSelectedHorizon(parseInt(e.target.value) || 6)}
                className="p-1 rounded bg-[var(--input-bg)] border border-[var(--border-color)] text-[12px] font-mono font-bold text-blue-400"
              >
                {horizonOptions.map((h) => (
                  <option key={h} value={h}>
                    {h} เดือน
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
            <table className="w-full text-left text-[12.5px] border-collapse font-mono">
              <thead className="bg-[var(--table-header)] text-[var(--text-secondary)] text-[11px] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-2.5 px-3">เดือนเป้าหมาย</th>
                  <th className="py-2.5 px-3 text-right">เป้าหมาย (ตัน)</th>
                  <th className="py-2.5 px-3 text-right">ส่งมอบจริง (LGX-03)</th>
                  <th className="py-2.5 px-3 text-right">ผลต่าง</th>
                  <th className="py-2.5 px-3">ผู้รับผิดชอบ</th>
                  <th className="py-2.5 px-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {dynamicMonthlyPlan.map((m, idx) => (
                  <tr key={idx} className="hover:bg-[var(--table-row-hover)]">
                    <td className="py-3 px-3 font-bold text-[var(--text-primary)]">{m.month}</td>
                    <td className="py-3 px-3 text-right font-bold text-blue-400">
                      {m.targetTons.toFixed(1)} T
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      {m.actualClearedTons.toFixed(1)} T
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-bold ${
                        m.varianceTons < 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {m.varianceTons > 0 ? `+${m.varianceTons.toFixed(1)}` : m.varianceTons.toFixed(1)} T
                    </td>
                    <td className="py-3 px-3 font-sans text-[12px]">{m.owner}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          m.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : m.status === 'BEHIND'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-500/20 text-slate-300'
                        }`}
                      >
                        {clearanceStatusThai[m.status] || m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
