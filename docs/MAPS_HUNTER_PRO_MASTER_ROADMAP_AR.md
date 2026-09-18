# Maps Hunter Pro — الرودماب والمرجع التقني الشامل

**آخر تحديث:** 2026-09-18  
**المستودع:** `x4hop/maps-hunter-pro`  
**فرع الإنتاج:** `main`  
**الدومين:** `https://mapshunterpro.com`  
**Worker:** `maps-hunter-pro-api`  
**الحالة التجارية الحالية:** Monthly + Lifetime، دفع يدوي، تفعيل بالكود، جهاز واحد لكل كود عميل.

> هذه الوثيقة هي مرجع التشغيل والتطوير للمشروع. عند تعارض وثيقة قديمة معها، يجب فحص الكود و`PROJECT.md` ثم تحديث الوثيقة القديمة بدل استرجاع سلوك قديم.

## 1. ما هو Maps Hunter Pro؟

Maps Hunter Pro إضافة Chrome مخصصة لبحث الأعمال المحلية من Google Maps وبناء قوائم Leads منظمة. المستخدم يحدد أنواع الأنشطة والمواقع، الأداة تجمع روابط النتائج، تفتح صفحات تفاصيل Google Maps في تبويبات خلفية محدودة التوازي، تستخرج بيانات النشاط، ثم — عندما يوجد موقع رسمي — تفحص صفحات عامة من موقع النشاط في Service Worker للعثور على بريد إلكتروني وروابط اجتماعية عامة. بعدها تحفظ النتيجة محليًا وتتيح التصدير إلى XLSX/CSV/JSON وجدول النتائج.

المنتج يتكون من خمس طبقات مترابطة:

1. **Chrome Extension**: البحث، الجمع، الاستخراج، enrichment، التخزين المحلي والتصدير.
2. **Public Website**: صفحة المنتج، الأسعار، الدفع اليدوي، اللغات، المقالات وSEO.
3. **Licensing API**: التحقق من كود التفعيل والجهاز والاستهلاك اليومي.
4. **Admin Console**: إنشاء الأكواد، تمديد/تحويل Lifetime، Reset Device، Revoke، الإعدادات والـlogs.
5. **Cloudflare/D1 + GitHub**: الاستضافة، API، قاعدة البيانات، build/deploy ومصدر الحقيقة.

## 2. مصدر الحقيقة وقاعدة التغيير

- `main` هو المصدر الوحيد المعتمد للإنتاج.
- لا يتم استرجاع صفحات Landing/Admin قديمة من D1.
- لا يتم إنشاء Worker منفصل للموقع وWorker آخر للـAPI في المعمارية الحالية.
- أي تعديل حساس يمر أولًا بفرع إصلاح، اختبارات، ثم merge إلى `main`، ثم Cloudflare deploy، ثم smoke test على الدومين الحقيقي.
- لا نعتبر نجاح commit نجاحًا للإنتاج حتى يثبت الاختبار الحي أن Cloudflare نشر نفس التغيير.

## 3. المعمارية الإنتاجية

### GitHub

- Repository: `x4hop/maps-hunter-pro`
- Production branch: `main`
- Extension source: `extension/`
- Website assets: `index.html`, `assets/`, `blog/`, `admin/`
- Backend: `backend/src/`
- D1 migrations: `backend/migrations/`
- Unified Worker: `deploy/unified-worker.js`
- Frontend build: `scripts/build-frontend-cloudflare.mjs`
- Extension release: `scripts/release-extension.mjs`

### Cloudflare

- Worker name: `maps-hunter-pro-api`
- Worker entry: `deploy/unified-worker.js`
- Static assets: `dist/frontend`
- D1 binding: `DB`
- Public origin: `https://mapshunterpro.com`
- `www.mapshunterpro.com` يجب أن يتحول 301 إلى non-www.
- `/api/*` يذهب إلى الـbackend؛ باقي المسارات تخدم الموقع/Admin/Blog من Static Assets.

## 4. رحلة العميل من أول زيارة حتى الاستخدام

