import backend from '../backend/src/entry.js';

const PUBLIC_ORIGIN='https://mapshunterpro.com';
const META={
  en:{lang:'en',dir:'ltr',title:'Google Maps Scraper & Lead Extractor for Chrome | Maps Hunter Pro',description:'Extract structured business leads from Google Maps, including phones, websites, available emails and social links, then export clean data to Excel, CSV or JSON.',locale:'en_US'},
  ar:{lang:'ar',dir:'rtl',title:'استخراج بيانات Google Maps والعملاء المحتملين | Maps Hunter Pro',description:'استخرج بيانات الأنشطة التجارية من Google Maps مثل الهاتف والموقع والبيانات المتاحة، ثم صدّر النتائج بشكل منظم إلى Excel أو CSV أو JSON.',locale:'ar_LY'},
  ru:{lang:'ru',dir:'ltr',title:'Парсер Google Maps и сборщик лидов для Chrome | Maps Hunter Pro',description:'Собирайте структурированные данные компаний из Google Maps — телефоны, сайты, доступные email и соцсети — и экспортируйте результаты в Excel, CSV или JSON.',locale:'ru_RU'},
  de:{lang:'de',dir:'ltr',title:'Google Maps Scraper & Lead-Extractor für Chrome | Maps Hunter Pro',description:'Extrahiere strukturierte Unternehmensdaten aus Google Maps – Telefonnummern, Websites, verfügbare E-Mails und Social Links – und exportiere sie in Excel, CSV oder JSON.',locale:'de_DE'},
  es:{lang:'es',dir:'ltr',title:'Google Maps Scraper y Extractor de Leads | Maps Hunter Pro',description:'Extrae datos estructurados de negocios desde Google Maps, como teléfonos, sitios web, correos disponibles y redes sociales, y expórtalos a Excel, CSV o JSON.',locale:'es_ES'}
};
const LANGS=Object.keys(META);

const HTML_HEADERS={
  'content-type':'text/html;charset=utf-8',
  'cache-control':'no-store, max-age=0, must-revalidate',
  'x-content-type-options':'nosniff',
  'referrer-policy':'strict-origin-when-cross-origin',
  'strict-transport-security':'max-age=31536000; includeSubDomains',
  'permissions-policy':'camera=(), microphone=(), geolocation=()',
  'content-security-policy':"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://wa.me"
};
const ADMIN_HEADERS={
  'cache-control':'no-store',
  'x-frame-options':'DENY',
  'x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; frame-ancestors 'none'; base-uri 'none'"
};

async function asset(env,path,extraHeaders={}){
  const url=new URL(path,'https://assets.local');
  const source=await env.ASSETS.fetch(new Request(url));
  if(!source.ok)return source;
  const headers=new Headers(source.headers);
  for(const [k,v] of Object.entries(extraHeaders))headers.set(k,v);
  return new Response(source.body,{status:source.status,statusText:source.statusText,headers});
}

async function assetText(env,path){
  const response=await asset(env,path);
  if(!response.ok)return null;
  return response.text();
}

