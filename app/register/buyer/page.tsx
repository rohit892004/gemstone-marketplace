import Link from "next/link";
import { AuthLayout } from "@/components/auth/auth-layout";
import { RegisterBuyerForm } from "@/components/auth/register-buyer-form";

export default function RegisterBuyerPage() {
  return (
    <AuthLayout
      eyebrow="Buyers"
      title="Create a buyer account"
      lead="Save favourites and enquire directly with sellers."
      photo="/design-preview/luxury/stone-detail-2.webp"
      caption="Browse stones from sellers who are reviewed before they list."
    >
      <RegisterBuyerForm />
      <p className="text-center text-sm text-ink-soft">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-brand underline-offset-4 hover:text-brand-strong hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