1. العميل يصل إلى إحدى صفحات اللغة `/en`, `/ar`, `/ru`, `/de`, `/es`.
2. يراجع المميزات ومخرجات Excel والأسعار.
3. يختار Monthly أو Lifetime.
4. تظهر له طرق الدفع اليدوية: Binance ID أو USDT TRC20 أو RedotPay.
5. يستطيع نسخ الـID/العنوان أو فتح QR لـUSDT.
6. يرسل screenshot + transaction reference عبر WhatsApp.
7. المشرف يتحقق من الدفع يدويًا.
8. المشرف ينشئ Activation Code من `/admin/` ويرسله للعميل.
9. العميل يدخل الكود في الإضافة.
10. الإضافة تنشئ Device ID عشوائي محليًا وتطلب `/api/license/validate`.
11. أول جهاز موثوق يرتبط بالكود؛ جهاز عميل ثانٍ يرفض حتى Reset Device.
12. يبدأ العميل البحث والاستخراج، والاستهلاك اليومي يسجل فقط بعد قبول نتيجة للمعالجة.

## 5. الخطط التجارية الحالية

### Monthly

- السعر: **$20**.
- المدة: **30 يومًا** من أول تفعيل ناجح.
- الحد: **1,500 lead مقبول لكل UTC day**.
- جهاز واحد.

### Lifetime

- السعر: **$100 one-time**.
- لا انتهاء زمني تجاري.
- لا يوجد commercial daily platform limit.
- جهاز واحد.

### التوافق مع البيانات القديمة

قاعدة البيانات القديمة تقيد `plan_id` إلى `monthly|annual` و`duration_days` إلى `30|365`. لذلك Lifetime لا يكسر الصفوف القديمة: التخزين الداخلي يستخدم صف legacy-compatible مع `plan_id='annual'`, `duration_days=365` ويحدد Lifetime الحقيقي بالحقل `is_lifetime=1` وبدون `expires_at`. الأكواد السنوية القديمة تبقى 365 يومًا ولا تتحول تلقائيًا إلى Lifetime.

## 6. نظام التفعيل والترخيص

- الكود الخام لا يخزن كنص صريح في جدول التراخيص اليدوي؛ يعتمد backend على hash مع `code_hint` للعرض الإداري.
- كود غير مستخدم يتحول إلى active عند أول validation ناجح.
- Monthly يحسب `expires_at` عند التفعيل الأول.
- Lifetime يبقى بلا تاريخ انتهاء.
- `manual_license_devices` يربط الكود بجهاز واحد trusted.
- Reset Device يمسح/يعيد تهيئة binding عند الحاجة.
- Revoke يمنع الكود.
- Owner Code مسار منفصل لصاحب المشروع، ولا يجب إعطاؤه للعملاء أو Reviewer المتجر.
- `/api/usage/consume` يستخدم `requestId` لمنع العد المكرر عند retries.

## 7. واجهة الإضافة

الواجهة الحالية Side Panel وبها ثلاث مناطق رئيسية:

- **Search**: Business Types + Locations كـtags، Start/Stop/Resume وحالة المرحلة.
- **Results**: عدد النتائج، فتح جدول النتائج والتصدير.
- **Settings**: كود التفعيل وإعدادات التشغيل المسموح بها.

لا نضيف Country Code يدويًا للمستخدم. دولة البحث تستنتج من location/query والبيانات لمعالجة الهاتف طبيعيًا.

## 8. خط سير البحث والاستخراج بالتفصيل

### المرحلة A — بناء عمليات البحث

- المستخدم يضيف مجموعة `keywords` ومجموعة `cities`.
- النظام ينظف ويزيل التكرار.
- يبني Cartesian product: كل keyword × كل city في `searchTargets`.
- كل target يتحول إلى Google Maps query.

### المرحلة B — فتح Google Maps وجمع الروابط

- التحقق من الترخيص يتم قبل Start.
- التبويب النشط يوجه إلى Google Maps search للهدف الحالي.
- `content.js`/collector ينتظر تحميل Maps ثم يلتقط cards/روابط Places.
- يعمل scroll دوري حتى الاستقرار/نهاية النتائج أو حد الجولات.
- كل batch يرسل `PLACES_BATCH` إلى Service Worker.
- كل نتيجة تحمل Search Keyword/Search City حتى لا نفقد سياق مصدرها.

### المرحلة C — Queue وإزالة التكرار

- كل Place يمر عبر `normalizeLead`.
- مفتاح التكرار الأساسي `mapsUrl`، والبديل `name|address`.
- `queuedKeys` يمنع إدخال نفس المكان مرتين.
- `processedKeys` يمنع إعادة معالجة المكتمل.
- Runtime state يحفظ محليًا لكي يمكن استعادة queue بعد interruption قدر الإمكان.

