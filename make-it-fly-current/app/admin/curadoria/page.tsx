import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
export default async function CurationPage() {
  await requireAdmin("/admin/curadoria");
  redirect("/admin/radar");
}
