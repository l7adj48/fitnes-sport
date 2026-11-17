/* NutriFit DZ — 03-foods.js
 * ⚠️ بيانات تجريبية للتطوير فقط. القيم الغذائية والحساسيات هنا ليست من مصدر موثق.
 * بحسب قواعد المشروع لا تُكتب قيمة غذائية من الذاكرة في الإنتاج:
 *  - استبدل كل سجل بقيم من USDA FoodData Central أو Ciqual أو الملصق الرسمي.
 *  - ضع sourceId + sourceRecordId الحقيقيين، ثم غيّر FOOD_DATA.verified إلى true
 *    فقط بعد مراجعة كل السجلات والحساسيات.
 * لا يوجد جدول تركيب غذائي جزائري رسمي؛ المصدر الدولي الأقرب هو المعتمد ويُذكر ذلك. */
(function (g) {
  'use strict';
  const NF = (g.NF = g.NF || {});

  NF.FOOD_DATA = {
    verified: false,
    note: 'قيم تجريبية غير موثقة. لا تُستخدم لطلب حقيقي قبل اعتماد المصدر لكل سجل.'
  };

  const SRC = 'TODO_VERIFY';

  /* per100 = لكل 100 غ كما يؤكل (prep). allergens إلزامي (قد يكون فارغًا). */
  NF.FOODS = [
    { id: 'chicken', cat: 'ANIMAL', name_ar: 'صدر دجاج', name_fr: 'Blanc de poulet', name_en: 'Chicken breast', prep: 'COOKED', per100: { kcal: 165, p: 31, c: 0, f: 3.6, fiber: 0 }, allergens: [], sourceId: SRC },
    { id: 'salmon', cat: 'ANIMAL', name_ar: 'سلمون', name_fr: 'Saumon', name_en: 'Salmon', prep: 'COOKED', per100: { kcal: 206, p: 22, c: 0, f: 12, fiber: 0 }, allergens: ['FISH'], sourceId: SRC },
    { id: 'beef', cat: 'ANIMAL', name_ar: 'لحم بقري قليل الدهن', name_fr: 'Bœuf maigre', name_en: 'Lean beef', prep: 'COOKED', per100: { kcal: 250, p: 26, c: 0, f: 15, fiber: 0 }, allergens: [], sourceId: SRC },
    { id: 'egg', cat: 'ANIMAL', name_ar: 'بيض مسلوق', name_fr: 'Œuf dur', name_en: 'Boiled egg', prep: 'BOILED', per100: { kcal: 155, p: 12.6, c: 1.1, f: 10.6, fiber: 0 }, allergens: ['EGG'], sourceId: SRC },
    { id: 'tuna', cat: 'ANIMAL', name_ar: 'تونة بالماء', name_fr: 'Thon au naturel', name_en: 'Tuna in water', prep: 'CANNED', per100: { kcal: 116, p: 25.5, c: 0, f: 0.8, fiber: 0 }, allergens: ['FISH'], sourceId: SRC },
    { id: 'cheese', cat: 'ANIMAL', name_ar: 'جبن موتزاريلا', name_fr: 'Mozzarella', name_en: 'Mozzarella', prep: 'RAW', per100: { kcal: 254, p: 24, c: 2.8, f: 16, fiber: 0 }, allergens: ['MILK'], sourceId: SRC },

    { id: 'lentils', cat: 'PLANT', name_ar: 'عدس مطبوخ', name_fr: 'Lentilles cuites', name_en: 'Cooked lentils', prep: 'COOKED', per100: { kcal: 116, p: 9, c: 20.1, f: 0.4, fiber: 7.9 }, allergens: [], sourceId: SRC },
    { id: 'chickpeas', cat: 'PLANT', name_ar: 'حمص مطبوخ', name_fr: 'Pois chiches cuits', name_en: 'Cooked chickpeas', prep: 'COOKED', per100: { kcal: 164, p: 8.9, c: 27.4, f: 2.6, fiber: 7.6 }, allergens: [], sourceId: SRC },
    { id: 'tofu', cat: 'PLANT', name_ar: 'توفو', name_fr: 'Tofu', name_en: 'Firm tofu', prep: 'RAW', per100: { kcal: 144, p: 17, c: 2.8, f: 8.7, fiber: 2.3 }, allergens: ['SOY'], sourceId: SRC, energyNote: 'الفرق عن 4/4/9 يتجاوز 10%؛ يحتاج عوامل أتووتر خاصة بالغذاء أو سجلًّا موثقًا' },
    { id: 'beans', cat: 'PLANT', name_ar: 'فاصوليا مطبوخة', name_fr: 'Haricots cuits', name_en: 'Cooked beans', prep: 'COOKED', per100: { kcal: 127, p: 8.7, c: 22.8, f: 0.5, fiber: 6.4 }, allergens: [], sourceId: SRC },

    { id: 'rice', cat: 'CARB', name_ar: 'أرز أبيض مطبوخ', name_fr: 'Riz blanc cuit', name_en: 'Cooked white rice', prep: 'COOKED', per100: { kcal: 130, p: 2.7, c: 28.2, f: 0.3, fiber: 0.4 }, allergens: [], sourceId: SRC },
    { id: 'oats', cat: 'CARB', name_ar: 'شوفان', name_fr: 'Flocons d\u2019avoine', name_en: 'Oats', prep: 'DRY', per100: { kcal: 389, p: 16.9, c: 66.3, f: 6.9, fiber: 10.6 }, allergens: ['GLUTEN'], sourceId: SRC },
    { id: 'potato', cat: 'CARB', name_ar: 'بطاطا مسلوقة', name_fr: 'Pomme de terre bouillie', name_en: 'Boiled potato', prep: 'BOILED', per100: { kcal: 87, p: 1.9, c: 20.1, f: 0.1, fiber: 1.8 }, allergens: [], sourceId: SRC },
    { id: 'pasta', cat: 'CARB', name_ar: 'معكرونة مطبوخة', name_fr: 'Pâtes cuites', name_en: 'Cooked pasta', prep: 'COOKED', per100: { kcal: 158, p: 5.8, c: 30.9, f: 0.9, fiber: 1.8 }, allergens: ['GLUTEN'], sourceId: SRC },
    { id: 'quinoa', cat: 'CARB', name_ar: 'كينوا مطبوخة', name_fr: 'Quinoa cuit', name_en: 'Cooked quinoa', prep: 'COOKED', per100: { kcal: 120, p: 4.4, c: 21.3, f: 1.9, fiber: 2.8 }, allergens: [], sourceId: SRC },
    { id: 'bread', cat: 'CARB', name_ar: 'خبز كامل', name_fr: 'Pain complet', name_en: 'Whole-wheat bread', prep: 'RAW', per100: { kcal: 247, p: 13, c: 41, f: 3.4, fiber: 7 }, allergens: ['GLUTEN'], sourceId: SRC },

    { id: 'avocado', cat: 'FAT', name_ar: 'أفوكادو', name_fr: 'Avocat', name_en: 'Avocado', prep: 'RAW', per100: { kcal: 160, p: 2, c: 8.5, f: 14.7, fiber: 6.7 }, allergens: [], sourceId: SRC },
    { id: 'olive_oil', cat: 'FAT', name_ar: 'زيت زيتون', name_fr: 'Huile d\u2019olive', name_en: 'Olive oil', prep: 'RAW', per100: { kcal: 884, p: 0, c: 0, f: 100, fiber: 0 }, allergens: [], sourceId: SRC },
    { id: 'almonds', cat: 'FAT', name_ar: 'لوز', name_fr: 'Amandes', name_en: 'Almonds', prep: 'RAW', per100: { kcal: 579, p: 21.2, c: 21.6, f: 49.9, fiber: 12.5 }, allergens: ['TREE_NUTS'], sourceId: SRC },
    { id: 'walnuts', cat: 'FAT', name_ar: 'جوز', name_fr: 'Noix', name_en: 'Walnuts', prep: 'RAW', per100: { kcal: 654, p: 15.2, c: 13.7, f: 65.2, fiber: 6.7 }, allergens: ['TREE_NUTS'], sourceId: SRC },
    { id: 'peanut_butter', cat: 'FAT', name_ar: 'زبدة فول سوداني', name_fr: 'Beurre de cacahuète', name_en: 'Peanut butter', prep: 'RAW', per100: { kcal: 588, p: 25, c: 20, f: 50, fiber: 6 }, allergens: ['PEANUTS'], sourceId: SRC },
    { id: 'chia', cat: 'FAT', name_ar: 'بذور شيا', name_fr: 'Graines de chia', name_en: 'Chia seeds', prep: 'DRY', per100: { kcal: 486, p: 16.5, c: 42.1, f: 30.7, fiber: 34.4 }, allergens: [], sourceId: SRC }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
