const HTML_HEADERS={"content-type":"text/html;charset=utf-8","cache-control":"no-store, max-age=0, must-revalidate","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","strict-transport-security":"max-age=31536000; includeSubDomains","permissions-policy":"camera=(), microphone=(), geolocation=()"};
const SEO_ROBOTS="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

const INDEX_SEO={
  "/blog/":{
    extra:'<meta property="og:image" content="https://mapshunterpro.com/assets/maps-hunter-pro-icon.png"><meta property="og:locale" content="en_US"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="Google Maps Lead Generation Guides | Maps Hunter Pro"><meta name="twitter:description" content="Practical Google Maps lead-generation guides and fact-based tool comparisons."><meta name="twitter:image" content="https://mapshunterpro.com/assets/maps-hunter-pro-icon.png"><script type="application/ld+json">{"@context":"https://schema.org","@type":"CollectionPage","name":"Google Maps Lead Generation Guides","url":"https://mapshunterpro.com/blog/","description":"Practical guides and fact-based comparisons for Google Maps business data and lead generation.","isPartOf":{"@type":"WebSite","name":"Maps Hunter Pro","url":"https://mapshunterpro.com/"}}</script>'
  },
  "/blog/ar/":{
    extra:'<meta property="og:type" content="website"><meta property="og:title" content="دليل Google Maps والعملاء المحتملين | Maps Hunter Pro"><meta property="og:description" content="مقالات عملية ومقارنات موثقة عن استخراج بيانات الأنشطة التجارية من Google Maps والبحث عن العملاء المحتملين."><meta property="og:url" content="https://mapshunterpro.com/blog/ar/"><meta property="og:locale" content="ar_LY"><meta property="og:image" content="https://mapshunterpro.com/assets/maps-hunter-pro-icon.png"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="دليل Google Maps والعملاء المحتملين | Maps Hunter Pro"><meta name="twitter:description" content="أدلة ومقارنات عملية لاستخدام Google Maps في البحث عن الشركات والعملاء المحتملين."><meta name="twitter:image" content="https://mapshunterpro.com/assets/maps-hunter-pro-icon.png"><script type="application/ld+json">{"@context":"https://schema.org","@type":"CollectionPage","inLanguage":"ar","name":"دليل Google Maps والعملاء المحتملين","url":"https://mapshunterpro.com/blog/ar/","description":"مقالات عملية ومقارنات موثقة عن استخراج بيانات الأنشطة التجارية من Google Maps.","isPartOf":{"@type":"WebSite","name":"Maps Hunter Pro","url":"https://mapshunterpro.com/"}}</script>'
  }
};

function normalizeBlogHtml(html,path){
  let out=String(html||"")
    .replaceAll("/assets/logo.svg","/assets/maps-hunter-pro-icon.png")
    .replaceAll('href="/assets/maps-hunter-pro-icon.png" type="image/svg+xml"','href="/assets/maps-hunter-pro-icon.png" type="image/png"')
    .replaceAll("$100/year","$100 one-time")
    .replaceAll("100 دولار سنويًا","100 دولار دفعة واحدة")
    .replaceAll("100 دولار في السنة","100 دولار دفعة واحدة");
  if(/<meta name="robots" content="[^"]*">/i.test(out)){
    out=out.replace(/<meta name="robots" content="[^"]*">/i,`<meta name="robots" content="${SEO_ROBOTS}">`);
  }else if(/<meta name="description" content="[^"]*">/i.test(out)){
    out=out.replace(/(<meta name="description" content="[^"]*">)/i,`$1<meta name="robots" content="${SEO_ROBOTS}">`);
  }
  const seo=INDEX_SEO[path];
  if(seo&&!out.includes('"@type":"CollectionPage"'))out=out.replace("</head>",seo.extra+"</head>");
  if(/<meta property="og:type" content="article">/i.test(out)){
    const title=((out.match(/<title>([\\s\\S]*?)<\\/title>/i)||[])[1]||"").replace(/<[^>]+>/g,"").trim();
    const description=(out.match(/<meta name="description" content="([^"]*)"/i)||[])[1]||"";
    const canonical=(out.match(/<link rel="canonical" href="([^"]*)"/i)||[])[1]||"";
    const lang=(out.match(/<html[^>]* lang="([^"]+)"/i)||[])[1]||"en";
    const esc=value=>String(value||"").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    let extra="";
    if(description&&!/<meta property="og:description"/i.test(out))extra+=`<meta property="og:description" content="${esc(description)}">`;
    if(!/<meta property="og:image"/i.test(out))extra+='<meta property="og:image" content="https://mapshunterpro.com/assets/maps-hunter-pro-icon.png"><meta property="og:image:alt" content="Maps Hunter Pro">';
    if(!/<meta name="twitter:card"/i.test(out))extra+='<meta name="twitter:card" content="summary">';
    if(title&&!/<meta name="twitter:title"/i.test(out))extra+=`<meta name="twitter:title" content="${esc(title)}">`;
    if(description&&!/<meta name="twitter:description"/i.test(out))extra+=`<meta name="twitter:description" content="${esc(description)}">`;
    if(!/<meta name="twitter:image"/i.test(out))extra+='<meta name="twitter:image" content="https://mapshunterpro.com/assets/maps-hunter-pro-icon.png">';
    if(title&&canonical&&!out.includes('"@type":"BlogPosting"')){
      const schema={"@context":"https://schema.org","@type":"BlogPosting","headline":title,"description":description,"mainEntityOfPage":canonical,"inLanguage":lang,"author":{"@type":"Organization","name":"Maps Hunter Pro"},"publisher":{"@type":"Organization","name":"Maps Hunter Pro","url":"https://mapshunterpro.com/"}};
      extra+=`<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    }
    if(extra)out=out.replace("</head>",extra+"</head>");
  }
  return out;
}

export default{async fetch(request,env){const u=new URL(request.url);const p=u.pathname;if(p==="/blog")return Response.redirect(u.origin+"/blog/",301);if(p.startsWith("/blog/")&&!p.endsWith("/")&&!p.split("/").pop().includes("."))return Response.redirect(u.origin+p+"/"+u.search,301);if(p==="/sitemap.xml"){const upstream=await fetch(request);if(!upstream.ok)return upstream;let body=await upstream.text();const rows=await env.BLOG_CONTENT.get("sitemap:rows")||"";if(rows){for(const row of rows.split("\n").filter(Boolean)){const [loc,lastmod="2026-09-26"]=row.split("|");if(loc&&/^https:\/\/mapshunterpro\.com\/blog\//.test(loc)&&!body.includes("<loc>"+loc+"</loc>")){const priority=loc.includes("/blog/ar/")?"0.8":"0.9";body=body.replace("</urlset>",'<url><loc>'+loc+'</loc><lastmod>'+lastmod+'</lastmod><changefreq>monthly</changefreq><priority>'+priority+'</priority></url></urlset>');}}}return new Response(body,{status:200,headers:{"content-type":"application/xml;charset=utf-8","cache-control":"public,max-age=300,must-revalidate"}});}const key="page:"+p.replace(/\/$/,"")+"/";const html=await env.BLOG_CONTENT.get(key);if(html)return new Response(normalizeBlogHtml(html,p.endsWith("/")?p:p+"/"),{status:200,headers:HTML_HEADERS});return fetch(request);}};