### المرحلة D — استخراج تفاصيل Google Maps

- بعد انتهاء Scan أو حسب نمط التشغيل، Workers تعالج queue.
- الحد المنطقي لWorkers هو 1–8، والافتراضي 6.
- لكل نتيجة يفتح تبويب Maps detail في الخلفية `active:false`.
- ينتظر الصفحة، ثم `extractGoogleMapsPlace` يقرأ البيانات الظاهرة/المتاحة.
- إذا لم يظهر phone ولا website، تتم إعادة قراءة قصيرة واحدة لتجنب حفظ نتيجة قبل اكتمال الـrender.
- بعد الاستخراج يغلق worker tab.

### المرحلة E — Email-first website enrichment

إذا ظهر website رسمي:

1. قبل commit النهائي للـlead ينتقل status إلى `Finding email`.
2. لا يفتح الموقع كتَبويب مرئي؛ الـService Worker يستخدم `fetch` للـHTML العام.
3. Contact enrichment يعمل بتزامن مستقل محدود إلى 5 عمليات.
4. لكل موقع سقف حتى 12 صفحة تقريبًا.
5. يبدأ من الصفحة الرئيسية، ثم يكتشف روابط مثل contact/about/team/legal/imprint وغيرها.
6. يجرب decoding لبعض صيغ إخفاء البريد، ومنها Cloudflare email protection وصيغ `[at]`, `[dot]` وأشكال HTML entities.
7. يجمع email(s) وروابط social العامة المدعومة.
8. إذا لم يجد email يمكن أن يستعمل robots.txt/sitemap كfallback لاكتشاف صفحات اتصال/قانونية مخفية عن navigation.
9. فشل enrichment لا يسقط بيانات Google Maps؛ تحفظ النتيجة الأساسية.

مهم: وصف “الأداة لا تفحص مواقع الأنشطة” أصبح قديمًا وغير صحيح ويجب ألا يعود إلى Privacy/Store docs.

## 9. الحقول التي يمكن أن تحتويها النتيجة

- Name
- Phone
- Address
- Website
- Image
- Email
- Emails
- Facebook
- Instagram
- Twitter/X
- LinkedIn
- YouTube
- TikTok
- Social Links
- Category
- Rating
- Reviews
- Google Maps URL
- Hours
- Status
- Search Keyword / Search City / Search Country داخليًا وللاستخدام السياقي حيث يلزم

وجود أي حقل يعتمد على المصدر العام المتاح؛ لا نعد العميل بأن كل نشاط يملك بريدًا أو هاتفًا.

## 10. معالجة أرقام الهاتف

- لا يوجد selector يدوي لكود الدولة في الواجهة.
- `location-phone-overrides.js` يملك hints للدول وأكواد الاتصال.
- يتم استخدام دولة/مدينة البحث والعنوان عند الحاجة لتحويل الرقم إلى صيغة دولية قابلة للاستخدام.
- phone/IDs تحفظ كسلاسل نصية في التصدير حتى لا يحذف Excel `+` أو يحول الرقم لصيغة علمية.

## 11. التخزين المحلي واستعادة الجلسة

- Leads، queue، state والإعدادات التشغيلية تحفظ في `chrome.storage.local`.
- `unlimitedStorage` موجود لتقليل خطر truncation مع قوائم أكبر.
- عند استعادة service worker، يحاول النظام استعادة queue/in-flight وإغلاق orphan worker tabs ثم متابعة الحالة المنطقية.
- Clear Results يمسح بيانات النتائج المحلية المطلوبة.

## 12. نظام الاستهلاك

- قبل البحث: `/api/license/validate`.
- لكل نتيجة مقبولة: `/api/usage/consume` مع `requestId` فريد و`amount:1`.
- Monthly يرفض بعد تجاوز الحد اليومي.
- Lifetime لا يطبق الحد التجاري اليومي.
- idempotency تمنع retry من مضاعفة العد لنفس request ID.

## 13. التصدير

### Results Table
يعرض البيانات محليًا مع البحث/التصفية.

### CSV
ملف نصي منظم للاستخدام في CRM/Sheets وغيرهما.

### JSON
نسخة structured للأنظمة والعمليات البرمجية.

