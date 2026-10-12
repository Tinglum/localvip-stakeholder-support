const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const box = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: box.exports, module: box, require: name => dependencies[name] || require(name) });
  return box.exports;
}
const image = load('src/lib/uploaded-image-status.ts', { react: {} }).imageForSetup;
const setup = load('src/lib/business-setup.ts', { '@/lib/business-portal': {} });
const cause = load('src/lib/cause-setup.ts');
assert.equal(image('/saved-logo.jpg', true), '/saved-logo.jpg');
assert.equal(image('/saved-logo.jpg', undefined), '/saved-logo.jpg');
assert.equal(image('/saved-logo.jpg', false), null);
const signals = { name: 'Existing business', category: 'Shop', description: 'Saved description', logoUrl: '/saved-logo.jpg', coverUrl: '/saved-cover.jpg', hundredListInterest: 'not_now', dealConfigured: true, stripeConnected: true, liveReviewSubmitted: true };
assert.equal(setup.getBusinessSetupState(signals).isComplete, true);
assert.equal(setup.getBusinessSetupState({ ...signals, logoUrl: image(signals.logoUrl, false) }).isComplete, false);
assert.equal(setup.getBusinessSetupState({ ...signals, logoUrl: image(signals.logoUrl, false) }).nextStep.key, 'branding');
assert.equal(cause.isCauseSetupStepComplete('images', { logoUrl: image('/saved-logo.jpg', false), photoUrls: { crowd: '/saved-cover.jpg' } }), false);
assert.equal(signals.logoUrl, '/saved-logo.jpg');
console.log('PASS: failed legacy media is incomplete in both setup flows, successful/unchecked media is preserved, stored references stay unchanged. No writes.');
