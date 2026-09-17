// Natural-location phone normalization. No manual country-code selector is needed.
// Loaded after maps-page-overrides.js to replace normalizeLead only.
const MHP_COUNTRY_HINTS = [
  ['218',['libya','ليبيا']],['20',['egypt','مصر']],['216',['tunisia','تونس']],['213',['algeria','الجزائر']],['212',['morocco','المغرب']],
  ['966',['saudi arabia','saudi','السعودية']],['971',['united arab emirates','uae','الإمارات','الامارات']],['974',['qatar','قطر']],['965',['kuwait','الكويت']],['973',['bahrain','البحرين']],['968',['oman','عمان']],['962',['jordan','الأردن','الاردن']],['961',['lebanon','لبنان']],['963',['syria','سوريا']],['964',['iraq','العراق']],['970',['palestine','فلسطين']],
  ['90',['turkey','türkiye','turkiye','تركيا']],['49',['germany','deutschland','ألمانيا','المانيا']],['44',['united kingdom','uk','england','scotland','wales','britain','المملكة المتحدة','بريطانيا']],['33',['france','فرنسا']],['39',['italy','italia','إيطاليا','ايطاليا']],['34',['spain','españa','espana','إسبانيا','اسبانيا']],['31',['netherlands','holland','هولندا']],['32',['belgium','بلجيكا']],['41',['switzerland','سويسرا']],['43',['austria','النمسا']],['46',['sweden','السويد']],['47',['norway','النرويج']],['45',['denmark','الدنمارك']],['358',['finland','فنلندا']],['48',['poland','بولندا']],['420',['czech republic','czechia','التشيك']],['36',['hungary','المجر']],['40',['romania','رومانيا']],['30',['greece','اليونان']],['351',['portugal','البرتغال']],['353',['ireland','أيرلندا','ايرلندا']],['380',['ukraine','أوكرانيا','اوكرانيا']],['7',['russia','russian federation','روسيا']],
  ['1',['united states','usa','u.s.a','canada','الولايات المتحدة','أمريكا','امريكا','كندا']],['52',['mexico','méxico','المكسيك']],['55',['brazil','البرازيل']],['54',['argentina','الأرجنتين','الارجنتين']],['56',['chile','تشيلي']],['57',['colombia','كولومبيا']],['51',['peru','بيرو']],
  ['61',['australia','أستراليا','استراليا']],['64',['new zealand','نيوزيلندا']],['86',['china','الصين']],['81',['japan','اليابان']],['82',['south korea','korea','كوريا الجنوبية']],['91',['india','الهند']],['92',['pakistan','باكستان']],['880',['bangladesh','بنغلاديش']],['62',['indonesia','إندونيسيا','اندونيسيا']],['60',['malaysia','ماليزيا']],['65',['singapore','سنغافورة']],['66',['thailand','تايلاند']],['84',['vietnam','فيتنام']],['63',['philippines','الفلبين']],
  ['27',['south africa','جنوب أفريقيا','جنوب افريقيا']],['234',['nigeria','نيجيريا']],['254',['kenya','كينيا']],['251',['ethiopia','إثيوبيا','اثيوبيا']],['233',['ghana','غانا']]
];

function mhpDetectCountryCode(lead) {
  const explicit = clean(lead?.searchCountry || state?.searchCountry).replace(/\D/g,'');
  if (explicit) return explicit;
  const haystack = `${lead?.searchCity || ''} ${lead?.address || ''} ${lead?.category || ''}`.toLowerCase();
  let best = null;
  for (const [code, aliases] of MHP_COUNTRY_HINTS) {
    for (const alias of aliases) {
      const needle = String(alias).toLowerCase();
      if (haystack.includes(needle) && (!best || needle.length > best.alias.length)) best = {code,alias:needle};
    }
  }
  return best?.code || '';
}

function normalizeLead(lead) {
  const rawPhone = clean(lead?.phoneRaw || lead?.phone);
  const countryCode = mhpDetectCountryCode(lead);
  const phone = mhpNormalizePhone(lead?.phone, countryCode);
  return {
    name: clean(lead?.name),
    phone,
    phoneRaw: rawPhone,
    phoneStatus: phone ? /\d{7,16}/.test(phone.replace(/[^\d]/g, '')) ? 'plausible' : 'unverified' : 'missing',
    address: clean(lead?.address),
    website: clean(lead?.website),
    imageUrl: clean(lead?.imageUrl),
    email: clean(lead?.email),
    emails: clean(lead?.emails),
    facebook: clean(lead?.facebook),
    instagram: clean(lead?.instagram),
    twitter: clean(lead?.twitter),
    linkedin: clean(lead?.linkedin),
    youtube: clean(lead?.youtube),
    tiktok: clean(lead?.tiktok),
    socialLinks: clean(lead?.socialLinks),
    category: clean(lead?.category),
    rating: clean(lead?.rating),
    reviews: clean(lead?.reviews),
    mapsUrl: clean(lead?.mapsUrl),
    hours: clean(lead?.hours),
    status: clean(lead?.status),
    searchCity: clean(lead?.searchCity),
    searchCountry: countryCode,
    usageRequestId: clean(lead?.usageRequestId),
    raw: clean(lead?.raw)
  };
}
