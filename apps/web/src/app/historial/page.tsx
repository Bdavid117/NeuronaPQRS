import { Suspense } from "react";
import { HistorialInner } from "./HistorialInner";

export const metadata = { title: "Mi historial — NeuronaPQRS" };

export default function HistorialPage() {
  return (
    <Suspense>
      <HistorialInner />
    </Suspense>
  );
}
