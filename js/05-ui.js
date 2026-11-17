/* NutriFit DZ — 05-ui.js
 * الحالة + حساب الخطة + دوال رسم الشاشات (ترجع نصوص HTML). لا ربط أحداث هنا. */
(function (g) {
  'use strict';
  const NF = g.NF;
  const UI = (NF.ui = {});

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => (v === '' || v == null ? NaN : Number(v));
  const r0 = (n) => Math.round(n);
  const r1 = (n) => String(Math.round(n * 10) / 10);
  const STEPS = ['بياناتك', 'نشاطك', 'هدفك', 'احتياجك', 'الأطعمة', 'التوزيع', 'الطلب'];
  const KEY = 'nf.state.v1';

  UI.esc = esc; UI.num = num;

  function defaults() {
    return {
      step: 1, sex: '', age: '', heightCm: '', weightKg: '', consent: false, allergies: [],
      activity: 'MODERATE', goal: 'BUILD', adjPct: null, proteinPerKg: null, fatPct: NF.FAT_DEFAULT_PCT,
      suppUses: false, suppG: '', sel: {}, mealCount: 3, pcts: null, delivery: 'SEPARATE',
      editing: null, gramsTmp: '', errors: [], done: null
    };
  }
  UI.state = defaults();
  UI.defaults = defaults;

  UI.load = function () {
    try {
      const raw = g.localStorage && g.localStorage.getItem(KEY);
      if (raw) UI.state = Object.assign(defaults(), JSON.parse(raw), { editing: null, errors: [], done: null });
    } catch (err) { /* التخزين قد يكون غير متاح */ }
  };
  UI.save = function () {
    try { g.localStorage && g.localStorage.setItem(KEY, JSON.stringify(UI.state)); } catch (err) { /* تجاهل */ }
  };
  UI.reset = function () { UI.state = defaults(); UI.save(); };

  /* ---------- حساب الخطة ---------- */
  UI.compute = function () {
    const S = UI.state;
    const p = { sex: S.sex, age: num(S.age), heightCm: num(S.heightCm), weightKg: num(S.weightKg) };
    const v = NF.validateProfile(p);
    if (!v.ok) return { ok: false, errors: v.errors };
    const goal = NF.GOALS[S.goal];
    const rmr = NF.chooseRmr(p);
    const pal = NF.getPal(S.activity);
    if (!pal.ok) return pal;
    const tdee = NF.computeTdee(rmr.value, pal.value);
    const pct = S.adjPct === null || S.adjPct === '' ? goal.pct : num(S.adjPct);
    const tk = NF.computeTarget({ tdee: tdee.value, rmr: rmr.value, pct, weightKg: p.weightKg });
    if (!tk.ok) return tk;
    const ppk = S.proteinPerKg === null || S.proteinPerKg === '' ? goal.protein : num(S.proteinPerKg);
    const fatPct = S.fatPct === '' ? NF.FAT_DEFAULT_PCT : num(S.fatPct);
    if (!(ppk > 0) || !(fatPct > 0))
      return { ok: false, errors: [{ code: 'BAD_INPUT', field: 'macros', message: 'قيمة البروتين أو الدهون غير صالحة' }] };
    const m = NF.computeMacros({ weightKg: p.weightKg, targetKcal: tk.value, proteinPerKg: ppk, fatPct });
    if (!m.ok) return m;
    const warnings = [].concat(tk.warnings, m.warnings);
    if (ppk < goal.proteinRange[0] || ppk > goal.proteinRange[1])
      warnings.push({ code: 'PROTEIN_OUT_OF_RANGE', message: 'البروتين خارج نطاق ISSN لهذا الهدف (' + goal.proteinRange[0] + '-' + goal.proteinRange[1] + ' غ/كغ).' });
    const supp = NF.evaluateSupplement(m.proteinG, S.suppUses ? num(S.suppG) || 0 : 0);
    const suppKcal = supp.countedG * 4;
    const food = { kcal: tk.value - suppKcal, p: m.proteinG - supp.countedG, c: m.carbsG, f: m.fatG };
    return { ok: true, p, rmr, pal, tdee, tk, m, supp, food, warnings, pct, ppk };
  };

  function totals() {
    const t = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
    Object.keys(UI.state.sel).forEach(function (id) {
      const f = NF.getFood(id);
      if (!f) return;
      const m = NF.foodMacros(f, UI.state.sel[id]);
      Object.keys(t).forEach(function (k) { t[k] += m[k]; });
    });
    return t;
  }
  UI.totals = totals;

  function remainingExcluding(C, exceptId) {
    const t = { kcal: 0, p: 0, c: 0, f: 0 };
    Object.keys(UI.state.sel).forEach(function (id) {
      if (id === exceptId) return;
      const f = NF.getFood(id);
      const m = NF.foodMacros(f, UI.state.sel[id]);
      Object.keys(t).forEach(function (k) { t[k] += m[k]; });
    });
    return { kcal: C.food.kcal - t.kcal, p: C.food.p - t.p, c: C.food.c - t.c, f: C.food.f - t.f };
  }

  UI.suggest = function (C, food) {
    const key = NF.CATEGORIES[food.cat].key;
    const rem = remainingExcluding(C, food.id)[key];
    const g = NF.gramsForTarget(food, key, rem);
    return g == null ? 0 : Math.max(0, r0(g));
  };

  /* ---------- مكونات صغيرة ---------- */
  const badge = (cls, src) =>
    '<span class="badge c-' + cls + '" title="' + esc(NF.CLASS[cls].ar) + '">' + cls + '</span>' +
    (src ? '<span class="src">' + esc(NF.SOURCES[src].short) + '</span>' : '');

  const field = (key, label, value, extra) =>
    '<label class="fld"><span>' + esc(label) + '</span><input inputmode="decimal" data-f="' + key + '" value="' + esc(value) + '" ' + (extra || '') + '></label>';

  const warnList = (ws) =>
    ws && ws.length ? '<ul class="warns">' + ws.map((x) => '<li>' + esc(x.message) + '</li>').join('') + '</ul>' : '';

  const errList = (es) =>
    es && es.length ? '<ul class="errs">' + es.map((x) => '<li>' + esc(x.message) + '</li>').join('') + '</ul>' : '';

  const devBanner = () =>
    NF.FOOD_DATA.verified ? '' :
      '<div class="dev">⚠️ قيم الأطعمة والحساسيات تجريبية وغير موثقة. لا تعتمد عليها لطلب حقيقي.</div>';

  /* ---------- الشاشات ---------- */
  function step1() {
    const S = UI.state;
    const chips = Object.keys(NF.ALLERGENS).map(function (id) {
      return '<button type="button" class="chip' + (S.allergies.indexOf(id) !== -1 ? ' on' : '') + '" data-act="allergy" data-v="' + id + '">' + esc(NF.ALLERGENS[id]) + '</button>';
    }).join('');
    return '<h2>بياناتك</h2>' +
      '<div class="seg"><button type="button" class="' + (S.sex === 'M' ? 'on' : '') + '" data-act="sex" data-v="M">ذكر</button>' +
      '<button type="button" class="' + (S.sex === 'F' ? 'on' : '') + '" data-act="sex" data-v="F">أنثى</button></div>' +
      '<div class="grid3">' + field('age', 'العمر', S.age) + field('heightCm', 'الطول (سم)', S.heightCm) + field('weightKg', 'الوزن (كغ)', S.weightKg) + '</div>' +
      '<h3>هل لديك حساسية غذائية؟</h3><p class="muted">الأطعمة المحتوية عليها تُحجب عنك تلقائيًا.</p><div class="chips">' + chips + '</div>' +
      '<label class="chk"><input type="checkbox" data-f="consent" ' + (S.consent ? 'checked' : '') + '><span>أنا بالغ (18+) وأفهم أن هذه أداة تغذية رياضية وليست بديلًا عن الاستشارة الطبية.</span></label>';
  }

  function step2() {
    const S = UI.state;
    return '<h2>نشاطك</h2><p class="muted">اختر الأقرب لحياتك اليومية مع التدريب.</p>' +
      Object.keys(NF.ACTIVITY).map(function (k) {
        const a = NF.ACTIVITY[k];
        return '<button type="button" class="card opt' + (S.activity === k ? ' on' : '') + '" data-act="activity" data-v="' + k + '"><b>' + esc(a.ar) + '</b><span>' + esc(a.desc) + '</span><small>PAL ' + a.pal + ' ضمن ' + a.range[0] + '–' + a.range[1] + '</small></button>';
      }).join('');
  }

  function step3() {
    const S = UI.state;
    const goal = NF.GOALS[S.goal];
    return '<h2>هدفك</h2>' +
      Object.keys(NF.GOALS).map(function (k) {
        const gg = NF.GOALS[k];
        return '<button type="button" class="card opt' + (S.goal === k ? ' on' : '') + '" data-act="goal" data-v="' + k + '"><b>' + esc(gg.ar) + '</b><span>' + (gg.pct > 0 ? '+' : '') + gg.pct + '% سعرات · بروتين ' + gg.protein + ' غ/كغ</span></button>';
      }).join('') +
      '<details class="adv"><summary>إعدادات متقدمة (اختياري)</summary>' +
      field('adjPct', 'فائض/عجز % (من -25 إلى +25)', S.adjPct === null ? '' : S.adjPct, 'placeholder="' + goal.pct + '"') +
      field('proteinPerKg', 'البروتين غ/كغ', S.proteinPerKg === null ? '' : S.proteinPerKg, 'placeholder="' + goal.protein + '"') +
      field('fatPct', 'الدهون % من الطاقة', S.fatPct) +
      '<p class="muted">الفائض/العجز قيمة تشغيلية شائعة وليست قاعدة علمية، وتُعايَر لاحقًا.</p></details>';
  }

  function macroCard(label, val, unit, cls, src) {
    return '<div class="stat"><small>' + esc(label) + '</small><b>' + val + '</b><em>' + unit + '</em><div class="meta">' + badge(cls, src) + '</div></div>';
  }

  function suppBand(s) {
    const t = { LIGHT: 'مكمل خفيف', BALANCED: 'توازن جيد', ACCEPTABLE: 'مقبول', HIGH: 'مرتفع', CAPPED: 'تجاوز السقف' };
    return t[s.band] || '';
  }

  function step4(C) {
    const S = UI.state;
    if (!C.ok) return '<h2>احتياجك</h2>' + errList(C.errors) + '<button type="button" class="btn ghost" data-act="goto" data-v="' + (C.errors[0].field === 'macros' || C.errors[0].field === 'pct' ? 3 : 1) + '">عدّل المدخلات</button>';
    const sup = C.supp;
    let suppHtml = '<label class="chk"><input type="checkbox" data-f="suppUses" data-r="1" ' + (S.suppUses ? 'checked' : '') + '><span>أستخدم مكمل بروتين (المنصة لا تبيع المكملات)</span></label>';
    if (S.suppUses) {
      suppHtml += field('suppG', 'بروتين المكمل الفعلي يوميًا (غرام بروتين، لا وزن المسحوق)', S.suppG, 'data-r="1"');
      if (sup.countedG > 0) {
        suppHtml += '<p class="muted">نسبة المكمل ' + r0(sup.pct) + '% من بروتين اليوم — ' + esc(suppBand(sup)) + ' ' + badge('C', 'PLATFORM') + '</p>';
        if (sup.capApplied) suppHtml += '<p class="warns">السقف ' + NF.SUPP_CAP_PCT + '% قرار المنصة لأولوية الأغذية الكاملة؛ المحسوب ' + r0(sup.countedG) + ' غ فقط، والباقي من الطعام.</p>';
      }
    }
    return '<h2>احتياجك اليومي</h2>' +
      '<div class="stats">' +
      macroCard('السعرات', r0(C.tk.value), 'kcal', 'O', 'PLATFORM') +
      macroCard('بروتين', r0(C.m.proteinG), 'غ', 'O', 'ISSN2017') +
      macroCard('كارب', r0(C.m.carbsG), 'غ', 'F', 'ACSM2016') +
      macroCard('دهون', r1(C.m.fatG), 'غ', 'O', 'IOM2005') +
      macroCard('ألياف', '≥ ' + C.m.fiberMinG, 'غ', 'R', 'WHO2023') + '</div>' +
      '<div class="card calc"><div>RMR <b>' + r0(C.rmr.value) + '</b> kcal ' + badge('F', C.rmr.method === 'KATCH' ? 'KATCH' : 'MSJ1990') + '</div>' +
      '<div>× PAL <b>' + C.pal.value + '</b> ' + badge('O', 'FAO2004') + '</div>' +
      '<div>= TDEE <b>' + r0(C.tdee.value) + '</b> kcal</div>' +
      '<div>' + (C.pct > 0 ? '+' : '') + C.pct + '% ← هدف <b>' + r0(C.tk.value) + '</b> kcal</div></div>' +
      warnList(C.warnings) + suppHtml +
      '<p class="muted">' + esc(NF.DISCLAIMER) + '</p>' +
      '<details class="adv"><summary>المصادر العلمية</summary>' +
      ['MSJ1990', 'FAO2004', 'ISSN2017', 'IOM2005', 'ACSM2016', 'WHO2023'].map((k) => '<p class="ref"><b>' + esc(NF.SOURCES[k].short) + '</b><br>' + esc(NF.SOURCES[k].ref) + '</p>').join('') +
      '<p class="muted">F معادلة منشورة · R نطاق موصى به · O قيمة تشغيلية · C افتراض المنصة. لا يوجد جدول تركيب غذائي جزائري رسمي، فقيم الأغذية من أقرب مصدر دولي.</p></details>';
  }

  function capsule(C) {
    const t = totals();
    const row = (label, target, got, unit) => {
      const rem = target - got;
      return '<div class="cap' + (rem < -0.5 ? ' over' : '') + '"><small>' + label + '</small><b>' + r0(rem) + '</b><em>' + unit + '</em></div>';
    };
    return '<div class="capsule" id="capsule">' + row('سعرات', C.food.kcal, t.kcal, 'kcal') + row('بروتين', C.food.p, t.p, 'غ') + row('كارب', C.food.c, t.c, 'غ') + row('دهون', C.food.f, t.f, 'غ') + '</div>';
  }
  UI.capsule = capsule;

  function foodCard(f, C) {
    const S = UI.state;
    const blocked = NF.blockedBy(f, S.allergies);
    const key = NF.CATEGORIES[f.cat].key;
    const need = NF.gramsForTarget(f, key, C.food[key]);
    const sel = S.sel[f.id];
    const p = f.per100;
    const line = p.kcal + ' kcal · ب ' + p.p + ' · ك ' + p.c + ' · د ' + p.f + ' <small>/100غ</small>';
    if (blocked.length)
      return '<div class="card food blocked"><b>' + esc(f.name_ar) + '</b><span>محجوب: يحتوي ' + blocked.map((a) => esc(NF.ALLERGENS[a])).join('، ') + '</span></div>';
    return '<button type="button" class="card food' + (sel != null ? ' on' : '') + '" data-act="openFood" data-v="' + f.id + '"><b>' + esc(f.name_ar) + (sel != null ? ' · ' + r0(sel) + ' غ' : '') + '</b><span>' + line + '</span>' +
      '<small>' + (need ? 'للوصول لهدف ال' + NF.MACRO_AR[key] + ': ' + r0(need) + ' غ' : 'لا يحتوي ' + NF.MACRO_AR[key]) + '</small>' +
      (f.allergens.length ? '<small class="al">قد يحتوي آثار: ' + f.allergens.map((a) => esc(NF.ALLERGENS[a])).join('، ') + '</small>' : '') + '</button>';
  }

  function previewHtml(f, grams) {
    if (!(grams > 0)) return 'أدخل الكمية لترى الأثر';
    const m = NF.foodMacros(f, grams);
    return 'هذه الكمية تضيف ' + r0(m.kcal) + ' kcal · بروتين ' + r1(m.p) + ' · كارب ' + r1(m.c) + ' · دهون ' + r1(m.f);
  }
  UI.previewHtml = previewHtml;

  function sheet(C) {
    const S = UI.state;
    if (!S.editing) return '';
    const f = NF.getFood(S.editing);
    const cur = S.sel[f.id];
    const sug = UI.suggest(C, f);
    return '<div class="sheet-bg" data-act="closeSheet"></div><div class="sheet"><h3>' + esc(f.name_ar) + '</h3>' +
      '<label class="fld"><span>الكمية (غرام)</span><input id="grams" inputmode="decimal" data-f="grams" value="' + esc(S.gramsTmp) + '"></label>' +
      '<button type="button" class="btn ghost" data-act="suggest">الكمية المقترحة: ' + sug + ' غ</button>' +
      '<div id="preview" class="preview">' + previewHtml(f, num(S.gramsTmp)) + '</div>' +
      '<div class="row"><button type="button" class="btn" data-act="saveFood">حفظ</button>' +
      (cur != null ? '<button type="button" class="btn danger" data-act="removeFood">إزالة</button>' : '') + '</div></div>';
  }

  function step5(C) {
    if (!C.ok) return '<h2>الأطعمة</h2>' + errList(C.errors);
    const cats = Object.keys(NF.CATEGORIES).map(function (cat) {
      return '<h3>' + esc(NF.CATEGORIES[cat].ar) + '</h3>' + NF.FOODS.filter((f) => f.cat === cat).map((f) => foodCard(f, C)).join('');
    }).join('');
    return devBanner() + '<h2>اختر أطعمتك</h2>' + cats + sheet(C);
  }

  function step6(C) {
    const S = UI.state;
    if (!C.ok) return '<h2>التوزيع</h2>' + errList(C.errors);
    const items = Object.keys(S.sel).map((id) => ({ foodId: id, grams: S.sel[id] }));
    const pcts = S.pcts && S.pcts.length === S.mealCount ? S.pcts : NF.equalPcts(S.mealCount);
    const v = NF.validatePcts(pcts);
    const meals = v.ok ? NF.mealPlan(items, pcts, C.p.weightKg) : [];
    let html = devBanner() + '<h2>توزيع الوجبات</h2><div class="seg">' +
      [1, 2, 3, 4].map((n) => '<button type="button" class="' + (S.mealCount === n ? 'on' : '') + '" data-act="count" data-v="' + n + '">' + (n === 1 ? 'دفعة' : n + ' وجبات') + '</button>').join('') + '</div>' +
      '<div class="seg"><button type="button" class="' + (S.delivery === 'SEPARATE' ? 'on' : '') + '" data-act="delivery" data-v="SEPARATE">كل وجبة في وقتها</button>' +
      '<button type="button" class="' + (S.delivery === 'ONCE' ? 'on' : '') + '" data-act="delivery" data-v="ONCE">كلها دفعة واحدة</button></div>';
    if (S.mealCount > 1)
      html += '<div class="pcts">' + pcts.map((p, i) => '<label class="fld"><span>وجبة ' + (i + 1) + ' %</span><input inputmode="decimal" data-f="pct" data-i="' + i + '" data-r="1" value="' + r1(p) + '"></label>').join('') + '</div>';
    if (!v.ok) return html + errList(v.errors);
    if (!items.length) return html + '<p class="warns">اختر أطعمة في الخطوة السابقة أولًا.</p>';
    html += meals.map(function (m) {
      return '<div class="card meal"><b>وجبة ' + (m.index + 1) + ' · ' + r1(m.pct) + '%</b>' +
        '<span>' + r0(m.macros.kcal) + ' kcal · ب ' + r0(m.macros.p) + ' · ك ' + r0(m.macros.c) + ' · د ' + r1(m.macros.f) + '</span>' +
        '<ul>' + m.items.map((l) => '<li>' + esc(NF.getFood(l.foodId).name_ar) + ' — ' + r0(l.grams) + ' غ</li>').join('') + '</ul>' + warnList(m.warnings) + '</div>';
    }).join('');
    return html;
  }

  function step7(C) {
    const S = UI.state;
    if (!C.ok) return '<h2>الطلب</h2>' + errList(C.errors);
    if (S.done) {
      return '<h2>تم حفظ الطلب</h2><div class="card"><p>رقم الطلب <b>' + esc(S.done.id) + '</b></p><p>التوصيل: <b>' + esc(S.done.deliveryDate) + '</b></p><p>الدفع عند الاستلام.</p>' +
        (S.done.status === 'DRAFT_DEV' ? '<p class="warns">هذا طلب تجريبي (DRAFT_DEV): القيم الغذائية غير موثقة بعد.</p>' : '') +
        '</div><button type="button" class="btn ghost" data-act="reset">خطة جديدة</button>';
    }
    const t = totals();
    const items = Object.keys(S.sel).map((id) => ({ foodId: id, grams: S.sel[id] }));
    const dd = NF.deliveryDate(new Date());
    const priced = items.every((i) => NF.itemPriceCentimes(i.foodId, i.grams) != null);
    const sub = priced ? items.reduce((a, i) => a + NF.itemPriceCentimes(i.foodId, i.grams), 0) : null;
    const fee = NF.PRICING.deliveryFeeCentimes;
    const rows = items.map((i) => '<li>' + esc(NF.getFood(i.foodId).name_ar) + ' — ' + r0(i.grams) + ' غ' + (NF.itemPriceCentimes(i.foodId, i.grams) != null ? ' · ' + NF.formatDZD(NF.itemPriceCentimes(i.foodId, i.grams)) : '') + '</li>').join('');
    const dev = (a, b) => { const d = a - b; return (d >= 0 ? '+' : '') + r0(d); };
    return devBanner() + '<h2>مراجعة الطلب</h2><div class="card"><ul>' + (rows || '<li>لا أطعمة مختارة</li>') + '</ul></div>' +
      '<div class="card calc"><div>المجموع: <b>' + r0(t.kcal) + '</b> kcal (' + dev(t.kcal, C.food.kcal) + ' عن الهدف)</div>' +
      '<div>بروتين ' + r0(t.p) + ' (' + dev(t.p, C.food.p) + ') · كارب ' + r0(t.c) + ' (' + dev(t.c, C.food.c) + ') · دهون ' + r1(t.f) + ' (' + dev(t.f, C.food.f) + ')</div>' +
      '<div>ألياف ' + r0(t.fiber) + ' غ' + (t.fiber < NF.FIBER_MIN_G ? ' — أقل من ' + NF.FIBER_MIN_G + ' غ الموصى بها' : '') + '</div></div>' +
      '<div class="card calc"><div>المجموع الفرعي: <b>' + (sub != null ? NF.formatDZD(sub) : 'يحدده المشرف') + '</b></div>' +
      '<div>التوصيل: <b>' + (fee != null ? NF.formatDZD(fee) : 'يحدده المشرف') + '</b></div>' +
      '<div>موعد التوصيل: <b>' + dd.iso + '</b>' + (dd.afterCutoff ? ' (بعد إغلاق اليوم ' + NF.PRICING.cutoffHourAlgiers + ':00 بتوقيت الجزائر)' : '') + '</div>' +
      '<div>الدفع: عند الاستلام</div></div><p class="muted">' + esc(NF.DISCLAIMER) + '</p>';
  }

  UI.html = function () {
    const S = UI.state;
    const C = UI.compute();
    let body;
    switch (S.step) {
      case 1: body = step1(); break;
      case 2: body = step2(); break;
      case 3: body = step3(); break;
      case 4: body = step4(C); break;
      case 5: body = step5(C); break;
      case 6: body = step6(C); break;
      default: body = step7(C);
    }
    const cap = C.ok && (S.step === 5 || S.step === 6) ? capsule(C) : '';
    const err = S.errors.length ? errList(S.errors) : '';
    const nav = S.done ? '' :
      '<nav class="nav">' + (S.step > 1 ? '<button type="button" class="btn ghost" data-act="back">رجوع</button>' : '<span></span>') +
      '<button type="button" class="btn" data-act="' + (S.step === 7 ? 'confirm' : 'next') + '">' + (S.step === 7 ? 'تأكيد الطلب' : 'التالي') + '</button></nav>';
    return '<header class="top"><b>NutriFit DZ</b><span>' + S.step + ' / 7 · ' + STEPS[S.step - 1] + '</span></header>' + cap +
      '<main>' + err + body + '</main>' + nav;
  };

  UI.C = null;
})(typeof window !== 'undefined' ? window : globalThis);
