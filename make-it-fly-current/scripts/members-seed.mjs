// Cria as categorias iniciais do fórum. Idempotente.
// Uso: DATABASE_URL=... [DATABASE_CA_CERT_FILE=...] npm run db:seed
import { readFileSync } from "node:fs";
import postgres from "postgres";

const categories = [
  { slug: "boas-vindas", name: "Boas-vindas", description: "Apresente-se para a comunidade Apogee.", position: 0 },
  { slug: "ideias", name: "Ideias e projetos", description: "Compartilhe o que você está construindo e peça feedback.", position: 1 },
  { slug: "duvidas", name: "Dúvidas", description: "Perguntas sobre eventos, ferramentas e caminhos.", position: 2 },
  { slug: "eventos", name: "Eventos", description: "Make it fly e outros encontros da Apogee.", position: 3 },
];

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Defina DATABASE_URL.");
const ca = process.env.DATABASE_CA_CERT_FILE
  ? readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8")
  : process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");

const sql = postgres(url, { ssl: ca ? { ca, rejectUnauthorized: true } : "require", prepare: false, max: 1 });

try {
  for (const category of categories) {
    await sql`
      insert into forum_category (slug, name, description, position)
      values (${category.slug}, ${category.name}, ${category.description}, ${category.position})
      on conflict (slug) do nothing`;
  }
  const rows = await sql`select slug, name from forum_category order by position`;
  console.log(`Categorias: ${rows.map((row) => row.slug).join(", ")}`);

  const admin = process.env.MEMBERS_ADMIN_EMAIL?.trim().toLowerCase();
  if (admin) {
    const updated = await sql`update "user" set role = 'admin' where email = ${admin} returning username`;
    console.log(updated.length ? `Admin: @${updated[0].username}` : `Nenhum usuário com e-mail ${admin}.`);
  }
} finally {
  await sql.end();
}
