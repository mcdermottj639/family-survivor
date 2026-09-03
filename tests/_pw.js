/* Playwright, with demo mode already on before the first paint.
   ------------------------------------------------------------------
   🚨 Why this exists. The shipped survivor.js now carries the real Supabase
   constants, so a fresh browser boots into the SHARED league — and the
   sandbox cannot reach supabase.co, so every suite that drives the UI died
   at boot with "Can't reach the league right now."

   That is the app behaving correctly: with a real league configured, the
   first-run screen must NOT offer a stranger a demo league to start. So the
   suites opt in instead, by setting `survivor:demo` before any page script
   runs. Demo mode forces the on-device store (see pickStore), which is what
   makes these 30-odd suites testable with no network at all.

   ⚠️ Suites that are ABOUT the cloud path — cloud.js, deploy.js — require
   playwright-core directly and must keep doing so, or they would test the
   local store while claiming to test the shared league. */
const real = require('../node_modules/playwright-core');

const chromium = Object.create(real.chromium);
chromium.launch = async function (opts) {
  const browser = await real.chromium.launch(opts);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => {
    const ctx = await newContext(o);
    await ctx.addInitScript(() => {
      /* ⚠️ A DEFAULT, not an override. addInitScript runs before page scripts
         on EVERY navigation, so setting it unconditionally would undo a
         suite's own `survivor:demo = 0` on the very next reload — which is
         exactly how share.js's "flip to cloud mode" section failed against
         correct code. Absent means "use the demo"; anything else is the
         suite's deliberate choice and is left alone. */
      try {
        if (localStorage.getItem('survivor:demo') === null) localStorage.setItem('survivor:demo', '1');
      } catch (e) {}
    });
    return ctx;
  };
  return browser;
};

module.exports = { ...real, chromium };
