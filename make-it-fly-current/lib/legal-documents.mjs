// Version-specific editorial approval; never a declaration of legal compliance.
export const legalDocumentVersions=Object.freeze({privacy:'2026-11-22.1',terms:'2026-11-01.2'});
const previousPrivacyVersion='2026-11-08.1';

/** @param {Record<string,string|undefined>} [env] */
export function approvedPrivacyVersion(env=process.env) {
  const version=env.APOGEE_PRIVACY_APPROVED_VERSION;
  return version===legalDocumentVersions.privacy||version===previousPrivacyVersion?version:undefined;
}

/** @param {Record<string,string|undefined>} [env] */
export function legalApprovals(env=process.env) {
  return {privacy:!!approvedPrivacyVersion(env),
    terms:env.APOGEE_TERMS_APPROVED_VERSION===legalDocumentVersions.terms};
}