### XLSX
- مولد XLSX محلي bundled داخل الإضافة.
- الملف ZIP/XLSX حقيقي وليس HTML متنكّرًا كـExcel.
- أرقام الهاتف والمعرفات Strings.
- الروابط الخارجية يمكن أن تظهر كخلايا clickable مسماة.
- ترتيب الحقول يضع بيانات الاتصال الأساسية أولًا ثم التفاصيل/social حسب تصميم المنتج.

## 14. طرق الدفع

الطرق المنشورة يدويًا في Frontend:

- Binance ID
- USDT على **TRC20**
- RedotPay ID

قواعد ثابتة:

- لا نستدعي `/api/payment-methods` للحصول على بيانات الدفع.
- Admin Settings ليست مصدر بيانات الدفع.
- العميل يرسل إثبات الدفع على WhatsApp.
- لا يوجد auto-activation بمجرد screenshot.
- أزرار Copy يجب أن تجرب Clipboard API ثم fallback browser copy، وإذا تعذر النسخ يجب تحديد النص وإظهار feedback واضح بدل silent failure.

## 15. لوحة الإدارة

المسار: `/admin/`

وظائفها الحالية:

- Admin login/session.
- Dashboard summary.
- توليد Monthly أو Lifetime codes.
- عرض الحالة/التفعيل/الانتهاء/الاستخدام والجهاز.
- Extend Monthly.
- تحويل/تحديث إلى Lifetime حسب endpoint الحالي.
- Reset Device.
- Revoke.
- Owner Code rotate/revoke/copy.
- أسعار Monthly/Lifetime والحد الشهري اليومي وإصدار/رابط الإضافة ودعم العملاء.
- Audit logs.

لا نعيد حقول payment IDs إلى Admin Settings ما دام قرار المنتج الحالي أن الدفع بيانات Frontend يدوية ثابتة.

## 16. الموقع العام واللغات

المسارات الأساسية القابلة للفهرسة:

- `/en`
- `/ar`
- `/ru`
- `/de`
- `/es`

قواعد اللغة/SEO:

- `/` → 301 إلى `/en`.
- العربية `dir="rtl"`.
- تغيير اللغة ينقل إلى URL اللغة وليس مجرد query/client state.
- Build يولد HTML localized مسبقًا حتى يرى crawler النص المترجم بدون الاعتماد على JavaScript.
- كل صفحة لغة تملك canonical ذاتي + reciprocal hreflang + `x-default`.

## 17. SEO التقني

- Title/Meta Description محلية لكل لغة.
- Open Graph/Twitter metadata.
- `robots.txt` يشير إلى `sitemap.xml`.
- Sitemap يضم اللغات والصفحات القانونية والمدونة والمقالات المنشورة.
- Schema `WebSite`, `Organization`, `SoftwareApplication` حيث يناسب.
- Structured data والأسعار يجب أن تبقى مطابقة للعرض الفعلي Monthly/Lifetime.
- HSTS, nosniff, referrer policy وPermissions Policy على صفحات الموقع؛ Admin له headers أكثر تشددًا/no-store.
- أي مقال جديد يجب إضافته إلى routing + sitemap عند الحاجة، لا يكفي وجود الملف في repo.

## 18. استراتيجية المحتوى SEO 2026–2027

### Cluster A — Google Maps Lead Generation

- استخراج leads من Google Maps.
- إيجاد business emails.
- تصدير إلى Excel.
- قوائم B2B حسب city/category.
- تنظيف وتأهيل leads.

### Cluster B — Agencies

- SEO agencies.
- Web designers يبحثون عن businesses without websites.
- PPC agencies.
- Social media agencies.
- Local SEO audits/prospecting.

### Cluster C — Vertical B2B/SaaS

- dental clinics.
- salons.
- gyms.
- restaurants.
- payment/telecom/logistics prospects.

### Comparison content

المقارنات يجب أن تكون موثقة بتاريخ فحص أسعار المنافس، تشرح نقاط القوة للطرفين ولا تستعمل ادعاءات سرعة/دقة غير مقاسة. صفحات PhantomBuster EN/AR موجودة ضمن برنامج المقارنات، والخطة تشمل Outscraper/Bright Data/Apify/ScrapeHero ومحور comparison hub.

## 19. قواعد محتوى Google/People-first

