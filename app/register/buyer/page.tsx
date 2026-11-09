import Link from "next/link";
import { AuthCard } from "@/components/auth/fields";
import { RegisterBuyerForm } from "@/components/auth/register-buyer-form";

export default function RegisterBuyerPage() {
  return (
    <AuthCard title="Create a buyer account">
      <RegisterBuyerForm />
      <p className="text-center text-sm text-ink-soft">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-brand hover:text-brand-strong">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
