/* NutriFit DZ — 02-engine.js
 * المحرك العلمي: دوال نقية بلا DOM ولا شبكة ولا تخزين.
 * مبادئ: لا تقريب داخلي (التقريب للعرض فقط)، لا رفض صامت، كل نتيجة تحمل
 * value, unit, classification, sourceId, formulaVersion, warnings. */
(function (g) {
  'use strict';
  const NF = (g.NF = g.NF || {});

  const res = (value, unit, cls, sourceId, warnings, extra) =>
    Object.assign(
      { ok: true, value, unit, classification: cls, sourceId, formulaVersion: NF.VERSION.formula, warnings: warnings || [] },
      extra || {}
    );
  const fail = (errors) => ({ ok: false, errors });
  const e = (code, field, message, details) => ({ code, field, message, details });
  const w = (code, message) => ({ code, message });
  const R0 = (n) => Math.round(n);

  /* ---------- التحقق من المدخلات ---------- */
  NF.validateProfile = function (p) {
    const errors = [];
    if (p.sex !== 'M' && p.sex !== 'F') errors.push(e('MISSING_FIELD', 'sex', 'اختر الجنس'));
    const fields = [
      ['age', 'العمر', NF.LIMITS.age],
      ['heightCm', 'الطول (سم)', NF.LIMITS.heightCm],
      ['weightKg', 'الوزن (كغ)', NF.LIMITS.weightKg]
    ];
    fields.forEach(function (f) {
      const k = f[0], label = f[1], lo = f[2][0], hi = f[2][1];
      const v = p[k];
      if (typeof v !== 'number' || !isFinite(v)) errors.push(e('MISSING_FIELD', k, 'أدخل ' + label));
      else if (v < lo || v > hi) {
        const msg = k === 'age' && v < lo
          ? 'هذه الأداة للبالغين (18 سنة فأكثر)'
          : label + ' يجب أن يكون بين ' + lo + ' و' + hi;
        errors.push(e('OUT_OF_RANGE', k, msg));
      }
    });
    return { ok: errors.length === 0, errors };
  };

  /* ---------- RMR ---------- */
  NF.rmrMifflin = function (p) {
    const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
    return res(base + (p.sex === 'M' ? 5 : -161), 'kcal/day', 'F', 'MSJ1990', [], { method: 'MIFFLIN' });
  };

  NF.rmrKatch = function (lbmKg) {
    return res(370 + 21.6 * lbmKg, 'kcal/day', 'F', 'KATCH', [], { method: 'KATCH' });
  };

  /* Katch-McArdle فقط بقياس LBM موثوق، وإلا Mifflin. العتبة 70 تصنيف C. */
  NF.chooseRmr = function (p) {
    if (
      p.lbmMeasured && p.lbmKg > 0 &&
      NF.LBM_METHODS.indexOf(p.lbmMethod) !== -1 &&
      p.lbmReliabilityPct >= NF.LBM_MIN_RELIABILITY
    ) return NF.rmrKatch(p.lbmKg);
    return NF.rmrMifflin(p);
  };

  /* ---------- PAL و TDEE ---------- */
  NF.getPal = function (level, palValue) {
    const a = NF.ACTIVITY[level];
    if (!a) return fail([e('BAD_ACTIVITY', 'activity', 'مستوى نشاط غير معروف')]);
    const v = palValue == null ? a.pal : palValue;
    if (typeof v !== 'number' || v < a.range[0] || v > a.range[1])
      return fail([e('PAL_OUT_OF_RANGE', 'palValue', 'قيمة PAL يجب أن تقع بين ' + a.range[0] + ' و' + a.range[1])]);
    return res(v, 'PAL', 'O', 'FAO2004', [], { range: a.range, rangeClass: 'R' });
  };

  NF.computeTdee = function (rmr, pal) {
    return res(rmr * pal, 'kcal/day', 'F', 'FAO2004');
  };

  /* ---------- السعرات المستهدفة ---------- */
  NF.computeTarget = function (o) {
    const pct = o.pct;
    if (typeof pct !== 'number' || !isFinite(pct) || pct < NF.PCT_LIMIT[0] || pct > NF.PCT_LIMIT[1])
      return fail([e('PCT_OUT_OF_RANGE', 'pct', 'نسبة الفائض/العجز يجب أن تكون بين ' + NF.PCT_LIMIT[0] + '% و+' + NF.PCT_LIMIT[1] + '%')]);
    if (pct < NF.DEEP_DEFICIT_PCT && !o.confirmDeepDeficit)
      return fail([e('DEEP_DEFICIT_UNCONFIRMED', 'pct', 'عجز أكبر من 20% مخصص لفترات قصيرة ويحتاج تأكيدًا صريحًا منك')]);

    const target = o.tdee * (1 + pct / 100);
    if (target < o.rmr)
      return fail([e('BELOW_RMR', 'pct',
        'الهدف (' + R0(target) + ' kcal) أقل من معدل الأيض أثناء الراحة (' + R0(o.rmr) + ' kcal). خفّف العجز.',
        { target, rmr: o.rmr })]);

    const warnings = [];
    if (target < o.rmr * 1.05) warnings.push(w('NEAR_RMR', 'الهدف قريب جدًّا من معدل الأيض أثناء الراحة.'));
    const weeklyChangeKg = ((target - o.tdee) * 7) / NF.KCAL_PER_KG_BODY_CHANGE; // سالب = خسارة
    if (weeklyChangeKg < 0 && -weeklyChangeKg > (NF.MAX_WEEKLY_LOSS_PCT / 100) * o.weightKg)
      warnings.push(w('FAST_LOSS', 'معدل الخسارة المتوقع يتجاوز 1% من وزن الجسم أسبوعيًّا.'));
    return res(target, 'kcal/day', 'O', 'PLATFORM', warnings, { pct, weeklyChangeKg });
  };

  /* ---------- الماكروز ---------- */
  NF.computeMacros = function (o) {
    const wgt = o.weightKg;
    const proteinG = o.proteinPerKg * wgt;
    const proteinKcal = proteinG * 4;
    const fatKcal = (o.targetKcal * o.fatPct) / 100;
    const fatG = fatKcal / 9;
    const carbsKcal = o.targetKcal - proteinKcal - fatKcal;

    if (carbsKcal < 0)
      return fail([e('MACROS_EXCEED_TARGET', 'macros',
        'البروتين والدهون معًا يتجاوزان السعرات المستهدفة بمقدار ' + R0(-carbsKcal) +
        ' kcal. جرّب خفض الدهون إلى ' + NF.FAT_RANGE_PCT[0] + '% أو خفّف البروتين ضمن نطاقه.',
        { proteinKcal, fatKcal, targetKcal: o.targetKcal, missingKcal: -carbsKcal })]);

    const carbsG = carbsKcal / 4;
    const carbsPerKg = carbsG / wgt;
    const warnings = [];
    if (o.proteinPerKg > NF.PROTEIN_WARN_PER_KG)
      warnings.push(w('PROTEIN_VERY_HIGH', 'بروتين عالٍ جدًّا؛ تأكد من الترطيب.'));
    if (o.fatPct < NF.FAT_RANGE_PCT[0] || o.fatPct > NF.FAT_RANGE_PCT[1])
      warnings.push(w('FAT_OUT_OF_RANGE', 'الدهون خارج النطاق الموصى به (' + NF.FAT_RANGE_PCT[0] + '-' + NF.FAT_RANGE_PCT[1] + '% من الطاقة).'));
    if (carbsPerKg < NF.CARB_WARN_PER_KG[0])
      warnings.push(w('CARBS_LOW', 'كارب منخفض جدًّا؛ قد يؤثر على الأداء.'));
    if (carbsPerKg > NF.CARB_WARN_PER_KG[1])
      warnings.push(w('CARBS_HIGH', 'كارب مرتفع جدًّا؛ راجع حجم التدريب.'));

    return {
      ok: true,
      proteinG, proteinKcal, fatG, fatKcal, carbsG, carbsKcal, carbsPerKg,
      proteinPerKg: o.proteinPerKg, fatPct: o.fatPct,
      fiberMinG: NF.FIBER_MIN_G,
      warnings,
      formulaVersion: NF.VERSION.formula,
      classes: { protein: 'O', fat: 'O', carbs: 'F', fiber: 'R' },
      sources: { protein: 'ISSN2017', fat: 'IOM2005', carbs: 'ACSM2016', fiber: 'WHO2023' }
    };
  };

  /* ---------- المكملات (نصح فقط، السقف 50% قرار منصة C) ---------- */
  NF.evaluateSupplement = function (totalProteinG, suppG) {
    if (!(suppG > 0))
      return { ok: true, enteredG: 0, countedG: 0, pct: 0, band: null, capApplied: false, classification: 'C', sourceId: 'PLATFORM' };
    const pct = (suppG / totalProteinG) * 100;
    const capG = (totalProteinG * NF.SUPP_CAP_PCT) / 100;
    const capApplied = suppG > capG;
    let band;
    if (pct <= 20) band = 'LIGHT';
    else if (pct <= 30) band = 'BALANCED';
    else if (pct <= 40) band = 'ACCEPTABLE';
    else if (pct <= 50) band = 'HIGH';
    else band = 'CAPPED';
    return {
      ok: true, enteredG: suppG, countedG: capApplied ? capG : suppG, pct, band, capApplied,
      classification: 'C', sourceId: 'PLATFORM'
    };
  };

  /* ---------- الأغذية ---------- */
  NF.getFood = function (id) {
    return (NF.FOODS || []).find(function (f) { return f.id === id; }) || null;
  };

  NF.foodMacros = function (food, grams) {
    const k = grams / 100, p = food.per100;
    return { kcal: p.kcal * k, p: p.p * k, c: p.c * k, f: p.f * k, fiber: (p.fiber || 0) * k };
  };

  NF.gramsForTarget = function (food, macroKey, targetG) {
    const per = food.per100[macroKey];
    if (!(per > 0) || !(targetG > 0)) return null;
    return (targetG / per) * 100;
  };

  /* الفرق بين طاقة المصدر وحساب 4/4/9 (موجب = الحساب أعلى). */
  NF.energyDeltaPct = function (food) {
    const p = food.per100;
    const calc = 4 * p.p + 4 * p.c + 9 * p.f;
    return ((calc - p.kcal) / p.kcal) * 100;
  };

  NF.blockedBy = function (food, allergies) {
    return (food.allergens || []).filter(function (a) { return (allergies || []).indexOf(a) !== -1; });
  };

  /* ---------- التوزيع على الوجبات ---------- */
  NF.equalPcts = function (n) {
    return Array.from({ length: n }, function () { return 100 / n; });
  };

  NF.validatePcts = function (pcts) {
    if (!pcts.length || pcts.some(function (x) { return typeof x !== 'number' || !(x > 0); }))
      return fail([e('BAD_PCT', 'pcts', 'كل نسبة يجب أن تكون أكبر من صفر')]);
    const sum = pcts.reduce(function (a, b) { return a + b; }, 0);
    if (Math.abs(sum - 100) > 0.05)
      return fail([e('PCT_SUM', 'pcts', 'مجموع النسب ' + (Math.round(sum * 10) / 10) + '% ويجب أن يساوي 100%')]);
    return { ok: true };
  };

  /* items: [{foodId, grams}] كميات اليوم الكاملة. تُقسَّم على الوجبات بنفس نسبها. */
  NF.mealPlan = function (items, pcts, weightKg) {
    return pcts.map(function (pct, i) {
      const lines = [];
      const m = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
      items.forEach(function (it) {
        const food = NF.getFood(it.foodId);
        if (!food) return;
        const grams = (it.grams * pct) / 100;
        const mm = NF.foodMacros(food, grams);
        Object.keys(m).forEach(function (k) { m[k] += mm[k]; });
        lines.push({ foodId: it.foodId, grams });
      });
      const warnings = [];
      const perKg = m.p / weightKg;
      if (m.p > 0 && (perKg < NF.MEAL_PROTEIN_PER_KG[0] || perKg > NF.MEAL_PROTEIN_PER_KG[1]))
        warnings.push(w('MEAL_PROTEIN', 'بروتين هذه الوجبة خارج المدى المقترح (0.25-0.40 غ/كغ).'));
      return { index: i, pct, items: lines, macros: m, warnings };
    });
  };

  /* ---------- المطبخ: المطبوخ ↔ النيء (المعامل يأتي من مصدر موثق فقط) ---------- */
  NF.kitchenQuantities = function (o) {
    if (!(o.yieldFactor > 0)) return fail([e('BAD_YIELD', 'yieldFactor', 'معامل الطهي مطلوب من مصدر موثق')]);
    const waste = o.wasteMarginPct || 0;
    const theoreticalRawG = o.requiredCookedG / o.yieldFactor;
    return {
      ok: true,
      requiredCookedG: o.requiredCookedG,
      theoreticalRawG,
      wasteMarginPct: waste,
      purchaseRawG: theoreticalRawG * (1 + waste / 100)
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
