/* NutriFit DZ — 04-orders.js
 * التسعير والتوصيل وسجل الطلب (Snapshot). دوال نقية.
 * المال: أعداد صحيحة بالسنتيم (1 DZD = 100 سنتيم) فلا Float للمال أبدًا.
 * عند الانتقال إلى PostgreSQL يقابلها Decimal(12,2). الأسعار الفعلية يحددها المشرف. */
(function (g) {
  'use strict';
  const NF = (g.NF = g.NF || {});

  NF.PRICING = {
    currency: 'DZD',
    unit: 'centimes',
    pricePerKgCentimes: {}, // مثال لاحقًا: { chicken: 120000 } = 1200.00 DZD/كغ. فارغ = لم يُسعَّر
    deliveryFeeCentimes: null, // null = يحدده المشرف
    cutoffHourAlgiers: 20, // تصنيف C: بعد هذه الساعة يتأجل التوصيل يومًا
    timezone: 'Africa/Algiers (UTC+1 ثابت)'
  };

  NF.itemPriceCentimes = function (foodId, grams) {
    const ppk = NF.PRICING.pricePerKgCentimes[foodId];
    if (!Number.isInteger(ppk)) return null;
    return Math.round((grams * ppk) / 1000);
  };

  NF.formatDZD = function (centimes) {
    const d = Math.floor(centimes / 100), c = centimes % 100;
    return d.toLocaleString('en-US') + '.' + String(c).padStart(2, '0') + ' DZD';
  };

  /* التوصيل غدًا؛ بعد ساعة الإغلاق (بتوقيت الجزائر) يصبح بعد غد. now كائن Date (UTC داخليًا). */
  NF.deliveryDate = function (now, cutoffHour) {
    const cutoff = cutoffHour == null ? NF.PRICING.cutoffHourAlgiers : cutoffHour;
    const alg = new Date(now.getTime() + 3600000); // Africa/Algiers = UTC+1
    const afterCutoff = alg.getUTCHours() >= cutoff;
    const d = new Date(Date.UTC(alg.getUTCFullYear(), alg.getUTCMonth(), alg.getUTCDate() + (afterCutoff ? 2 : 1)));
    return { iso: d.toISOString().slice(0, 10), afterCutoff };
  };

  /* Snapshot تاريخي: لا يتغير لو تغيّرت قيم الأغذية أو الأسعار لاحقًا. */
  NF.buildOrder = function (o) {
    const items = o.items.map(function (it) {
      const f = NF.getFood(it.foodId);
      return {
        foodId: f.id, name_ar: f.name_ar, prep: f.prep, grams: it.grams,
        per100: Object.assign({}, f.per100), allergens: (f.allergens || []).slice(), sourceId: f.sourceId,
        priceCentimes: NF.itemPriceCentimes(f.id, it.grams)
      };
    });
    const priced = items.every(function (i) { return i.priceCentimes != null; });
    const subtotal = priced ? items.reduce(function (a, i) { return a + i.priceCentimes; }, 0) : null;
    const fee = NF.PRICING.deliveryFeeCentimes;
    const dd = NF.deliveryDate(o.now);
    return {
      id: o.id,
      createdAtUtc: o.now.toISOString(),
      deliveryDate: dd.iso,
      status: o.foodsVerified ? 'PENDING' : 'DRAFT_DEV',
      payment: 'COD',
      currency: 'DZD',
      subtotalCentimes: subtotal,
      deliveryFeeCentimes: fee,
      totalCentimes: subtotal != null && fee != null ? subtotal + fee : null,
      formulaVersion: NF.VERSION.formula,
      rulesVersion: NF.VERSION.rules,
      allergies: (o.allergies || []).slice(),
      targets: o.targets,
      mealsMode: o.deliveryMode,
      pcts: o.pcts.slice(),
      items
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
