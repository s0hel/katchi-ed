import type { Metadata } from "next";
import { DiagnosticRunner } from "@/components/diagnostic-runner";

export const metadata: Metadata = {
  title: "Diagnostic",
  description: "An adaptive diagnostic that estimates a working grade level for each strand.",
};

export default function DiagnosticPage() {
  return (
    <div className="py-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight">Diagnostic</h1>
        <p className="mx-auto mt-2 max-w-xl text-[var(--kx-muted)]">
          Answer a short adaptive set and get a working grade level for each strand, plus the
          skills worth practicing next.
        </p>
      </div>
      <DiagnosticRunner />
    </div>
  );
}
