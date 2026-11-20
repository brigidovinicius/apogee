import { requireSignedInMember } from "@/lib/members/dal";
import { applicationOrigin } from "@/lib/members/mail";
import { VOUCHER_PATH } from "@/lib/workshop-voucher/input";
import { voucherConfigured } from "@/lib/workshop-voucher/secrets";
import { openMemberVoucher } from "@/lib/workshop-voucher/store";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};

export async function POST(request: Request) {
  if (!voucherConfigured()) return new Response(null, { status: 404, headers: privateHeaders });
  const origin = applicationOrigin();
  if (request.headers.get("origin") !== origin) return new Response(null, { status: 403, headers: privateHeaders });

  const member = await requireSignedInMember(VOUCHER_PATH);
  const link = await openMemberVoucher(member.id).catch(() => null);
  return new Response(null, {
    status: 303,
    headers: { ...privateHeaders, Location: link ?? new URL(VOUCHER_PATH + "?resultado=indisponivel", origin).href },
  });
}
