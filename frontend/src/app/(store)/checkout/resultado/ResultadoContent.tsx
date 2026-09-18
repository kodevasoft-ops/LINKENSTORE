"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function ResultadoContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order");

  return (
    <main
      className="wrap"
      style={{ maxWidth: 520, textAlign: "center", padding: "80px 20px" }}
    >
      <CheckCircle2 size={48} color="var(--y)" style={{ margin: "0 auto 20px" }} />
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>
        Recibimos tu solicitud de pago
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: 6 }}>
        {orderNumber
          ? `Orden ${orderNumber}`
          : "Tu orden"}{" "}
        está siendo verificada con Wompi. Te enviaremos un correo con la
        confirmación en cuanto el pago sea aprobado, y un asesor procesará tu
        pedido a la brevedad.
      </p>
      <Link
        href="/productos"
        style={{ color: "var(--y)", fontWeight: 700, fontSize: 13 }}
      >
        Volver al catálogo
      </Link>
    </main>
  );
}
