/* NutriFit DZ — 06-app.js
 * الإجراءات (act) والتنقل والتحقق وربط الأحداث. منطق الإجراءات لا يلمس DOM فيُختبر في Node. */
(function (g) {
  'use strict';
  const NF = g.NF;
  const UI = NF.ui;
  const App = (NF.app = {});

  /* ---------- تحقق الانتقال لكل خطوة ---------- */
  function validateStep() {
    const S = UI.state;
    if (S.step === 1) {
      const v = NF.validateProfile({ sex: S.sex, age: UI.num(S.age), heightCm: UI.num(S.heightCm), weightKg: UI.num(S.weightKg) });
      const errors = v.errors.slice();
      if (!S.consent) errors.push({ message: 'يلزم الإقرار أنك بالغ وتفهم أن الأداة ليست بديلًا عن الاستشارة الطبية' });
      return errors;
    }
    if (S.step === 3 || S.step === 4) {
      const C = UI.compute();
      return C.ok ? [] : C.errors;
    }
    if (S.step === 5) {
      return Object.keys(S.sel).length ? [] : [{ message: 'اختر طعامًا واحدًا على الأقل' }];
    }
    if (S.step === 6) {
      const pcts = S.pcts && S.pcts.length === S.mealCount ? S.pcts : NF.equalPcts(S.mealCount);
      const v = NF.validatePcts(pcts);
      return v.ok ? [] : v.errors;
    }
    return [];
  }

  function confirmOrder() {
    const S = UI.state;
    const C = UI.compute();
    if (!C.ok) return;
    const pcts = S.pcts && S.pcts.length === S.mealCount ? S.pcts : NF.equalPcts(S.mealCount);
    const order = NF.buildOrder({
      id: 'NF-' + Date.now().toString(36).toUpperCase(),
      now: new Date(),
      items: Object.keys(S.sel).map((id) => ({ foodId: id, grams: S.sel[id] })),
      allergies: S.allergies,
      targets: { kcal: C.tk.value, p: C.m.proteinG, c: C.m.carbsG, f: C.m.fatG, suppCountedG: C.supp.countedG },
      deliveryMode: S.delivery,
      pcts,
      foodsVerified: NF.FOOD_DATA.verified
    });
    try {
      const list = JSON.parse((g.localStorage && g.localStorage.getItem('nf.orders')) || '[]');
      list.push(order);
      g.localStorage && g.localStorage.setItem('nf.orders', JSON.stringify(list));
    } catch (err) { /* التخزين غير متاح: الطلب يبقى في الذاكرة فقط */ }
    S.done = order;
  }

  /* act: اسم الإجراء، v: القيمة. يرجع true إن لزم إعادة الرسم. */
  App.act = function (act, v) {
    const S = UI.state;
    S.errors = [];
    switch (act) {
      case 'sex': S.sex = v; break;
      case 'allergy': {
        const i = S.allergies.indexOf(v);
        if (i === -1) S.allergies.push(v); else S.allergies.splice(i, 1);
        /* حجب الحساسية لا يُتجاوز: أزل أي طعام مختار صار محجوبًا */
        Object.keys(S.sel).forEach(function (id) { if (NF.blockedBy(NF.getFood(id), S.allergies).length) delete S.sel[id]; });
        break;
      }
      case 'activity': S.activity = v; break;
      case 'goal': S.goal = v; S.adjPct = null; S.proteinPerKg = null; break;
      case 'count': S.mealCount = Number(v); S.pcts = null; break;
      case 'delivery': S.delivery = v; break;
      case 'goto': S.step = Number(v); break;
      case 'back': if (S.step > 1) S.step--; break;
      case 'next': {
        const errs = validateStep();
        if (errs.length) { S.errors = errs; break; }
        if (S.step < 7) S.step++;
        break;
      }
      case 'openFood': {
        const f = NF.getFood(v);
        if (!f || NF.blockedBy(f, S.allergies).length) break;
        S.editing = v;
        S.gramsTmp = S.sel[v] != null ? String(S.sel[v]) : '';
        break;
      }
      case 'closeSheet': S.editing = null; break;
      case 'suggest': {
        const C = UI.compute();
        if (C.ok && S.editing) S.gramsTmp = String(UI.suggest(C, NF.getFood(S.editing)));
        break;
      }
      case 'saveFood': {
        const gr = UI.num(S.gramsTmp);
        if (gr > 0 && isFinite(gr)) S.sel[S.editing] = gr; else delete S.sel[S.editing];
        S.editing = null;
        break;
      }
      case 'removeFood': delete S.sel[S.editing]; S.editing = null; break;
      case 'confirm': confirmOrder(); break;
      case 'reset': UI.reset(); break;
      default: return false;
    }
    UI.save();
    return true;
  };

  /* حقل نصي/اختيار: v قيمة الحقل. يرجع true إن لزم إعادة الرسم الكامل (data-r). */
  App.setField = function (key, value, index) {
    const S = UI.state;
    if (key === 'consent' || key === 'suppUses') S[key] = !!value;
    else if (key === 'grams') S.gramsTmp = value;
    else if (key === 'pct') {
      const base = S.pcts && S.pcts.length === S.mealCount ? S.pcts.slice() : NF.equalPcts(S.mealCount);
      base[Number(index)] = UI.num(value);
      S.pcts = base;
    } else S[key] = value;
    UI.save();
  };

  /* ---------- ربط DOM ---------- */
  App.init = function () {
    const root = document.getElementById('app');
    UI.load();
    function render() {
      root.innerHTML = UI.html();
      if (UI.state.editing) { const el = document.getElementById('grams'); if (el) el.focus(); }
      window.scrollTo(0, 0);
    }
    function rerenderKeepScroll() {
      const y = window.scrollY; root.innerHTML = UI.html(); window.scrollTo(0, y);
    }
    root.addEventListener('click', function (ev) {
      const el = ev.target.closest('[data-act]');
      if (!el) return;
      const act = el.getAttribute('data-act');
      const keep = act === 'openFood' || act === 'closeSheet' || act === 'saveFood' || act === 'removeFood' || act === 'suggest' || act === 'allergy' || act === 'sex' || act === 'count' || act === 'delivery';
      if (App.act(act, el.getAttribute('data-v'))) { if (keep) { rerenderKeepScroll(); if (UI.state.editing) { const g2 = document.getElementById('grams'); if (g2) g2.focus(); } } else render(); }
    });
    root.addEventListener('input', function (ev) {
      const el = ev.target;
      const key = el.getAttribute && el.getAttribute('data-f');
      if (!key || el.type === 'checkbox') return;
      App.setField(key, el.value, el.getAttribute('data-i'));
      if (key === 'grams') {
        const f = NF.getFood(UI.state.editing);
        const pv = document.getElementById('preview');
        if (pv && f) pv.textContent = UI.previewHtml(f, UI.num(el.value)).replace(/<[^>]*>/g, '');
      }
    });
    root.addEventListener('change', function (ev) {
      const el = ev.target;
      const key = el.getAttribute && el.getAttribute('data-f');
      if (!key) return;
      App.setField(key, el.type === 'checkbox' ? el.checked : el.value, el.getAttribute('data-i'));
      if (el.getAttribute('data-r')) rerenderKeepScroll();
    });
    render();
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.init);
    else App.init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
