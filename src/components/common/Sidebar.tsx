import React from 'react';
import { useWms, WorkspaceId } from '../../context/WmsContext';
import {
  FileText,
  Database,
  Layers,
  Truck,
  TrendingDown,
  Search,
  ClipboardList,
  Wrench,
} from 'lucide-react';

interface WorkspaceNavItem {
  id: WorkspaceId;
  code: string;
  titleTh: string;
  badge: string;
  badgeStyle: string;
  icon: React.ElementType;
}

export const Sidebar: React.FC = () => {
  const { activeWorkspace, navigateToWorkspace, pickTasks } = useWms();

  const activeRunsCount = pickTasks.filter((t) => t.state !== 'staged' && t.state !== 'ready').length;

  const NAV_ITEMS: WorkspaceNavItem[] = [
    {
      id: 'WMS-11',
      code: '11',
      titleTh: 'ภาพรวมสินค้า',
      badge: '01–11',
      badgeStyle: 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30',
      icon: Search,
    },
    {
      id: 'WMS-05',
      code: '05',
      titleTh: 'สินค้าพร้อมจอง',
      badge: 'สินค้า',
      badgeStyle: 'bg-blue-600/30 text-blue-300 font-bold',
      icon: Layers,
    },
    {
      id: 'WMS-03',
      code: '03',
      titleTh: 'รายการจองและติดตาม',
      badge: 'งานจอง',
      badgeStyle: 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30',
      icon: FileText,
    },
    {
      id: 'WMS-04',
      code: '04',
      titleTh: 'ตรวจสินค้าและแจ้งกำหนด',
      badge: 'ตรวจ',
      badgeStyle: 'bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30',
      icon: ClipboardList,
    },
    {
      id: 'WMS-07',
      code: '07',
      titleTh: 'คิวแปรรูป',
      badge: 'งาน',
      badgeStyle: 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30',
      icon: Wrench,
    },
    {
      id: 'WMS-06',
      code: '06',
      titleTh: 'เตรียมสินค้าและส่งมอบ',
      badge: `${activeRunsCount || 8} งาน`,
      badgeStyle: 'bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30',
      icon: Truck,
    },
    {
      id: 'WMS-08',
      code: '08',
      titleTh: 'แผนระบายสินค้า',
      badge: 'เกิน 90 วัน',
      badgeStyle: 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30',
      icon: TrendingDown,
    },
    {
      id: 'WMS-02',
      code: '02',
      titleTh: 'Settings',
      badge: 'ตั้งค่า',
      badgeStyle: 'bg-slate-700/40 text-slate-300',
      icon: Database,
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[var(--bg-shell)] border-r border-[var(--border-color)] z-50 flex flex-col justify-between shadow-xs select-none">
      <div className="flex flex-col">
        {/* Top Header - Clearly SIMULATED */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-shell)]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
            <span className="font-mono text-[10.5px] text-blue-400 tracking-wider font-bold">
              ระบบคลังสินค้า TTS
            </span>
          </div>
          <span className="font-mono text-[9.5px] text-[var(--text-secondary)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] font-semibold">
            ตัวอย่าง
          </span>
        </div>

        {/* Workspace Nav Header */}
        <div className="px-4 py-2.5">
          <div className="font-mono text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
            เมนูงานคลัง
          </div>
        </div>

        {/* Core workspaces and Settings */}
        <nav className="flex flex-col gap-1 px-2.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeWorkspace === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateToWorkspace(item.id, item.id === 'WMS-05' || item.id === 'WMS-03' ? { tabIndex: 0 } : undefined)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all text-left ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className={`font-mono text-[12px] font-bold ${
                      isActive ? 'text-blue-100' : 'text-blue-400'
                    }`}
                  >
                    {item.code}
                  </span>
                  <span className="text-[12.5px] truncate font-medium">{item.titleTh}</span>
                </div>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-blue-700/60 text-white' : item.badgeStyle
                  }`}
                >
                  {item.badge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-[var(--border-color)] text-[10px] text-[var(--text-secondary)]">
        เปลี่ยนบทบาทจำลองได้จากเมนูผู้ใช้ด้านบน
      </div>
    </aside>
  );
};
