const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}, globals = {}) {
  const box = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: box.exports, module: box, URL, process: { env: {} }, require: name => dependencies[name] || require(name), ...globals });
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
const auth = load('src/lib/auth/qa-auth.ts', { '@/lib/uuid': { isUuid: () => false } }, { process: { env: { NEXT_PUBLIC_APP_URL: 'https://dashboard-qa.example.invalid' } } });
const origin = auth.getRequestPublicOrigin({ headers: { get: () => 'untrusted.example.invalid' }, nextUrl: { origin: 'http://localhost:3101', protocol: 'http:' } });
assert.equal(origin, 'https://dashboard-qa.example.invalid');
const middleware = load('src/lib/supabase/middleware.ts', {
  'next/server': { NextResponse: { next: () => 'next', redirect: url => url.toString() } },
  '@/lib/auth/qa-auth': { getRequestPublicOrigin: auth.getRequestPublicOrigin, hasRefreshableQaSession: () => false },
  '@/lib/auth/demo-auth': { hasDemoSession: () => false },
});
(async () => {
  const request = { headers: { get: () => 'untrusted.example.invalid' }, nextUrl: { pathname: '/account-review', search: '?step=branding', searchParams: new URLSearchParams('?step=branding'), origin: 'http://localhost:3101' } };
  const login = new URL(await middleware.updateSession(request));
  assert.equal(login.origin, origin);
  assert.equal(login.pathname, '/login');
  assert.equal(login.searchParams.get('returnTo'), '/account-review?step=branding');
  request.nextUrl.search = '?code=fake-code&state=fake-state';
  request.nextUrl.searchParams = new URLSearchParams(request.nextUrl.search);
  const callback = new URL(await middleware.updateSession(request));
  assert.equal(callback.origin, origin);
  assert.equal(callback.pathname, '/api/auth/qa/callback');
  assert.equal(callback.searchParams.get('code'), 'fake-code');
  console.log('PASS: login and OAuth callbacks stay on the configured public origin, never localhost or an injected forwarded host.');
})().catch(error => { console.error(error); process.exitCode = 1; });
