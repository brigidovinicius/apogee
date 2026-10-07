import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form action={login} className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Área restrita</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Administração</h1>
        <label className="mt-8 block text-sm font-medium text-slate-700" htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3" />
        {erro ? <p className="mt-3 text-sm text-red-700">Senha inválida.</p> : null}
        <button className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white">Entrar</button>
      </form>
    </main>
  );
}