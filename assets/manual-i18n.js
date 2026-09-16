(()=>{
const U={
  en:{
    nav_how:'How it works',
    payment_methods:'Payment & Activation',
    payment_desc:'Pay by Binance ID, USDT, or RedotPay. Send proof on WhatsApp and receive your activation code after verification.',
    manual_activation:'Code Activation',
    manual_activation_desc:'No customer account. Activate with the code you receive after payment verification.',
    how_title:'Pay. Verify. Activate.',
    how_desc:'Choose a plan, pay manually, send proof on WhatsApp, and activate with one code.',
    how_1:'1. Choose a plan',how_1_desc:'Choose Monthly or Annual.',
    how_2:'2. Pay',how_2_desc:'Use Binance ID, USDT, or RedotPay.',
    how_3:'3. Confirm',how_3_desc:'Send the payment proof on WhatsApp.',
    how_4:'4. Activate',how_4_desc:'Enter the activation code in the extension.',
    selected_plan:'Selected plan: choose Monthly or Annual',
    manual_step_1:'Complete the payment.',manual_step_2:'Take a screenshot of the completed payment.',manual_step_3:'Send the screenshot and transaction reference on WhatsApp.',manual_step_4:'Receive your activation code after verification.',
    send_whatsapp:'Send payment proof on WhatsApp',
    hero_desc:'Find businesses on Google Maps, organize the results, format phone numbers internationally, and export to Excel, CSV, JSON, or a results table.',
    features_title:'Everything you need to collect leads',features_desc:'Fast extraction, clean data, and ready-to-use exports.',
    professional_excel_desc:'Clean files for filtering, outreach, and team workflows.',
    unlimited_annual:'Annual without a daily platform limit',unlimited_annual_desc:'Built for agencies and higher daily volumes.',
    monthly_limit:'Up to 1,500 per day',monthly_limit_desc:'The monthly plan includes up to 1,500 leads per day.',
    pricing_title:'Pricing',pricing_desc:'Choose monthly access or save with the annual plan.',
    monthly_plan:'Monthly',per_month:'/ month',monthly_desc:'Flexible access for regular use.',monthly_1500:'Up to 1,500 leads per day',choose_monthly:'Choose Monthly',
    best_value:'Best value',annual_plan:'Annual',per_year:'/ year',save_140:'Save $140 a year',unlimited_daily:'No commercial daily platform limit',everything_monthly:'Everything in Monthly',ideal_agencies:'Built for agencies and teams',priority_updates:'Priority product updates',choose_annual:'Choose Annual',
    faq_title:'FAQ',faq1_q:'Monthly or Annual?',faq1_a:'Monthly: $20 with up to 1,500 leads/day. Annual: $100/year with no commercial daily platform limit.',faq2_q:'International phone numbers?',faq2_a:'Yes. Numbers can be formatted for the search country.',faq3_q:'How do I get the activation code?',faq3_a:'Send your payment proof on WhatsApp. After verification, the activation code is sent to you.'
  },
  ar:{
    nav_how:'كيف تعمل',
    payment_methods:'الدفع والتفعيل',
    payment_desc:'ادفع عبر Binance ID أو USDT أو RedotPay، ثم أرسل إثبات الدفع عبر واتساب لتحصل على كود التفعيل بعد التحقق.',
    manual_activation:'التفعيل بالكود',manual_activation_desc:'لا تحتاج إلى حساب. فعّل الإضافة بالكود الذي يصلك بعد التحقق من الدفع.',
    how_title:'ادفع، أكد، ثم فعّل',how_desc:'اختر الباقة، ادفع، أرسل الإثبات عبر واتساب، ثم فعّل الإضافة بكود واحد.',
    how_1:'1. اختر الباقة',how_1_desc:'اختر الشهري أو السنوي.',
    how_2:'2. ادفع',how_2_desc:'استخدم Binance ID أو USDT أو RedotPay.',
    how_3:'3. أكد الدفع',how_3_desc:'أرسل إثبات الدفع عبر واتساب.',
    how_4:'4. فعّل',how_4_desc:'أدخل كود التفعيل داخل الإضافة.',
    selected_plan:'الباقة المختارة: اختر الشهري أو السنوي',
    manual_step_1:'أكمل الدفع.',manual_step_2:'التقط صورة لإثبات الدفع.',manual_step_3:'أرسل الصورة ومرجع المعاملة عبر واتساب.',manual_step_4:'استلم كود التفعيل بعد التحقق.',
    send_whatsapp:'إرسال إثبات الدفع عبر واتساب',
    hero_desc:'ابحث عن الأنشطة في Google Maps، نظّم النتائج، نسّق أرقام الهاتف دوليًا، وصدّر البيانات إلى Excel أو CSV أو JSON أو جدول النتائج.',
    features_title:'كل ما تحتاجه لجمع العملاء المحتملين',features_desc:'استخراج سريع، بيانات مرتبة، وتصدير جاهز للاستخدام.',
    professional_excel_desc:'ملفات مرتبة وجاهزة للفرز والتواصل والعمل الجماعي.',
    unlimited_annual:'السنوي بدون حد يومي للمنصة',unlimited_annual_desc:'مناسب للوكالات وحجم العمل اليومي الأكبر.',
    monthly_limit:'حتى 1,500 يوميًا',monthly_limit_desc:'الباقة الشهرية تشمل حتى 1,500 نتيجة يوميًا.',
    pricing_title:'الأسعار',pricing_desc:'اختر الشهري أو وفّر أكثر مع السنوي.',
    monthly_plan:'شهري',per_month:'/ شهر',monthly_desc:'مرن للاستخدام المنتظم.',monthly_1500:'حتى 1,500 نتيجة يوميًا',choose_monthly:'اختر الشهري',
    best_value:'الأوفر',annual_plan:'سنوي',per_year:'/ سنة',save_140:'وفّر $140 سنويًا',unlimited_daily:'لا يوجد حد يومي تجاري للمنصة',everything_monthly:'كل مزايا الشهري',ideal_agencies:'مناسب للوكالات والفرق',priority_updates:'أولوية في التحديثات',choose_annual:'اختر السنوي',
    faq_title:'FAQ',faq1_q:'شهري أم سنوي؟',faq1_a:'الشهري: 20$ وحتى 1,500 نتيجة يوميًا. السنوي: 100$ سنويًا بدون حد يومي تجاري للمنصة.',faq2_q:'هل الأرقام بصيغة دولية؟',faq2_a:'نعم، تُنسّق الأرقام حسب دولة البحث.',faq3_q:'كيف أستلم كود التفعيل؟',faq3_a:'أرسل إثبات الدفع عبر واتساب. بعد التحقق يصلك كود التفعيل.'
  },
  ru:{
    nav_how:'Как это работает',
    payment_methods:'Оплата и активация',
    payment_desc:'Оплатите через Binance ID, USDT или RedotPay. Отправьте подтверждение в WhatsApp и получите код после проверки.',
    manual_activation:'Активация по коду',manual_activation_desc:'Аккаунт не нужен. Введите код после проверки оплаты.',
    how_title:'Оплатите. Подтвердите. Активируйте.',how_desc:'Выберите тариф, оплатите, отправьте подтверждение в WhatsApp и активируйте расширение одним кодом.',
    how_1:'1. Выберите тариф',how_1_desc:'Месячный или годовой.',
    how_2:'2. Оплатите',how_2_desc:'Binance ID, USDT или RedotPay.',
    how_3:'3. Подтвердите',how_3_desc:'Отправьте подтверждение в WhatsApp.',
    how_4:'4. Активируйте',how_4_desc:'Введите код в расширении.',
    selected_plan:'Выбранный тариф: месячный или годовой',
    manual_step_1:'Завершите оплату.',manual_step_2:'Сделайте скриншот оплаты.',manual_step_3:'Отправьте скриншот и данные транзакции в WhatsApp.',manual_step_4:'Получите код после проверки.',
    send_whatsapp:'Отправить подтверждение в WhatsApp',
    hero_desc:'Находите компании в Google Maps, упорядочивайте результаты, форматируйте номера международно и экспортируйте данные в Excel, CSV, JSON или таблицу.',
    features_title:'Всё для быстрого сбора лидов',features_desc:'Быстрое извлечение, чистые данные и готовый экспорт.',
    professional_excel_desc:'Готовые файлы для фильтрации, контакта с клиентами и командной работы.',
    unlimited_annual:'Годовой тариф без дневного лимита платформы',unlimited_annual_desc:'Для агентств и больших ежедневных объёмов.',
    monthly_limit:'До 1 500 в день',monthly_limit_desc:'Месячный тариф включает до 1 500 лидов в день.',
    pricing_title:'Тарифы',pricing_desc:'Выберите месяц или сэкономьте с годовым тарифом.',
    monthly_plan:'На месяц',per_month:'/ месяц',monthly_desc:'Для регулярного использования.',monthly_1500:'До 1 500 лидов в день',choose_monthly:'Выбрать месяц',
    best_value:'Выгоднее',annual_plan:'На год',per_year:'/ год',save_140:'Экономия $140 в год',unlimited_daily:'Без коммерческого дневного лимита платформы',everything_monthly:'Всё из месячного тарифа',ideal_agencies:'Для агентств и команд',priority_updates:'Приоритетные обновления',choose_annual:'Выбрать год',
    faq_title:'FAQ',faq1_q:'Месяц или год?',faq1_a:'Месяц: $20 и до 1 500 лидов в день. Год: $100 без коммерческого дневного лимита платформы.',faq2_q:'Международный формат номеров?',faq2_a:'Да. Номера форматируются по стране поиска.',faq3_q:'Как получить код активации?',faq3_a:'Отправьте подтверждение оплаты в WhatsApp. После проверки вы получите код.'
  },
  de:{
    nav_how:'So funktioniert es',
    payment_methods:'Zahlung & Aktivierung',
    payment_desc:'Zahle per Binance ID, USDT oder RedotPay. Sende den Zahlungsnachweis per WhatsApp und erhalte nach Prüfung deinen Code.',
    manual_activation:'Code-Aktivierung',manual_activation_desc:'Kein Kundenkonto. Aktiviere mit dem Code nach der Zahlungsprüfung.',
    how_title:'Zahlen. Bestätigen. Aktivieren.',how_desc:'Tarif wählen, bezahlen, Nachweis per WhatsApp senden und mit einem Code aktivieren.',
    how_1:'1. Tarif wählen',how_1_desc:'Monatlich oder jährlich.',
    how_2:'2. Bezahlen',how_2_desc:'Binance ID, USDT oder RedotPay.',
    how_3:'3. Bestätigen',how_3_desc:'Zahlungsnachweis per WhatsApp senden.',
    how_4:'4. Aktivieren',how_4_desc:'Code in der Erweiterung eingeben.',
    selected_plan:'Gewählter Tarif: monatlich oder jährlich',
    manual_step_1:'Zahlung abschließen.',manual_step_2:'Screenshot der Zahlung erstellen.',manual_step_3:'Screenshot und Transaktionsreferenz per WhatsApp senden.',manual_step_4:'Nach Prüfung den Aktivierungscode erhalten.',
    send_whatsapp:'Zahlungsnachweis per WhatsApp senden',
    hero_desc:'Finde Unternehmen in Google Maps, organisiere Ergebnisse, formatiere Telefonnummern international und exportiere nach Excel, CSV, JSON oder als Ergebnistabelle.',
    features_title:'Alles für schnellere Lead-Erfassung',features_desc:'Schnelle Extraktion, saubere Daten und fertige Exporte.',
    professional_excel_desc:'Saubere Dateien für Filterung, Kontaktaufnahme und Teamarbeit.',
    unlimited_annual:'Jahresplan ohne tägliches Plattformlimit',unlimited_annual_desc:'Für Agenturen und höhere tägliche Volumen.',
    monthly_limit:'Bis zu 1.500 pro Tag',monthly_limit_desc:'Der Monatsplan enthält bis zu 1.500 Leads pro Tag.',
    pricing_title:'Preise',pricing_desc:'Monatlich starten oder mit dem Jahresplan sparen.',
    monthly_plan:'Monatlich',per_month:'/ Monat',monthly_desc:'Flexibel für regelmäßige Nutzung.',monthly_1500:'Bis zu 1.500 Leads pro Tag',choose_monthly:'Monatlich wählen',
    best_value:'Bestes Angebot',annual_plan:'Jährlich',per_year:'/ Jahr',save_140:'$140 pro Jahr sparen',unlimited_daily:'Kein kommerzielles tägliches Plattformlimit',everything_monthly:'Alles aus Monatlich',ideal_agencies:'Für Agenturen und Teams',priority_updates:'Priorisierte Updates',choose_annual:'Jährlich wählen',
    faq_title:'FAQ',faq1_q:'Monatlich oder jährlich?',faq1_a:'Monatlich: $20 und bis zu 1.500 Leads pro Tag. Jährlich: $100 ohne kommerzielles tägliches Plattformlimit.',faq2_q:'Internationale Telefonnummern?',faq2_a:'Ja. Nummern werden passend zum Suchland formatiert.',faq3_q:'Wie erhalte ich den Aktivierungscode?',faq3_a:'Sende den Zahlungsnachweis per WhatsApp. Nach der Prüfung erhältst du den Code.'
  },
  es:{
    nav_how:'Cómo funciona',
    payment_methods:'Pago y activación',
    payment_desc:'Paga con Binance ID, USDT o RedotPay. Envía el comprobante por WhatsApp y recibe tu código tras la verificación.',
    manual_activation:'Activación por código',manual_activation_desc:'No necesitas cuenta. Activa con el código recibido tras verificar el pago.',
    how_title:'Paga. Confirma. Activa.',how_desc:'Elige un plan, paga, envía el comprobante por WhatsApp y activa con un solo código.',
    how_1:'1. Elige un plan',how_1_desc:'Mensual o anual.',
    how_2:'2. Paga',how_2_desc:'Binance ID, USDT o RedotPay.',
    how_3:'3. Confirma',how_3_desc:'Envía el comprobante por WhatsApp.',
    how_4:'4. Activa',how_4_desc:'Introduce el código en la extensión.',
    selected_plan:'Plan elegido: mensual o anual',
    manual_step_1:'Completa el pago.',manual_step_2:'Haz una captura del pago.',manual_step_3:'Envía la captura y la referencia por WhatsApp.',manual_step_4:'Recibe el código tras la verificación.',
    send_whatsapp:'Enviar comprobante por WhatsApp',
    hero_desc:'Encuentra negocios en Google Maps, organiza los resultados, formatea teléfonos internacionalmente y exporta a Excel, CSV, JSON o una tabla de resultados.',
    features_title:'Todo para recopilar leads más rápido',features_desc:'Extracción rápida, datos limpios y exportaciones listas.',
    professional_excel_desc:'Archivos limpios para filtrar, contactar y trabajar en equipo.',
    unlimited_annual:'Plan anual sin límite diario de plataforma',unlimited_annual_desc:'Para agencias y mayores volúmenes diarios.',
    monthly_limit:'Hasta 1.500 al día',monthly_limit_desc:'El plan mensual incluye hasta 1.500 leads al día.',
    pricing_title:'Precios',pricing_desc:'Elige mensual o ahorra con el plan anual.',
    monthly_plan:'Mensual',per_month:'/ mes',monthly_desc:'Flexible para uso regular.',monthly_1500:'Hasta 1.500 leads al día',choose_monthly:'Elegir mensual',
    best_value:'Mejor opción',annual_plan:'Anual',per_year:'/ año',save_140:'Ahorra $140 al año',unlimited_daily:'Sin límite diario comercial de plataforma',everything_monthly:'Todo lo del plan mensual',ideal_agencies:'Para agencias y equipos',priority_updates:'Actualizaciones prioritarias',choose_annual:'Elegir anual',
    faq_title:'FAQ',faq1_q:'¿Mensual o anual?',faq1_a:'Mensual: $20 y hasta 1.500 leads al día. Anual: $100 sin límite diario comercial de plataforma.',faq2_q:'¿Teléfonos en formato internacional?',faq2_a:'Sí. Los números se formatean según el país de búsqueda.',faq3_q:'¿Cómo recibo el código de activación?',faq3_a:'Envía el comprobante por WhatsApp. Tras verificar el pago, recibirás el código.'
  }
};
for(const [lang,vals] of Object.entries(U)){
  window.MHP_LOCALES=window.MHP_LOCALES||{};
  window.MHP_LOCALES[lang]=Object.assign(window.MHP_LOCALES[lang]||{},vals);
}
if(!document.getElementById('mhp-pricing-faq-polish')){
  const style=document.createElement('style');
  style.id='mhp-pricing-faq-polish';
  style.textContent=`
  h1,h2,h3,p,summary,.btn,.buy,.list span,[data-i18n]{overflow-wrap:anywhere;word-break:normal;hyphens:auto}
  .btn,.buy{white-space:normal;line-height:1.25}
  html[lang="ar"] h1,html[lang="ar"] h2,html[lang="ar"] h3{letter-spacing:0}

  #pricing{padding:72px 0;background:var(--color-paper)}
  #pricing .section-title{margin-bottom:30px}
  #pricing .pricing{width:min(860px,100%);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:stretch}
  #pricing .price-card{display:flex;flex-direction:column;min-width:0;min-height:430px;padding:28px;background:rgba(246,244,241,.96);border:1px solid rgba(0,0,0,.12);border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.055);transform:none}
  #pricing .price-card.best{background:var(--color-paper);border:2px solid var(--color-coral);box-shadow:0 12px 32px rgba(249,92,75,.13)}
  #pricing .price-card h3{margin:0;font-size:20px;line-height:1.2}
  #pricing .badge{top:20px;right:20px;max-width:46%;padding:6px 10px;background:var(--color-coral);color:var(--color-black);border:1px solid rgba(0,0,0,.12);font-size:11px;line-height:1.15;text-align:center}
  html[dir="rtl"] #pricing .badge{right:auto;left:20px}
  #pricing .price{display:flex;align-items:flex-end;gap:7px;margin:24px 0 8px;font-size:52px;line-height:.95;letter-spacing:-.04em}
  #pricing .price small{padding-bottom:5px;font-size:14px;font-weight:700;color:rgba(0,0,0,.55);letter-spacing:0}
  #pricing .price-card>p{margin:0;color:rgba(0,0,0,.58);font-size:14px;min-height:24px}
  #pricing .save{color:var(--color-coral);text-decoration:none;font-weight:900}
  #pricing .list{display:grid;gap:11px;margin:24px 0 26px;font-size:14px}
  #pricing .list span{position:relative;padding-inline-start:23px;line-height:1.4}
  #pricing .list span:before{position:absolute;inset-inline-start:0;margin:0;color:var(--color-coral)}
  #pricing .buy{margin-top:auto;min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:12px;padding:12px 16px;background:var(--color-black);color:var(--color-paper);box-shadow:none}
  #pricing .price-card:not(.best) .buy{background:var(--color-coral);color:var(--color-black);box-shadow:none}

  #faq{padding:58px 0 66px}
  #faq .section-title{margin-bottom:18px}
  #faq .faq{width:min(760px,100%);gap:8px}
  #faq .faq details{padding:0;background:transparent;border:1px solid rgba(0,0,0,.11);border-radius:13px;box-shadow:none;overflow:hidden}
  #faq .faq details[open]{background:rgba(228,222,210,.34)}
  #faq .faq summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;font-size:15.5px;line-height:1.35;cursor:pointer}
  #faq .faq summary::-webkit-details-marker{display:none}
  #faq .faq summary:after{content:'+';width:24px;height:24px;flex:0 0 24px;display:grid;place-items:center;border-radius:50%;background:var(--color-stone);font-size:18px;line-height:1;font-weight:700}
  #faq .faq details[open] summary:after{content:'−';background:var(--color-coral)}
  #faq .faq p{margin:0;padding:0 16px 15px;font-size:14px;line-height:1.5;color:rgba(0,0,0,.62)}

  @media(max-width:760px){
    #pricing{padding:56px 0}
    #pricing .pricing{grid-template-columns:1fr;gap:13px}
    #pricing .price-card{min-height:0;padding:22px}
    #pricing .price{font-size:46px;margin-top:20px}
    #pricing .badge{top:17px;right:17px}
    html[dir="rtl"] #pricing .badge{right:auto;left:17px}
    #faq{padding:48px 0 54px}
    #faq .faq summary{padding:13px 14px;font-size:15px}
    #faq .faq p{padding:0 14px 14px}
    .language-menu{max-width:calc(100vw - 28px)}
  }
  @media(max-width:420px){
    #pricing .price-card{padding:19px}
    #pricing .price{font-size:43px}
    #pricing .badge{position:static;align-self:flex-start;max-width:100%;margin-bottom:4px}
    #faq .faq summary{font-size:14.5px}
  }`;
  document.head.appendChild(style);
}
})();
