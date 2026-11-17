/* تشغيل:  node tests/engine.test.js   (بلا أي اعتماديات) */
const assert = require('assert');
require('../js/01-config.js');
require('../js/02-engine.js');
require('../js/03-foods.js');
require('../js/04-orders.js');
const NF = globalThis.NF;

let passed = 0;
function t(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' expected ' + b + ' got ' + a);

function plan(p, activity, goal, palValue) {
  const rmr = NF.chooseRmr(p);
  const pal = NF.getPal(activity, palValue);
  const tdee = NF.computeTdee(rmr.value, pal.value);
  const tk = NF.computeTarget({ tdee: tdee.value, rmr: rmr.value, pct: NF.GOALS[goal].pct, weightKg: p.weightKg });
  const m = NF.computeMacros({ weightKg: p.weightKg, targetKcal: tk.value, proteinPerKg: NF.GOALS[goal].protein, fatPct: 25 });
  return { rmr, pal, tdee, tk, m };
}

console.log('الحالات المحسوبة يدويًا (القسم 3.13):');

t('حالة 1: رجل 80كغ 180سم 25سنة PAL 1.70 بناء +10%', () => {
  const p = { sex: 'M', age: 25, heightCm: 180, weightKg: 80 };
  const r = plan(p, 'MODERATE', 'BUILD', 1.7);
  near(r.rmr.value, 1805, 1e-9);
  near(r.tdee.value, 3068.5, 1e-9);
  near(r.tk.value, 3375.35, 1e-9);
  near(r.m.proteinG, 144, 1e-9);
  near(r.m.fatG, 93.76, 0.01);
  near(r.m.carbsG, 488.88, 0.01);
  near(r.m.carbsPerKg, 6.11, 0.01);
});

t('حالة 2: امرأة 60كغ 165سم 30سنة PAL 1.60 خسارة -20%', () => {
  const p = { sex: 'F', age: 30, heightCm: 165, weightKg: 60 };
  const r = plan(p, 'LIGHT', 'CUT', 1.6);
  near(r.rmr.value, 1320.25, 1e-9);
  near(r.tdee.value, 2112.4, 1e-9);
  near(r.tk.value, 1689.92, 1e-9);
  near(r.m.proteinG, 120, 1e-9);
  near(r.m.fatG, 46.94, 0.01);
  near(r.m.carbsG, 196.86, 0.01);
  near(r.m.carbsPerKg, 3.28, 0.01);
  assert.ok(!r.m.warnings.some((x) => x.code === 'CARBS_LOW'), '3.28 غ/كغ لا يستدعي تحذيرًا');
});

t('حالة 3: Katch-McArdle مع LBM = 65', () => {
  near(NF.rmrKatch(65).value, 1774, 1e-9);
  const p = { sex: 'M', age: 25, heightCm: 180, weightKg: 80, lbmMeasured: true, lbmKg: 65, lbmMethod: 'DEXA', lbmReliabilityPct: 80 };
  assert.strictEqual(NF.chooseRmr(p).method, 'KATCH');
  assert.strictEqual(NF.chooseRmr(Object.assign({}, p, { lbmReliabilityPct: 60 })).method, 'MIFFLIN');
  assert.strictEqual(NF.chooseRmr(Object.assign({}, p, { lbmMethod: 'ESTIMATE' })).method, 'MIFFLIN');
});

t('حالة 4: المكمل', () => {
  const a = NF.evaluateSupplement(144, 40);
  near(a.pct, 27.78, 0.01); assert.strictEqual(a.band, 'BALANCED'); assert.strictEqual(a.capApplied, false);
  const b = NF.evaluateSupplement(144, 100);
  near(b.pct, 69.44, 0.01); near(b.countedG, 72, 1e-9); assert.strictEqual(b.capApplied, true); assert.strictEqual(b.band, 'CAPPED');
  assert.strictEqual(NF.evaluateSupplement(144, 28.8).band, 'LIGHT');
  assert.strictEqual(NF.evaluateSupplement(144, 0).countedG, 0);
});

