import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { communityBillingEnabled } from "@/lib/billing/community-config";
import { annualSummaryPath, communityReturnPath } from "@/lib/billing/community-navigation";
import { CheckoutSubmit } from "./checkout-submit";

export function CommunityCheckoutButton({ preview = false, signedIn = false, subscribed = false, next }: {
  preview?: boolean;
  signedIn?: boolean;
  subscribed?: boolean;
  next?: string;
}) {
  if (subscribed) return <Link data-ap-button="primary" href="/membros" prefetch={false}>Acessar meus recursos</Link>;
  if (preview) return <div data-annual-checkout><CheckoutSubmit preview /></div>;
  if (!communityBillingEnabled()) return null;

  const destination = communityReturnPath(next ?? "/membros");
  if (!signedIn) return <div data-annual-checkout>
    <Link data-ap-button="checkout" href={annualSummaryPath(destination)} prefetch={false} data-behavior-action="annual_choose">
      Assinar agora <ArrowRight size={18} aria-hidden="true" />
    </Link>
  </div>;

  return <form data-annual-checkout action={`/api/comunidade/assinatura/checkout?next=${encodeURIComponent(destination)}`} method="post" data-behavior-action="checkout_start">
    <CheckoutSubmit />
  </form>;
}
