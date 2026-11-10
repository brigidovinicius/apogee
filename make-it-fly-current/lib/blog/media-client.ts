export async function readMediaResponse(response: Response): Promise<{ error?: unknown; media?: unknown; ok?: unknown }> {
  const fallback = response.status === 413 ? "A imagem excede o limite permitido. Tente um arquivo menor."
    : response.status === 401 || response.status === 403 ? "Sua sessão não permite esta ação. Entre novamente e tente outra vez."
      : "Não foi possível concluir a operação da imagem. Tente novamente.";
  let result;
  try { result = await response.json(); } catch { throw new Error(fallback); }
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error(fallback);
  if (!response.ok) throw new Error(typeof result.error === "string" && result.error.length <= 300 ? result.error : fallback);
  return result;
}
