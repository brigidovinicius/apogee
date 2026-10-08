import "server-only";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin/access";
import { getDb } from "@/lib/members/db";
import { forumPost, forumTopic, user } from "@/lib/members/schema";

const MAX_ADMIN_USERS = 50;

export type AdminOverview = {
  accounts: number;
  members: number;
  admins: number;
  newAccounts30Days: number;
  topics: number;
  posts: number;
  recentAccounts: Array<{
    id: string;
    name: string;
    username: string;
    role: "member" | "admin";
    createdAt: Date;
  }>;
};

export type AdminUserFilter = "all" | "member" | "admin";

export type AdminUserList = {
  total: number;
  limited: boolean;
  users: Array<{
    id: string;
    name: string;
    username: string;
    email: string;
    emailVerified: boolean;
    role: "member" | "admin";
    createdAt: Date;
  }>;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  await requireAdmin("/admin");
  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const [accountTotals] = await db
    .select({
      accounts: count(),
      members: sql<number>`count(*) filter (where ${user.role} = 'member')`.mapWith(Number),
      admins: sql<number>`count(*) filter (where ${user.role} = 'admin')`.mapWith(Number),
      newAccounts30Days: sql<number>`count(*) filter (where ${user.createdAt} >= ${since})`.mapWith(Number),
    })
    .from(user);

  const [topicTotals] = await db.select({ value: count() }).from(forumTopic);
  const [postTotals] = await db.select({ value: count() }).from(forumPost);
  const recentAccounts = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(5);

  return {
    accounts: accountTotals?.accounts ?? 0,
    members: accountTotals?.members ?? 0,
    admins: accountTotals?.admins ?? 0,
    newAccounts30Days: accountTotals?.newAccounts30Days ?? 0,
    topics: topicTotals?.value ?? 0,
    posts: postTotals?.value ?? 0,
    recentAccounts: recentAccounts.map((account) => ({
      ...account,
      username: account.username ?? "",
      role: account.role === "admin" ? "admin" : "member",
    })),
  };
}

export async function listAdminUsers(
  rawSearch: string,
  filter: AdminUserFilter,
): Promise<AdminUserList> {
  await requireAdmin("/admin/usuarios");
  const db = getDb();
  const search = rawSearch.trim().slice(0, 80);
  const searchCondition = search
    ? or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`), ilike(user.username, `%${search}%`))
    : undefined;
  const roleCondition = filter === "all" ? undefined : eq(user.role, filter);
  const where = searchCondition && roleCondition
    ? and(searchCondition, roleCondition)
    : searchCondition ?? roleCondition;

  const [totals] = await db.select({ value: count() }).from(user).where(where);
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(MAX_ADMIN_USERS);

  const total = totals?.value ?? 0;
  return {
    total,
    limited: total > MAX_ADMIN_USERS,
    users: users.map((account) => ({
      ...account,
      username: account.username ?? "",
      role: account.role === "admin" ? "admin" : "member",
    })),
  };
}
