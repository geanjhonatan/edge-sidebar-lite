'use strict';
// Self-contained validation reused by the builder and unit tests.
function assertSigningEnvironment(env = process.env) {
  const certName = String(env.EDGE_SIGN_CERT_NAME || '').trim();
  const publisherName = String(env.EDGE_SIGN_PUBLISHER || '').trim();
  if (!certName || !publisherName) {
    throw new Error('Assinatura não configurada: defina EDGE_SIGN_CERT_NAME e EDGE_SIGN_PUBLISHER usando o certificado real.');
  }
  if (certName.length > 256 || publisherName.length > 512 || /[\r\n\x00-\x1f]/.test(certName + publisherName)) {
    throw new Error('Identidade de assinatura inválida.');
  }
  if (!/(?:^|,\s*)CN\s*=/.test(publisherName)) {
    throw new Error('EDGE_SIGN_PUBLISHER deve ser o subject completo do certificado, começando pelo CN.');
  }
  return { certName, publisherName };
}
module.exports = { assertSigningEnvironment };
