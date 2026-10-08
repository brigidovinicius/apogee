// Concede somente o papel administrativo a uma conta existente.
// Idempotente, falha fechado se o alvo estiver ausente ou duplicado e nunca
// imprime e-mail, nome, credenciais ou dados de sessão.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

export class AdminRoleError extends Error {}

export async function grantAdmin(sql, email) {
  return sql.begin(async (tx) => {
    await tx`lock table "user" in share row exclusive mode`;
    const matches = await tx`
      select id, role
      from "user"
      where lower(email) = lower(${email})
      for update`;

    if (matches.length === 0) throw new AdminRoleError("Conta alvo não encontrada.");
    if (matches.length !== 1) throw new AdminRoleError("Conta alvo duplicada.");

    const [{ id, role: previousRole }] = matches;
    if (previousRole !== "member" && previousRole !== "admin") {
      throw new AdminRoleError("Papel atual inválido; nenhuma alteração realizada.");
    }

    if (previousRole === "admin") {
      return { id, previousRole, finalRole: "admin", changed: false };
    }

    const updated = await tx`
      update "user"
      set role = 'admin'
      where id = ${id} and role = 'member'
      returning role`;
    if (updated.length !== 1 || updated[0].role !== "admin") {
      throw new AdminRoleError("A concessão não alterou exatamente a conta alvo.");
    }

    return { id, previousRole, finalRole: "admin", changed: true };
  });
}

function databaseOptions() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new AdminRoleError("DATABASE_URL não configurada.");

  const ca = process.env.DATABASE_CA_CERT_FILE
    ? readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8")
    : process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const sslMode = process.env.DATABASE_SSL_MODE;
  if (sslMode && sslMode !== "disable" && sslMode !== "require") {
    throw new AdminRoleError("DATABASE_SSL_MODE inválido.");
  }

  return {
    url,
    options: {
      ssl: ca ? { ca, rejectUnauthorized: true } : sslMode === "disable" ? false : "require",
      prepare: false,
      max: 1,
    },
  };
}

async function main() {
  const email = process.env.MEMBERS_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new AdminRoleError("MEMBERS_ADMIN_EMAIL ausente ou inválido.");
  }

  const { url, options } = databaseOptions();
  const sql = postgres(url, options);
  try {
    const result = await grantAdmin(sql, email);
    console.log(JSON.stringify({
      ...result,
      occurredAt: new Date().toISOString(),
      mechanism: "members:grant-admin",
    }));
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof AdminRoleError
      ? error.message
      : "Falha operacional; nenhuma alteração foi confirmada.";
    console.error(`[members:grant-admin] ${message}`);
    process.exitCode = 1;
  });
}
