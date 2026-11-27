import "server-only";
import { getSql } from "./db";
import type { TransactionSql } from "postgres";

export async function hasVerifiedMemberEmail(userId: string, tx?: TransactionSql): Promise<boolean> {
  const [account] = tx
    ? await tx`select email_verified from "user" where id=${userId} and not blocked for share`
    : await getSql()`select email_verified from "user" where id=${userId} and not blocked`;
  return account?.email_verified === true;
}
