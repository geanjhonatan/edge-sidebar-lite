'use strict';

// Loaded only for an explicitly requested, signed Windows build.
// The normal development builder config remains untouched.
const base = require('../package.json').build;

const { assertSigningEnvironment } = require('./signing-preflight');



function signedConfig(env = process.env) {
  const { certName, publisherName } = assertSigningEnvironment(env);
  return {
    ...base,
    forceCodeSigning: true,
    win: {
      ...base.win,
      verifyUpdateCodeSignature: true,
      signtoolOptions: {
        certificateSubjectName: certName,
        publisherName,
        signingHashAlgorithms: ['sha256'],
        rfc3161TimeStampServer: 'http://timestamp.digicert.com'
      }
    }
  };
}

// electron-builder uses the returned configuration object directly.
if (require.main === module) {
  const result = signedConfig();
  process.stdout.write(JSON.stringify({
    forceCodeSigning: result.forceCodeSigning,
    verifyUpdateCodeSignature: result.win.verifyUpdateCodeSignature,
    publisherName: result.win.signtoolOptions.publisherName,
    installerTarget: result.win.target[0].target
  }, null, 2) + '\n');
} else {
  module.exports = signedConfig();
}