- لا doorway pages رفيعة حسب المدن.
- لا mass-spun translations.
- لا fake statistics أو testimonials.
- لا ادعاء “الأسرع/الأدق” بدون benchmark قابل للتكرار.
- المقال يحل مهمة حقيقية ويملك CTA طبيعيًا لا spam.
- internal links بين المقالات والصفحة التجارية.
- الصور تستخدم فقط إذا تضيف شرح/تحويل، مع filename/alt مناسب.

## 20. Chrome Web Store والخصوصية

وصف المتجر/Privacy يجب أن يطابق السلوك الحقيقي:

- بيانات business results تبقى محلية.
- extension تعالج public website HTML المرتبط بنتائج Maps للعثور على بيانات اتصال عامة.
- لا ترسل lead dataset إلى licensing API.
- ترسل activation/device/request usage fields المطلوبة فقط.
- لا remote executable JS/WASM.
- broad HTTP/HTTPS host permissions لها سبب enrichment، ولذلك يجب شرحها بوضوح للمراجع.
- Reviewer يحصل على Customer Review Code، وليس Admin credentials أو Owner Code.
- لا ندعي اعتماد Google أو ضمان قبول المتجر.

## 21. قاعدة البيانات والمهاجرات

- المهاجرات additive وتطبق بالترتيب الرقمي.
- لا نعدل migration قديم سبق نشره.
- لا نشغل `schema.sql` على production؛ هو reference/fixture تاريخي.
- `0009_manual_only.sql` أنشأ نظام الترخيص اليدوي.
- `0010_lifetime_plan.sql` أضاف `is_lifetime` بدون كسر annual legacy rows.
- اختبار migration chain يجب أن يغطي حتى أحدث migration دائمًا.

## 22. CI/CD والاختبارات المطلوبة قبل الدمج

بوابة الإصدار يجب أن تشمل:

- `node --check` لكل JS الحساس: Frontend/Admin/Backend/Worker/Extension overrides/enrichment/export.
- payment architecture tests.
- frontend payment copy fallback regression.
- Lifetime/currency regression.
- one-device policy.
- migration chain حتى 0010+.
- manifest/reference/remote-code checks.
- XLSX generation check.
- build localized frontend.
- تحقق من EN/AR/RU/DE/ES وRTL.
- Wrangler dry-run.
- extension release package + SHA256 + content list.

## 23. Production Smoke Test بعد كل Deploy

لا نعتبر النشر مكتملًا إلا بعد اختبار الدومين الفعلي:

1. `/` redirect.
2. `/en`, `/ar`, `/ru`, `/de`, `/es` وتحويل اللغة.
3. Desktop + mobile layout.
4. Monthly $20 وLifetime $100 one-time.
5. Binance/USDT/RedotPay values.
6. Copy ID/Copy Address على طرق الدفع.
7. USDT QR open/close/copy.
8. WhatsApp CTA والـselected plan message.
9. `/admin/` تحميل/login/API basics دون كشف secrets.
10. `/api/health`, `/api/plans`.
11. `robots.txt`, `sitemap.xml`, canonical/hreflang.
12. مقالات blog الأساسية.
13. لا console errors حرجة.
14. بعد release الإضافة: activation + one-device + Maps scan + extraction + website enrichment + Results + XLSX/CSV/JSON.

## 24. حادثة 2026-09-18 وما تعلمناه

### ما حدث

بعد تغييرات السعر/المحتوى ظهرت inconsistencies بين Main واللغات والوثائق، وأزرار نسخ بيانات الدفع في Production توقفت فعليًا في سيناريو يكون فيه Clipboard API موجودًا لكنه يرفض `writeText`.

### السبب التقني لزر النسخ

الكود القديم كان يرجع مباشرة من `navigator.clipboard.writeText(value)` ولا يشغل fallback إذا Promise رفض. لذلك بعض المتصفحات/السياقات تظهر زرًا قابلًا للضغط لكن لا تتغير الحافظة ولا يحصل المستخدم على feedback.

### الإصلاح

- Clipboard API أولًا.
- عند الرفض: `document.execCommand('copy')` fallback.
- إذا فشل fallback أيضًا: تحديد النص وإظهار رسالة manual-copy.
- نفس الحماية لأكواد Admin/Owner.
- إضافة regression test يمنع عودة silent failure.

### خطأ إضافي تم التقاطه قبل الدمج

أثناء إصلاح copy، إزالة غير مقصودة لعلامة `$` من dynamic price formatting تم اكتشافها قبل دمج الفرع. أضيفت regression assertions للأسعار وWhatsApp message لمنع عودتها.

