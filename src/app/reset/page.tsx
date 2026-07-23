import type { Metadata } from "next";
import ResetForm from "@/components/auth/ResetForm";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPage() {
  return (
    <main className="flex-1">
      <ResetForm />
    </main>
  );
}
