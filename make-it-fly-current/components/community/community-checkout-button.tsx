import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { communityBillingEnabled } from "@/lib/billing/community-config";
import { communityReturnPath } from "@/lib/billing/community-navigation";
import { CheckoutSubmit } from "./checkout-submit";

export function CommunityCheckoutButton({ preview = false, subscribed = false, next }: { preview?: boolean; subscribed?: boolean; next?: string }) {
  if (subscribed) return <Link data-ap-button="primary" href="/membros" prefetch={false}>Acessar meus recursos <ArrowUpRight size={18} aria-hidden="true" /></Link>;
  if (preview) return <div data-annual-checkout><CheckoutSubmit preview /></div>;
  if (!communityBillingEnabled()) return null;
  return <form data-annual-checkout action={`/api/comunidade/assinatura/iniciar?next=${encodeURIComponent(communityReturnPath(next ?? "/membros"))}`} method="post" data-behavior-action="checkout_start">
    <CheckoutSubmit />
  </form>;
}
