import { Suspense } from "react";
import { HistorialInner } from "./HistorialInner";

export const metadata = { title: "Mi historial — ÁGORA" };

export default function HistorialPage() {
  return (
    <Suspense>
      <HistorialInner />
    </Suspense>
  );
}
