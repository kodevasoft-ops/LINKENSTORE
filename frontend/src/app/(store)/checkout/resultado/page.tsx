"use client";

import { Suspense } from "react";
import ResultadoContent from "./ResultadoContent";

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={<div>Cargando resultado...</div>}>
      <ResultadoContent />
    </Suspense>
  );
}
