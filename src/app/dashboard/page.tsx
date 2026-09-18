import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard-view";

export const metadata: Metadata = {
  title: "Progress",
  description: "SmartScores, practice history, diagnostics, and assessment results.",
};

export default function DashboardPage() {
  return (
    <div className="py-4">
      <h1 className="mb-6 text-3xl font-black tracking-tight">Your progress</h1>
      <DashboardView />
    </div>
  );
}
