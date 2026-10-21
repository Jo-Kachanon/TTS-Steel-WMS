import React from 'react';
import { CanonicalProductStatus, CANONICAL_STATUS_MAP } from '../../types/wms';

interface StatusBadgeProps {
  status: CanonicalProductStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showAuthority?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showAuthority = false,
  className = '',
}) => {
  const meta = CANONICAL_STATUS_MAP[status as CanonicalProductStatus];

  if (!meta) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-500/10 text-slate-400 border border-slate-500/30 ${className}`}
      >
        {status}
      </span>
    );
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-[11.5px] px-2 py-0.5',
    lg: 'text-[13px] px-2.5 py-1',
  }[size];

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded font-mono font-semibold border ${meta.badgeBg} ${meta.badgeBorder} ${meta.badgeText} ${sizeClasses}`}
        title={`${meta.code} - ${meta.labelTh} [ผู้ดูแล: ${meta.authority === 'SYSTEM_ONE' ? 'ระบบขาย' : meta.authority === 'WMS' ? 'ระบบคลัง' : 'ระบบขนส่ง'}]`}
      >
        <span className="font-bold tracking-tight">[{meta.code}]</span>
        <span className="font-sans font-medium">{meta.labelTh} ({meta.labelEn})</span>
      </span>

      {showAuthority && (
        <span
          className={`text-[9px] font-mono px-1 py-0.2 rounded uppercase tracking-wider font-semibold border ${
            meta.authority === 'SYSTEM_ONE'
              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
              : meta.authority === 'WMS'
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}
        >
          {meta.authority === 'SYSTEM_ONE' ? 'ระบบขาย' : meta.authority === 'WMS' ? 'ระบบคลัง' : 'ระบบขนส่ง'}
        </span>
      )}
    </div>
  );
};