## 25. سجل المراحل المنجزة المعروفة من المستودع

هذه القائمة مبنية على commits والملفات المتاحة حاليًا وليست ادعاءً بتاريخ غير موجود:

- بناء Extension لاستخراج Google Maps ونتائج محلية قابلة للتصدير.
- إضافة XLSX/CSV/JSON وResults table.
- تنسيق الهاتف دوليًا حسب سياق البحث.
- انتقال إلى manual activation codes وجهاز واحد.
- إنشاء Admin dashboard وOwner access.
- توحيد Cloudflare Worker + Static Assets + D1.
- ربط domain ومسارات اللغات الخمس.
- تحسين multilingual homepage SEO دون redesign جذري.
- إضافة Email-first/background website contact enrichment.
- إضافة مدونة SEO وأول pillar article.
- إضافة مقال businesses without websites.
- إضافة برنامج comparison content ومقال PhantomBuster EN/AR.
- تحويل العرض التجاري الجديد من Annual إلى Lifetime مع compatibility للبيانات القديمة.
- إضافة custom SVG icon system للموقع.
- إصلاح payment copy/Lifetime source consistency في فرع إصلاح مخصص قبل الدمج.

## 26. الأولويات القادمة

### P0 — قبل أي تطوير جديد

- نجاح كل regression tests على فرع الإصلاح.
- تأكيد عدم فقد `$` أو ترجمة أو قيمة دفع.
- تحديث docs/privacy/store manifest test لتطابق website enrichment وLifetime.
- Merge الإصلاح إلى `main` فقط بعد نجاح البوابة.
- انتظار Cloudflare deploy ثم إعادة اختبار Production فعليًا، خصوصًا Copy.

### P1 — ثبات المنتج

- إضافة smoke automation للصفحات العامة وطرق الدفع.
- اختبار E2E دوري للإضافة على Google Maps مع fixture/manual release checklist.
- مراقبة changes في DOM Google Maps لأن selectors عرضة للتغير.
- إضافة قياسات structured للأخطاء ومعدل email-found بدون إرسال lead data.
- تقييم تقليل host permissions إن أمكن مستقبلًا دون قتل enrichment.

### P1 — SEO والنمو

- توسيع المقالات من roadmap حسب clusters بدل نشر عشوائي.
- ترجمة/تعريب المقالات المهمة فقط بجودة فعلية.
- Search Console monitoring حسب اللغة والبلد/query.
- تحديث صفحات comparison عند تغير أسعار المنافسين.
- تقوية internal linking وCTA من المقالات إلى pricing.

### P2 — تحسينات مستقبلية

- QR محلي بدل dependency خارجية إن أمكن.
- تشديد CSP بإزالة inline scripts تدريجيًا.
- `/.well-known/security.txt`.
- تحسين observability للWorker/D1 وdeployment version visibility في Admin.
- إنشاء release dashboard يعرض commit SHA + Worker version + Extension version لتقليل drift.

## 27. Definition of Done لأي تغيير قادم

أي مهمة تعتبر “منتهية” فقط عندما:

1. الكود موجود في branch الصحيح.
2. الاختبارات الجديدة/القديمة تنجح.
3. لا regressions في الدفع والترخيص واللغات.
4. docs تتغير إذا تغير السلوك.
5. تم merge إلى `main` بقصد واضح.
6. Cloudflare نشر commit المطلوب.
7. Production smoke test نجح على الدومين الحقيقي.
8. إذا التغيير يخص Extension: release package واختبارات Manifest/XLSX/activation ناجحة.
9. إذا التغيير يخص SEO: routing/sitemap/canonical/hreflang/schema متسقة.
10. يسجل commit/سبب التغيير بحيث يمكن rollback وفهم ما حدث لاحقًا.

## 28. قاعدة منع تكرار التخريب

لا تعدل Frontend/Payment/Licensing/Extension/SEO كجزر منفصلة. قبل أي merge اسأل: ما الملفات التي تمثل نفس الحقيقة؟ مثال تغيير Annual→Lifetime يمس الصفحة، translations، API plans، Admin، migration compatibility، Terms، README/PROJECT، tests وstructured data. أي تغيير في سلوك enrichment يمس Manifest permissions وPrivacy وDATA_FLOW وChrome Web Store brief. الاختبارات يجب أن تحرس هذه العلاقات، وليس مجرد syntax.
