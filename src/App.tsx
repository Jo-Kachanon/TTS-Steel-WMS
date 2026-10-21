import React from 'react';
import { WmsProvider, useWms } from './context/WmsContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { GateBlockedModal } from './components/common/GateBlockedModal';
import { Wms01SoIntake } from './components/workspaces/Wms01SoIntake';
import { Wms02MasterData } from './components/workspaces/Wms02MasterData';
import { Wms05Allocation } from './components/workspaces/Wms05Allocation';
import { Wms06Picking } from './components/workspaces/Wms06Picking';
import { Wms08ClearancePlan } from './components/workspaces/Wms08ClearancePlan';
import { Wms11Lifecycle } from './components/workspaces/Wms11Lifecycle';

const WorkspaceContainer: React.FC = () => {
  const { activeWorkspace } = useWms();

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Persistent Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="pl-64">
        {/* Fixed Top Header */}
        <Header />

        {/* Viewport Content */}
        <main className="w-full pt-14 min-h-screen px-4 pb-12">
          <div className="pt-3">
            {activeWorkspace === 'WMS-01' && <Wms01SoIntake />}
            {activeWorkspace === 'WMS-02' && <Wms02MasterData />}
            {activeWorkspace === 'WMS-03' && <Wms11Lifecycle initialTab="bookings" workspaceCode="WMS-03" pageTitle="รายการจองและติดตาม" pageDescription="ติดตามตำแหน่งสินค้า งานหยิบ วันรอ และความพร้อมส่งของรายการจอง" />}
            {activeWorkspace === 'WMS-04' && <Wms11Lifecycle initialTab="bookings" workspaceCode="WMS-04" pageTitle="ตรวจสินค้าและแจ้งกำหนด" pageDescription="คลังตรวจตำแหน่งและสภาพสินค้า ประเมินคิว และแจ้งวันที่เซลล์ต้องรอ" />}
            {activeWorkspace === 'WMS-05' && <Wms05Allocation />}
            {activeWorkspace === 'WMS-06' && <Wms06Picking />}
            {activeWorkspace === 'WMS-07' && <Wms11Lifecycle initialTab="processing" workspaceCode="WMS-07" pageTitle="คิวแปรรูป" pageDescription="ติดตามใบแปรรูป งานระหว่างทำ และผลตรวจคุณภาพตาม SKU และใบสั่งขาย" />}
            {activeWorkspace === 'WMS-08' && <Wms08ClearancePlan />}
            {activeWorkspace === 'WMS-11' && <Wms11Lifecycle />}
          </div>
        </main>
      </div>

      {/* Global Gate Failure / Safeguard Interlock Modal */}
      <GateBlockedModal />
    </div>
  );
};

export default function App() {
  return (
    <WmsProvider>
      <WorkspaceContainer />
    </WmsProvider>
  );
}
