// Cria as categorias iniciais do fórum. Idempotente.
// Uso: DATABASE_URL=... [DATABASE_CA_CERT_FILE=...] npm run db:seed
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

const categories = [
  { slug: "boas-vindas", name: "Boas-vindas", description: "Apresente-se para a comunidade Apogee.", position: 0 },
  { slug: "ideias", name: "Ideias e projetos", description: "Compartilhe o que você está construindo e peça feedback.", position: 1 },
  { slug: "duvidas", name: "Dúvidas", description: "Perguntas sobre eventos, ferramentas e caminhos.", position: 2 },
  { slug: "eventos", name: "Eventos", description: "Make it fly e outros encontros da Apogee.", position: 3 },
];

export async function seedCategories(sql) {
  for (const category of categories) {
    await sql`
      insert into forum_category (slug, name, description, position)
      values (${category.slug}, ${category.name}, ${category.description}, ${category.position})
      on conflict (slug) do nothing`;
  }
  return sql`select slug, name from forum_category order by position`;
}

async function main() {
  if (process.env.MEMBERS_ADMIN_EMAIL || process.env.MEMBERS_ADMIN_USER_ID) {
    throw new Error("Seed não concede privilégios; remova as variáveis administrativas e use o comando explícito autorizado.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL.");
  const ca = process.env.DATABASE_CA_CERT_FILE
    ? readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8")
    : process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const sql = postgres(url, { ssl: ca ? { ca, rejectUnauthorized: true } : "require", prepare: false, max: 1 });
  try {
    const rows = await seedCategories(sql);
    console.log(`Categorias: ${rows.map((row) => row.slug).join(", ")}`);
  } finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Seed não concluído. Não forneça variáveis administrativas ao seed; privilégios exigem comando explícito autorizado."); process.exitCode = 1; });
}
