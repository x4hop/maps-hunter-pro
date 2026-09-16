const META={
  en:{lang:'en',dir:'ltr',title:'Maps Hunter Pro — Google Maps Lead Extraction Chrome Extension',description:'Find, organize and export Google Maps business leads to Excel, CSV and JSON with international phone formatting.',locale:'en_US'},
  ar:{lang:'ar',dir:'rtl',title:'Maps Hunter Pro — استخراج بيانات الأنشطة التجارية من Google Maps',description:'استخرج ونظّم وصدّر بيانات الأنشطة التجارية من Google Maps إلى Excel وCSV وJSON مع تنسيق أرقام الهاتف الدولي.',locale:'ar_LY'},
  ru:{lang:'ru',dir:'ltr',title:'Maps Hunter Pro — экспорт бизнес-лидов из Google Maps',description:'Находите, систематизируйте и экспортируйте бизнес-лиды из Google Maps в Excel, CSV и JSON с международным форматом телефонов.',locale:'ru_RU'},
  de:{lang:'de',dir:'ltr',title:'Maps Hunter Pro — Google Maps Lead-Extraktion für Chrome',description:'Unternehmens-Leads aus Google Maps finden, organisieren und nach Excel, CSV und JSON mit internationalem Telefonnummernformat exportieren.',locale:'de_DE'},
  es:{lang:'es',dir:'ltr',title:'Maps Hunter Pro — extracción de leads de Google Maps',description:'Encuentra, organiza y exporta leads empresariales de Google Maps a Excel, CSV y JSON con formato telefónico internacional.',locale:'es_ES'}
};
const LANGS=Object.keys(META);
const HTML_HEADERS={
  'content-type':'text/html;charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'referrer-policy':'strict-origin-when-cross-origin',
  'content-security-policy':"default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://wa.me"
};

async function assetText(env,path){
  const url=new URL(path,'https://assets.local');
  const res=await env.ASSETS.fetch(new Request(url));
  if(!res.ok)return null;
  return res.text();
}

function localized(html,lang,origin){
  const m=META[lang]||META.en;
  const canonical=`${origin}/${lang}`;
  const alternates=LANGS.map(x=>`<link rel="alternate" hreflang="${x}" href="${origin}/${x}" />`).join('')+`<link rel="alternate" hreflang="x-default" href="${origin}/en" />`;
  if(!html.includes('/assets/payment-icon-clean.css')){
    html=html.replace('</head>','<link rel="stylesheet" href="/assets/payment-icon-clean.css"></head>');
  }
  return html
    .replace('<html lang="en" dir="ltr">',`<html lang="${m.lang}" dir="${m.dir}">`)
    .replace(/<title>[\s\S]*?<\/title>/,`<title>${m.title}</title>`)
    .replace(/<meta name="description" content="[^"]*" \/>/,`<meta name="description" content="${m.description}" />`)
    .replace(/<meta property="og:title" content="[^"]*" \/>/,`<meta property="og:title" content="${m.title}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/,`<meta property="og:description" content="${m.description}" />`)
    .replace(/<meta property="og:locale" content="[^"]*" \/>/,`<meta property="og:locale" content="${m.locale}" />`)
    .replace(/<meta name="twitter:title" content="[^"]*" \/>/,`<meta name="twitter:title" content="${m.title}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*" \/>/,`<meta name="twitter:description" content="${m.description}" />`)
    .replace('<!-- Add an absolute canonical URL here after the production domain is connected. -->',`<link rel="canonical" href="${canonical}" />${alternates}<meta property="og:url" content="${canonical}" />`);
}

async function htmlAsset(env,path){
  const html=await assetText(env,path);
  return html?new Response(html,{headers:HTML_HEADERS}):new Response('Page not found',{status:404,headers:{'content-type':'text/plain;charset=utf-8'}});
}

export default{
  async fetch(req,env){
    const u=new URL(req.url);

    if(u.pathname.startsWith('/api/'))return env.API.fetch(req);

    if(u.pathname==='/robots.txt'){
      return new Response(`User-agent: *\nAllow: /\nSitemap: ${u.origin}/sitemap.xml\n`,{headers:{'content-type':'text/plain;charset=utf-8','cache-control':'public,max-age=3600'}});
    }

    if(u.pathname==='/sitemap.xml'){
      const urls=[...LANGS.map(l=>`<url><loc>${u.origin}/${l}</loc><changefreq>weekly</changefreq><priority>${l==='en'?'1.0':'0.9'}</priority></url>`),`<url><loc>${u.origin}/privacy.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`,`<url><loc>${u.origin}/terms.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>`].join('');
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,{headers:{'content-type':'application/xml;charset=utf-8','cache-control':'public,max-age=3600'}});
    }

    if(u.pathname==='/'||u.pathname==='')return Response.redirect(`${u.origin}/en`,301);
    if(u.pathname==='/privacy.html')return htmlAsset(env,'/privacy.html');
    if(u.pathname==='/terms.html')return htmlAsset(env,'/terms.html');

    const normalized=u.pathname.replace(/\/$/,'');
    const lang=normalized.slice(1);
    if(LANGS.includes(lang)){
      const html=await assetText(env,'/index.html');
      return html?new Response(localized(html,lang,u.origin),{headers:HTML_HEADERS}):new Response('Page not found',{status:404});
    }

    if(u.pathname.startsWith('/assets/'))return env.ASSETS.fetch(req);

    const asset=await env.ASSETS.fetch(req);
    if(asset.ok)return asset;
    return new Response('Not found',{status:404,headers:{'content-type':'text/plain;charset=utf-8','x-content-type-options':'nosniff'}});
  }
};
