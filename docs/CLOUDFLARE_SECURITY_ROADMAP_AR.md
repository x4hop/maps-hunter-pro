# Maps Hunter Pro — Cloudflare Security Roadmap

آخر تحديث: 2026-09-19

هذه الخطة **مؤجلة للتنفيذ لاحقًا** ولا تغيّر النسخة المستقرة الحالية v1.1.0. سياسة الأجهزة المعتمدة تبقى: **كود واحد = جهاز واحد فقط**.

## الحالة المستقرة قبل بدء الخطة

- Chrome Extension تعمل محليًا لاستخراج Google Maps.
- Website email enrichment يعمل في Service Worker داخل الإضافة.
- الترخيص والتحقق والاستهلاك يعمل عبر `mapshunterpro.com` على Cloudflare Workers + D1.
- Monthly: 30 يومًا، 1500 lead في اليوم UTC.
- Lifetime: بدون انتهاء وبدون حد يومي تجاري.
- كل كود عميل مربوط بجهاز واحد فقط.

## المرحلة 1 — Atomic daily usage في D1

الهدف: جعل حد 1500 نتيجة حدًا صارمًا لا يمكن تجاوزه حتى مع 8 Workers متزامنين.

1. إضافة migration جديدة فقط؛ لا تعديل migrations التاريخية.
2. جعل D1 هي الحارس النهائي للحد بدل read → check → write في JavaScript.
3. قبل قبول `manual_usage_events` يتم التحقق داخل قاعدة البيانات من `used_today + amount <= daily_lead_limit`.
4. بعد نجاح الحدث فقط يتم تحديث `manual_usage_daily`.
5. يبقى `request_id` فريدًا لمنع إعادة احتساب نفس النتيجة.
6. تحويل خطأ قاعدة البيانات إلى `DAILY_LIMIT_REACHED` بشكل ثابت.

اختبارات القبول: 1499 + طلب واحد = 1500، أي طلب متزامن إضافي يرفض، 8 طلبات متزامنة قرب الحد لا ترفع العداد فوق 1500، وإعادة نفس request id لا تزيد العداد.

## المرحلة 2 — نقل Website Email Enrichment إلى Cloudflare Worker منفصل

المعمارية: `Chrome Extension → Licensing/API Worker → Service Binding → Email Enrichment Worker → Public business website`.

يبقى Google Maps محليًا للحفاظ على السرعة. Worker مستقل مثل `maps-hunter-pro-enrichment` يعالج Business واحدًا لكل request. الموجة السريعة تبقى homepage + `/contact` + `/contact-us`، ثم fallback محدود لـabout/team/imprint/legal وrobots/sitemap. ننقل نفس محرك استخراج البريد الحالي مع limits واضحة للوقت، حجم response، redirects، الصفحات والتزامن.

## المرحلة 3 — Short-lived licensed session

بعد Live validation يصدر API session قصير العمر 5–10 دقائق مرتبطًا بالـlicense + device + session id + expiry. كل enrichment request يحتاج session صالحًا. Revoke/Expiry/Device block يمنع الطلب التالي فورًا. لا يوضع أي signing/admin secret داخل الإضافة.

## المرحلة 4 — SSRF وabuse protection

- HTTP/HTTPS العام فقط.
- رفض loopback/private/link-local/internal hosts.
- limits للredirects، HTML size، content type والtimeout.
- rate limit حسب license/device/IP.
- audit لمحاولات INVALID_LICENSE / DEVICE_BLOCKED / REQUEST_ID_CONFLICT بدون تخزين lead data.

## المرحلة 5 — Rollout آمن

1. Atomic D1 أولًا.
2. نشر Enrichment Worker بدون تحويل العملاء إليه.
3. parity test بين local enrichment وCloudflare enrichment.
4. owner/small rollout أولًا.
5. التحويل العام بعد تطابق النتائج والأداء.
6. v1.1.0 يبقى rollback/reference stable طوال الانتقال.

## شروط النجاح

- 1500 تعني 1500 بالضبط.
- جهاز واحد فقط لكل كود.
- انتهاء Monthly حسب `expires_at` بدون grace minute.
- لا enrichment بدون ترخيص صالح.
- تعديل الإضافة محليًا لا يعطي وظيفة Website enrichment المدفوعة.
- لا تدهور ملموس في سرعة Maps extraction.
