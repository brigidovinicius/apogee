import "server-only";

// Retired endpoint: older tabs must not recreate individually linked events.
export async function handleJourneyPost() {
  return Response.json({ error: "Medição anterior encerrada. Atualize a página." }, {
    status: 410, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
