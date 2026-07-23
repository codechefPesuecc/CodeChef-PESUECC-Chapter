import type { Metadata } from "next";
import VerifyForm from "@/components/auth/VerifyForm";

export const metadata: Metadata = { title: "Verify your email" };

export default function VerifyPage() {
  return (
    <main className="flex-1">
      <VerifyForm />
    </main>
  );
}
