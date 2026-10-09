import { expect, it, vi } from "vitest";
vi.mock("@/lib/auth/admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ withAdminTransaction: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { withAdminTransaction } from "@/lib/db/client";
import { reviewOpportunity, reviewRevision } from "@/app/admin/revisao/actions";
it("unknown editorial decisions never fall through to approval", async () => {
  const form = new FormData(); form.set("id", "fixture"); form.set("decision", "unexpected");
  await expect(reviewOpportunity(form)).rejects.toThrow("Decisão inválida");
  await expect(reviewRevision(form)).rejects.toThrow("Decisão inválida");
  expect(withAdminTransaction).not.toHaveBeenCalled();
});
