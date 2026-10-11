import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ withAdminTransaction: vi.fn() }));
vi.mock("@/lib/ingestion", () => ({ runOfficialSourceIngestion: vi.fn() }));

import { withAdminTransaction } from "@/lib/db/client";
import { runOfficialSourceIngestion } from "@/lib/ingestion";
import {
  EditorialInputError,
  runEditorialSourceIngestion,
  setEditorialSourceActive,
  verifyEditorialSource,
} from "@/lib/official-sources/editorial";

beforeEach(() => vi.clearAllMocks());

it("invalid editorial inputs fail before database or ingestion work", async () => {
  await expect(verifyEditorialSource({
    sourceId: "ufsc-propesq", officialSource: true, locationConfirmed: true, collectionAllowed: false,
  })).rejects.toBeInstanceOf(EditorialInputError);
  await expect(setEditorialSourceActive({ sourceId: "UFSC-PROPESQ", active: true })).rejects.toBeInstanceOf(EditorialInputError);
  await expect(runEditorialSourceIngestion({ sourceId: "ufsc-propesq", maxPages: 11, maxCandidates: 10 })).rejects.toBeInstanceOf(EditorialInputError);
  await expect(runEditorialSourceIngestion({ sourceId: "ufsc-propesq", maxPages: 1, maxCandidates: 0 })).rejects.toBeInstanceOf(EditorialInputError);

  expect(withAdminTransaction).not.toHaveBeenCalled();
  expect(runOfficialSourceIngestion).not.toHaveBeenCalled();
});
