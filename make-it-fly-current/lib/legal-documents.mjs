// Version-specific editorial approval; never a declaration of legal compliance.
export const legalDocumentVersions=Object.freeze({privacy:'2026-10-30',terms:'2026-10-30'});
/** @param {Record<string,string|undefined>} [env] */
export function legalApprovals(env=process.env) {
  return {privacy:env.APOGEE_PRIVACY_APPROVED_VERSION===legalDocumentVersions.privacy,
    terms:env.APOGEE_TERMS_APPROVED_VERSION===legalDocumentVersions.terms};
}
