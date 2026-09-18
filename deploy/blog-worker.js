const HTML_HEADERS={"content-type":"text/html;charset=utf-8","cache-control":"no-store, max-age=0, must-revalidate","x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","strict-transport-security":"max-age=31536000; includeSubDomains","permissions-policy":"camera=(), microphone=(), geolocation=()"};

function normalizeBlogHtml(html){
  return String(html||"")
    .replaceAll("/assets/logo.svg","/assets/maps-hunter-pro-icon.png")
    .replaceAll('href="/assets/maps-hunter-pro-icon.png" type="image/svg+xml"','href="/assets/maps-hunter-pro-icon.png" type="image/png"')
    .replaceAll("$100/year","$100 one-time");
}

export default{async fetch(request,env){const u=new URL(request.url);const p=u.pathname;if(p==="/blog")return Response.redirect(u.origin+"/blog/",301);if(p==="/sitemap.xml"){const upstream=await fetch(request);if(!upstream.ok)return upstream;let body=await upstream.text();const rows=await env.BLOG_CONTENT.get("sitemap:rows")||"";if(rows){for(const row of rows.split("\n").filter(Boolean)){const loc=row.split("|")[0];if(loc&&!body.includes("<loc>"+loc+"</loc>"))body=body.replace("</urlset>",'<url><loc>'+loc+'</loc><lastmod>2026-09-18</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url></urlset>');}}return new Response(body,{status:200,headers:{"content-type":"application/xml;charset=utf-8","cache-control":"public,max-age=300,must-revalidate"}});}const key="page:"+p.replace(/\/$/,"")+"/";const html=await env.BLOG_CONTENT.get(key);if(html)return new Response(normalizeBlogHtml(html),{status:200,headers:HTML_HEADERS});return fetch(request);}};