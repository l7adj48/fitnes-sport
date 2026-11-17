/* اختبار دخان للواجهة بلا متصفح:  node tests/ui.smoke.test.js */
const assert = require('assert');
const store = {};
globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
['01-config', '02-engine', '03-foods', '04-orders', '05-ui', '06-app'].forEach((f) => require('../js/' + f + '.js'));
const NF = globalThis.NF, UI = NF.ui, A = NF.app;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };

t('الخطوة 1 ترفض مدخلات ناقصة وبلا إقرار', () => {
  UI.reset();
  assert.ok(A.act('next')); assert.strictEqual(UI.state.step, 1); assert.ok(UI.state.errors.length >= 2);
});

t('مسار كامل بحالة 1 (رجل 80كغ) حتى الطلب', () => {
  UI.reset();
  A.act('sex', 'M'); A.setField('age', '25'); A.setField('heightCm', '180'); A.setField('weightKg', '80'); A.setField('consent', true);
  A.act('next'); assert.strictEqual(UI.state.step, 2);
  A.act('activity', 'MODERATE'); A.act('next');
  A.act('goal', 'BUILD'); A.act('next'); assert.strictEqual(UI.state.step, 4);
  const C = UI.compute();
  assert.ok(C.ok); assert.strictEqual(Math.round(C.tk.value), Math.round(1805 * 1.75 * 1.1));
  assert.ok(UI.html().includes('احتياجك اليومي'));
  A.act('next'); assert.strictEqual(UI.state.step, 5);
  A.act('next'); assert.strictEqual(UI.state.step, 5, 'لا انتقال بلا أطعمة');
  ['chicken', 'rice', 'olive_oil'].forEach((id) => {
    A.act('openFood', id); A.act('suggest');
    assert.ok(UI.num(UI.state.gramsTmp) > 0, id); A.act('saveFood');
  });
  A.act('openFood', 'lentils'); A.act('suggest');
  assert.strictEqual(UI.state.gramsTmp, '0', 'هدف البروتين تحقق، فاقتراح العدس صفر');
  A.setField('grams', '100'); A.act('saveFood');
  assert.strictEqual(Object.keys(UI.state.sel).length, 4);
  assert.ok(UI.html().includes('capsule'));
  A.act('next'); assert.strictEqual(UI.state.step, 6);
  A.act('count', 3); assert.ok(UI.html().includes('وجبة 3'));
  A.setField('pct', '50', 0); A.setField('pct', '25', 1); A.setField('pct', '25', 2);
  A.act('next'); assert.strictEqual(UI.state.step, 7);
  assert.ok(UI.html().includes('مراجعة الطلب') && UI.html().includes('يحدده المشرف'));
  A.act('confirm');
  assert.strictEqual(UI.state.done.status, 'DRAFT_DEV');
  assert.ok(UI.html().includes('DRAFT_DEV'));
  assert.strictEqual(JSON.parse(store['nf.orders']).length, 1);
});

t('الحساسية تحجب الطعام وتزيله من الاختيار', () => {
  UI.reset(); UI.state.step = 5;
  A.act('sex', 'M'); A.setField('age', '25'); A.setField('heightCm', '180'); A.setField('weightKg', '80');
  A.act('openFood', 'almonds'); A.setField('grams', '30'); A.act('saveFood');
  assert.ok(UI.state.sel.almonds);
  A.act('allergy', 'TREE_NUTS');
  assert.ok(!UI.state.sel.almonds);
  A.act('openFood', 'almonds'); assert.strictEqual(UI.state.editing, null, 'لا فتح لطعام محجوب');
  assert.ok(UI.html().includes('محجوب'));
});

t('نسب الوجبات الخاطئة تمنع الانتقال', () => {
  UI.reset(); UI.state.step = 6; UI.state.sel = { chicken: 300 };
  A.act('count', 2); A.setField('pct', '60', 0); A.setField('pct', '30', 1);
  A.act('next'); assert.strictEqual(UI.state.step, 6); assert.ok(UI.state.errors.length);
});

t('كل الخطوات تُرسم بلا استثناء في حالة بيانات ناقصة', () => {
  UI.reset();
  for (let s = 1; s <= 7; s++) { UI.state.step = s; assert.ok(UI.html().length > 50, 'step ' + s); }
});

t('هدف غير آمن يظهر كخطأ مفهوم لا انهيار', () => {
  UI.reset();
  A.act('sex', 'F'); A.setField('age', '30'); A.setField('heightCm', '150'); A.setField('weightKg', '45');
  A.act('activity', 'LIGHT'); A.act('goal', 'CUT'); A.setField('adjPct', '-25');
  const C = UI.compute(); assert.strictEqual(C.ok, false); assert.ok(C.errors[0].message.length > 5);
  UI.state.step = 4; assert.ok(UI.html().includes('errs'));
});

console.log('\n' + n + ' اختبارات واجهة نجحت');
