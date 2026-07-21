import type { Metadata } from "next";
import ForgotForm from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <main className="flex-1">
      <ForgotForm />
    </main>
  );
}
