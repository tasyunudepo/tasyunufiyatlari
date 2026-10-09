"use client";
import { OfficeToday } from '@/components/admin/OfficeToday';
/** Rapor ve grafikler Analiz bölümündedir; Genel Bakış tekil iş kuyruğudur. */
export function DashboardTab({onNavigate}: {onNavigate: (section:string)=>void}) {
 return <OfficeToday onNavigate={onNavigate} />;
}
