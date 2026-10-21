import React from 'react';
import { useWms } from '../../context/WmsContext';
import { AlertTriangle, ArrowRight, X, ShieldAlert, CheckCircle } from 'lucide-react';

export const GateBlockedModal: React.FC = () => {
  const { gateBlocked, closeGateModal, navigateToWorkspace } = useWms();

  if (!gateBlocked) return null;

  const handleRecover = () => {
    if (gateBlocked.targetWorkspace) {
      navigateToWorkspace(gateBlocked.targetWorkspace, gateBlocked.targetContext);
    }
    closeGateModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[var(--bg-card)] border-2 border-rose-500/50 rounded-xl shadow-2xl overflow-hidden text-[var(--text-primary)]">
        {/* Header */}
        <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-500">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] leading-tight text-rose-400">
                {gateBlocked.title}
              </h3>
              <span className="text-[11px] font-mono text-rose-300/80">
                BRD POLICY & SAFEGUARD INTERLOCK
              </span>
            </div>
          </div>
          <button
            onClick={closeGateModal}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 text-[13px]">
          <div>
            <div className="text-[12px] font-semibold text-rose-300 uppercase font-mono tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              เงื่อนไขที่ยังไม่ผ่าน:
            </div>
            <div className="space-y-2">
              {gateBlocked.unmetGates.map((gate, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-900/30 text-rose-200 flex items-start gap-2"
                >
                  <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-snug">{gate}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200 flex flex-col gap-1.5">
            <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              แนวทางแก้ไข:
            </span>
            <p className="text-[12.5px] text-blue-100 leading-relaxed">
              {gateBlocked.recoveryRoute}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[var(--bg-shell)] border-t border-[var(--border-color)] flex items-center justify-end gap-2.5">
          <button
            onClick={closeGateModal}
            className="px-4 py-2 rounded-lg bg-slate-700/40 hover:bg-slate-700/60 text-slate-300 text-[12.5px] font-medium transition-colors"
          >
            ปิดหน้าต่าง
          </button>
          {gateBlocked.targetWorkspace && (
            <button
              onClick={handleRecover}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[12.5px] shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <span>ไปที่ {gateBlocked.targetWorkspace} เพื่อดำเนินการ</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
