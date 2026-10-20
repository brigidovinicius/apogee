// A autorização extra é concedida somente por operação administrativa confiável.
// Um administrador convidado não herda a autorização de gerenciar administradores.
export function canInvite(actor: { role: string; blocked: boolean; canManageAdmins: boolean } | null | undefined, role: string): boolean {
  return !!actor && !actor.blocked && actor.role === "admin" &&
    (role === "member" || (role === "admin" && actor.canManageAdmins));
}
