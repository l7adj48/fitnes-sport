/* NutriFit DZ — 01-config.js
 * الثوابت والمراجع والتصنيف الرباعي (F/R/O/C). لا منطق هنا.
 * سكربت عادي (ليس ES module) ليعمل بفتح index.html مباشرة. */
(function (g) {
  'use strict';
  const NF = (g.NF = g.NF || {});

  NF.VERSION = { formula: 'nf-1.0.0', rules: '2026-11-17' };

  NF.CLASS = {
    F: { code: 'F', ar: 'معادلة منشورة' },
    R: { code: 'R', ar: 'نطاق موصى به' },
    O: { code: 'O', ar: 'قيمة تشغيلية' },
    C: { code: 'C', ar: 'معايرة / افتراض المنصة' }
  };

  /* كل مرجع يظهر في الواجهة. TODO_VERIFY = لم يُتحقق منه بعد، لا يُعامل كمصدر مؤكد. */
  NF.SOURCES = {
    MSJ1990: {
      short: 'Mifflin-St Jeor (1990)',
      ref: 'Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.'
    },
    KATCH: { short: 'Katch-McArdle', ref: 'TODO_VERIFY' },
    FAO2004: {
      short: 'FAO/WHO/UNU (2004)',
      ref: 'FAO/WHO/UNU. Human energy requirements: Report of a Joint FAO/WHO/UNU Expert Consultation. FAO Food and Nutrition Technical Report Series 1. Rome: FAO; 2004.'
    },
    ISSN2017: {
      short: 'ISSN (2017)',
      ref: 'Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.'
    },
    IOM2005: {
      short: 'IOM DRI (2005)',
      ref: 'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. Washington, DC: National Academies Press; 2005.'
    },
    ACSM2016: {
      short: 'ACSM (2016)',
      ref: 'Thomas DT, Erdman KA, Burke LM. Position of the Academy of Nutrition and Dietetics, Dietitians of Canada, and the American College of Sports Medicine: Nutrition and Athletic Performance. Med Sci Sports Exerc. 2016;48(3):543-568.'
    },
    WHO2023: {
      short: 'WHO (2023)',
      ref: 'WHO. Carbohydrate intake for adults and children: WHO guideline. Geneva: World Health Organization; 2023.'
    },
    ATWATER: { short: 'Atwater 4/4/9', ref: 'TODO_VERIFY' },
    PLATFORM: { short: 'قرار المنصة', ref: 'افتراض داخلي قابل للمعايرة' }
  };

  NF.LIMITS = { age: [18, 100], weightKg: [30, 300], heightCm: [120, 230] };

  NF.LBM_METHODS = ['DEXA', 'BODPOD', 'HYDROSTATIC', 'INBODY', 'TANITA'];
  NF.LBM_MIN_RELIABILITY = 70; // تصنيف C

  NF.PCT_LIMIT = [-25, 25]; // فائض/عجز مسموح (O)
  NF.DEEP_DEFICIT_PCT = -20; // أقل منه يحتاج تأكيدًا صريحًا (C)
  NF.KCAL_PER_KG_BODY_CHANGE = 7700; // تقدير تقريبي لتحذير معدل الخسارة فقط (C) TODO_VERIFY
  NF.MAX_WEEKLY_LOSS_PCT = 1; // % من وزن الجسم أسبوعيًا (C)

  NF.PROTEIN_WARN_PER_KG = 3.1;
  NF.FAT_RANGE_PCT = [20, 35]; // AMDR (R)
  NF.FAT_DEFAULT_PCT = 25; // (O)
  NF.CARB_WARN_PER_KG = [3, 12]; // ACSM (R) تحذير فقط
  NF.FIBER_MIN_G = 25; // WHO (R)
  NF.MEAL_PROTEIN_PER_KG = [0.25, 0.4]; // ISSN (R)
  NF.SUPP_CAP_PCT = 50; // قرار المنصة (C)
  NF.ENERGY_DELTA_MAX_PCT = 10;

  /* أربعة مستويات نشاط، كل PAL الافتراضي داخل نطاق FAO المقابل.
   * النطاق = R، والقيمة المختارة داخله = O. */
  NF.ACTIVITY = {
    LIGHT: { ar: 'خفيف', desc: 'عمل مكتبي + تدريب 1-2 يوم', range: [1.4, 1.69], pal: 1.55 },
    MODERATE: { ar: 'متوسط', desc: 'عمل مكتبي + تدريب 3-4 أيام', range: [1.7, 1.99], pal: 1.75 },
    HIGH: { ar: 'عالٍ', desc: 'عمل حركي + تدريب 5-6 أيام', range: [1.7, 1.99], pal: 1.9 },
    VIGOROUS: { ar: 'شديد', desc: 'عمل شاق + تدريب يوميًا', range: [2.0, 2.4], pal: 2.2 }
  };

  /* pct = فائض/عجز (O). protein = غ/كغ (O) داخل نطاق ISSN (R). */
  NF.GOALS = {
    BUILD: { ar: 'بناء عضل', pct: 10, protein: 1.8, proteinRange: [1.6, 2.0] },
    CUT: { ar: 'خسارة دهون', pct: -20, protein: 2.0, proteinRange: [1.4, 2.0] },
    RECOMP: { ar: 'إعادة تشكيل', pct: -10, protein: 2.0, proteinRange: [1.4, 2.0] },
    PERFORM: { ar: 'أداء رياضي', pct: 0, protein: 1.6, proteinRange: [1.4, 2.0] }
  };

  NF.ALLERGENS = {
    GLUTEN: 'الغلوتين',
    CRUSTACEANS: 'القشريات',
    EGG: 'البيض',
    FISH: 'السمك',
    PEANUTS: 'الفول السوداني',
    SOY: 'الصويا',
    MILK: 'الحليب',
    TREE_NUTS: 'المكسرات',
    CELERY: 'الكرفس',
    MUSTARD: 'الخردل',
    SESAME: 'السمسم',
    SULPHITES: 'الكبريتيت',
    LUPIN: 'الترمس',
    MOLLUSCS: 'الرخويات'
  };

  NF.CATEGORIES = {
    ANIMAL: { ar: 'بروتين حيواني', key: 'p' },
    PLANT: { ar: 'بروتين نباتي', key: 'p' },
    CARB: { ar: 'كارب', key: 'c' },
    FAT: { ar: 'دهون', key: 'f' }
  };

  NF.MACRO_AR = { p: 'بروتين', c: 'كارب', f: 'دهون' };

  NF.DISCLAIMER = 'هذه أداة تغذية رياضية، وليست بديلًا عن الاستشارة الطبية.';
})(typeof window !== 'undefined' ? window : globalThis);