function localized(html,lang){
  const m=META[lang]||META.en;
  const canonical=`${PUBLIC_ORIGIN}/${lang}`;
  const alternates=LANGS.map(x=>`<link rel="alternate" hreflang="${x}" href="${PUBLIC_ORIGIN}/${x}" />`).join('')+`<link rel="alternate" hreflang="x-default" href="${PUBLIC_ORIGIN}/en" />`;
  if(!html.includes('/assets/payment-icon-clean.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/payment-icon-clean.css"></head>');
  if(!html.includes('/assets/multilingual-fix.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/multilingual-fix.css"></head>');
  if(!html.includes('/assets/language-runtime-fix.js'))html=html.replace('</body>','<script src="/assets/language-runtime-fix.js" defer></script></body>');
  return html
    .replace(/<html lang="[^"]+" dir="[^"]+">/,`<html lang="${m.lang}" dir="${m.dir}">`)
    .replace(/<title>[\s\S]*?<\/title>/,`<title>${m.title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/,`<meta name="description" content="${m.description}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/,`<meta property="og:title" content="${m.title}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/,`<meta property="og:description" content="${m.description}" />`)
    .replace(/<meta property="og:locale" content="[^"]*" \/>/,`<meta property="og:locale" content="${m.locale}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/,`<meta name="twitter:title" content="${m.title}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/,`<meta name="twitter:description" content="${m.description}" />`)
    .replace('<!-- Add an absolute canonical URL here after the production domain is connected. -->',`<link rel="canonical" href="${canonical}" />${alternates}<meta property="og:url" content="${canonical}" />`);
}

async function handleSite(request,env){
  const u=new URL(request.url);
  if(u.hostname==='www.mapshunterpro.com')return Response.redirect(`${PUBLIC_ORIGIN}${u.pathname}${u.search}`,301);
  if(u.pathname==='/robots.txt')return new Response(`User-agent: *\nAllow: /\nSitemap: ${PUBLIC_ORIGIN}/sitemap.xml\n`,{headers:{'content-type':'text/plain;charset=utf-8','cache-control':'public,max-age=3600'}});
  if(u.pathname==='/sitemap.xml'){
    const urls=[
      ...LANGS.map(l=>`<url><loc>${PUBLIC_ORIGIN}/${l}</loc><changefreq>weekly</changefreq><priority>${l==='en'?'1.0':'0.9'}</priority></url>`),
      `<url><loc>${PUBLIC_ORIGIN}/blog/</loc><lastmod>2026-09-18</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`,
      `<url><loc>${PUBLIC_ORIGIN}/blog/how-to-extract-business-leads-from-google-maps/</loc><lastmod>2026-09-18</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>`,
      `<url><loc>${PUBLIC_ORIGIN}/blog/find-businesses-without-websites-on-google-maps/</loc><lastmod>2026-09-18</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>`,
      `<url><loc>${PUBLIC_ORIGIN}/blog/maps-hunter-pro-vs-phantombuster/</loc><lastmod>2026-09-18</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>`,
      `<url><loc>${PUBLIC_ORIGIN}/blog/ar/</loc><lastmod>2026-09-18</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
      `<url><loc>${PUBLIC_ORIGIN}/blog/ar/maps-hunter-pro-vs-phantombuster/</loc><lastmod>2026-09-18</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`,
      `<url><loc>${PUBLIC_ORIGIN}/privacy.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,
      `<url><loc>${PUBLIC_ORIGIN}/terms.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`
    ].join('');
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,{headers:{'content-type':'application/xml;charset=utf-8','cache-control':'public,max-age=3600'}});
  }
  if(u.pathname==='/'||u.pathname==='')return Response.redirect(`${PUBLIC_ORIGIN}/en`,301);
  if(u.pathname==='/release.json')return asset(env,'/release.json',{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  if(u.pathname.startsWith('/downloads/')&&u.pathname.toLowerCase().endsWith('.zip')){
    const filename=u.pathname.split('/').pop()||'Maps-Hunter-Pro.zip';
    return asset(env,u.pathname,{'content-type':'application/zip','content-disposition':`attachment; filename="${filename.replace(/["\r\n]/g,'')}"`,'cache-control':'public,max-age=3600','x-content-type-options':'nosniff'});
  }
  if(u.pathname==='/admin')return Response.redirect(`${u.origin}/admin/`,301);
  if(u.pathname==='/admin/'||u.pathname==='/admin/index.html')return asset(env,'/admin/index.html',{...ADMIN_HEADERS,'content-type':'text/html;charset=utf-8'});
  if(u.pathname.startsWith('/admin/'))return asset(env,u.pathname,ADMIN_HEADERS);
  if(u.pathname==='/privacy.html')return asset(env,'/privacy.html',HTML_HEADERS);
  if(u.pathname==='/terms.html')return asset(env,'/terms.html',HTML_HEADERS);
  if(u.pathname==='/blog'||u.pathname==='/blog/')return asset(env,'/blog/index.html',HTML_HEADERS);
  if(u.pathname==='/blog/how-to-extract-business-leads-from-google-maps'||u.pathname==='/blog/how-to-extract-business-leads-from-google-maps/')return asset(env,'/blog/how-to-extract-business-leads-from-google-maps/index.html',HTML_HEADERS);
  if(u.pathname==='/blog/find-businesses-without-websites-on-google-maps'||u.pathname==='/blog/find-businesses-without-websites-on-google-maps/')return asset(env,'/blog/find-businesses-without-websites-on-google-maps/index.html',HTML_HEADERS);
  if(u.pathname==='/blog/maps-hunter-pro-vs-phantombuster'||u.pathname==='/blog/maps-hunter-pro-vs-phantombuster/')return asset(env,'/blog/maps-hunter-pro-vs-phantombuster/index.html',HTML_HEADERS);
  if(u.pathname==='/blog/ar'||u.pathname==='/blog/ar/')return asset(env,'/blog/ar/index.html',HTML_HEADERS);
  if(u.pathname==='/blog/ar/maps-hunter-pro-vs-phantombuster'||u.pathname==='/blog/ar/maps-hunter-pro-vs-phantombuster/')return asset(env,'/blog/ar/maps-hunter-pro-vs-phantombuster/index.html',HTML_HEADERS);

  const normalized=u.pathname.replace(/\/$/,'');
  const lang=normalized.slice(1);
  if(LANGS.includes(lang)){
    const html=await assetText(env,`/${lang}/index.html`)||await assetText(env,'/index.html');
    return html?new Response(localized(html,lang),{headers:HTML_HEADERS}):new Response('Page not found',{status:404});
  }

  const staticAsset=await env.ASSETS.fetch(request);
  if(staticAsset.ok)return staticAsset;
  return new Response('Not found',{status:404,headers:{'content-type':'text/plain;charset=utf-8','x-content-type-options':'nosniff'}});
}

export default{
  async fetch(request,env,ctx){
    const u=new URL(request.url);
    if(u.pathname.startsWith('/api/'))return backend.fetch(request,env,ctx);
    return handleSite(request,env);
  },
  async scheduled(controller,env,ctx){
    if(typeof backend.scheduled==='function')return backend.scheduled(controller,env,ctx);
  }
};