t('حالة 5: حدود المدخلات', () => {
  const bad = (o) => NF.validateProfile(Object.assign({ sex: 'M', age: 25, heightCm: 180, weightKg: 80 }, o));
  assert.ok(!bad({ weightKg: 29.9 }).ok);
  assert.ok(!bad({ age: 17 }).ok);
  assert.ok(bad({ age: 17 }).errors[0].message.includes('18'));
  assert.ok(!bad({ heightCm: 119 }).ok);
  assert.ok(!bad({ weightKg: NaN }).ok);
  assert.ok(!bad({ sex: '' }).ok);
  assert.ok(bad({}).ok);
});

t('الكارب السالب يُرجع MACROS_EXCEED_TARGET ولا يُقرَّب إلى صفر', () => {
  const m = NF.computeMacros({ weightKg: 80, targetKcal: 1500, proteinPerKg: 3.1, fatPct: 35 });
  assert.strictEqual(m.ok, false);
  assert.strictEqual(m.errors[0].code, 'MACROS_EXCEED_TARGET');
  assert.ok(m.errors[0].details.missingKcal > 0);
});

console.log('حدود الأمان:');

t('الهدف دون RMR يُرفض', () => {
  const r = NF.computeTarget({ tdee: 2000, rmr: 1900, pct: -10, weightKg: 80 });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.errors[0].code, 'BELOW_RMR');
});
t('عجز أكبر من 20% يحتاج تأكيدًا', () => {
  assert.strictEqual(NF.computeTarget({ tdee: 3000, rmr: 1500, pct: -25, weightKg: 80 }).errors[0].code, 'DEEP_DEFICIT_UNCONFIRMED');
  assert.ok(NF.computeTarget({ tdee: 3000, rmr: 1500, pct: -25, weightKg: 80, confirmDeepDeficit: true }).ok);
});
t('خارج ±25% مرفوض', () => {
  assert.strictEqual(NF.computeTarget({ tdee: 3000, rmr: 1500, pct: 26, weightKg: 80 }).errors[0].code, 'PCT_OUT_OF_RANGE');
});
t('PAL خارج نطاق النمط مرفوض', () => {
  assert.ok(!NF.getPal('LIGHT', 1.8).ok);
  assert.ok(NF.getPal('LIGHT', 1.5).ok);
  assert.ok(!NF.getPal('NOPE').ok);
});
t('كل مستويات النشاط الأربعة تقع قيمتها الافتراضية داخل نطاق FAO', () => {
  Object.keys(NF.ACTIVITY).forEach((k) => assert.ok(NF.getPal(k).ok, k));
});
t('تحذيرات الماكروز', () => {
  const hi = NF.computeMacros({ weightKg: 80, targetKcal: 4500, proteinPerKg: 3.2, fatPct: 25 });
  assert.ok(hi.ok && hi.warnings.some((x) => x.code === 'PROTEIN_VERY_HIGH'));
  const lo = NF.computeMacros({ weightKg: 80, targetKcal: 2000, proteinPerKg: 2.0, fatPct: 25 });
  assert.ok(lo.warnings.some((x) => x.code === 'CARBS_LOW'));
});

console.log('الأغذية والوجبات:');

t('كل سجل غذائي: حساسيات إلزامية، وفرق الطاقة ≤10% أو energyNote', () => {
  assert.strictEqual(NF.FOODS.length, 22);
  NF.FOODS.forEach((f) => {
    assert.ok(Array.isArray(f.allergens), f.id + ' allergens');
    const d = Math.abs(NF.energyDeltaPct(f));
    assert.ok(d <= NF.ENERGY_DELTA_MAX_PCT || f.energyNote, f.id + ' delta ' + d.toFixed(1));
  });
});
t('كم غرام للوصول للهدف', () => {
  near(NF.gramsForTarget(NF.getFood('chicken'), 'p', 144), 464.5, 0.1);
  assert.strictEqual(NF.gramsForTarget(NF.getFood('olive_oil'), 'p', 100), null);
});
t('حجب الحساسيات', () => {
  assert.deepStrictEqual(NF.blockedBy(NF.getFood('almonds'), ['TREE_NUTS', 'EGG']), ['TREE_NUTS']);
  assert.deepStrictEqual(NF.blockedBy(NF.getFood('rice'), ['GLUTEN']), []);
});
t('النسب: متساوية ومخصصة', () => {
  assert.ok(NF.validatePcts(NF.equalPcts(3)).ok);
  assert.ok(NF.validatePcts([30, 30, 40]).ok);
  assert.ok(!NF.validatePcts([30, 30, 30]).ok);
  assert.ok(!NF.validatePcts([100, 0]).ok);
});
t('توزيع الأغذية على الوجبات يحفظ المجموع', () => {
  const items = [{ foodId: 'chicken', grams: 400 }, { foodId: 'rice', grams: 600 }];
  const meals = NF.mealPlan(items, [25, 25, 50], 80);
  const sumG = meals.reduce((a, m) => a + m.items[0].grams, 0);
  near(sumG, 400, 1e-9);
  const total = NF.foodMacros(NF.getFood('chicken'), 400).p + NF.foodMacros(NF.getFood('rice'), 600).p;
  near(meals.reduce((a, m) => a + m.macros.p, 0), total, 1e-9);
});
t('المطبخ: نيء نظري وهامش الهدر منفصلان', () => {
  const k = NF.kitchenQuantities({ requiredCookedG: 300, yieldFactor: 0.75, wasteMarginPct: 0 });
  near(k.theoreticalRawG, 400, 1e-9); near(k.purchaseRawG, 400, 1e-9);
  near(NF.kitchenQuantities({ requiredCookedG: 300, yieldFactor: 0.75, wasteMarginPct: 5 }).purchaseRawG, 420, 1e-9);
  assert.ok(!NF.kitchenQuantities({ requiredCookedG: 300 }).ok);
});

console.log('الطلب والتوصيل:');

t('موعد التوصيل بتوقيت الجزائر', () => {
  assert.strictEqual(NF.deliveryDate(new Date('2026-11-17T10:00:00Z')).iso, '2026-11-18');
  const late = NF.deliveryDate(new Date('2026-11-17T19:30:00Z'));
  assert.strictEqual(late.iso, '2026-11-19'); assert.ok(late.afterCutoff);
  assert.strictEqual(NF.deliveryDate(new Date('2026-12-31T10:00:00Z')).iso, '2027-01-01');
});
t('المال أعداد صحيحة بالسنتيم', () => {
  NF.PRICING.pricePerKgCentimes.chicken = 120000;
  assert.strictEqual(NF.itemPriceCentimes('chicken', 250), 30000);
  assert.strictEqual(NF.itemPriceCentimes('rice', 250), null);
  assert.strictEqual(NF.formatDZD(30050), '300.50 DZD');
  delete NF.PRICING.pricePerKgCentimes.chicken;
});
t('Snapshot الطلب مستقل عن بيانات الأغذية', () => {
  const o = NF.buildOrder({ id: 'T1', now: new Date('2026-11-17T10:00:00Z'), items: [{ foodId: 'chicken', grams: 300 }], allergies: [], targets: { kcal: 1 }, deliveryMode: 'SEPARATE', pcts: [100], foodsVerified: false });
  assert.strictEqual(o.status, 'DRAFT_DEV');
  NF.getFood('chicken').per100.kcal = 999;
  assert.strictEqual(o.items[0].per100.kcal, 165);
  NF.getFood('chicken').per100.kcal = 165;
});

console.log('\n' + passed + ' اختبارًا نجحت');
