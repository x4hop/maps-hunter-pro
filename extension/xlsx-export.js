// Maps Hunter Pro professional XLSX exporter.
// Self-contained OOXML writer: no remote scripts or runtime dependencies.
const MHPExport=(()=>{
  const te=new TextEncoder();
  const xml=x=>String(x??'')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'')
    .replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
  function crc(a){let n=0xffffffff;for(const b of a)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0}
  function zip(files){
    const local=[],central=[];let offset=0,centralSize=0;
    for(const [name,text] of Object.entries(files)){
      const nameBytes=te.encode(name),data=te.encode(text),c=crc(data);
      const lh=new Uint8Array(30+nameBytes.length),lv=new DataView(lh.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint32(14,c,true);
      lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,nameBytes.length,true);lh.set(nameBytes,30);
      local.push(lh,data);
      const ch=new Uint8Array(46+nameBytes.length),cv=new DataView(ch.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,c,true);
      cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,nameBytes.length,true);cv.setUint32(42,offset,true);ch.set(nameBytes,46);
      central.push(ch);centralSize+=ch.length;offset+=lh.length+data.length;
    }
    const end=new Uint8Array(22),v=new DataView(end.buffer);
    v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
    return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

  // Final approved 20-column layout. Facebook + Instagram are intentionally last.
  const cols=[
    {key:'index',label:'#',type:'index',width:5},
    {key:'name',label:'Business Name',width:22,strong:true},
    {key:'phone',label:'Phone',width:17,phone:true},
    {key:'address',label:'Address',width:28,wrap:false},
    {key:'email',label:'Email',width:24,email:true},
    {key:'category',label:'Category',width:18},
    {key:'rating',label:'Rating',width:9,type:'rating'},
    {key:'reviews',label:'Reviews',width:10,type:'reviews'},
    {key:'hours',label:'Hours',width:18,wrap:false},
    {key:'status',label:'Status',width:14,type:'status'},
    {key:'website',label:'Website',width:14,link:'Open Website'},
    {key:'imageUrl',label:'Image',width:12,link:'View Image'},
    {key:'mapsUrl',label:'Google Maps',width:14,link:'Open Map'},
    {key:'linkedin',label:'LinkedIn',width:13,link:'LinkedIn'},
    {key:'youtube',label:'YouTube',width:12,link:'YouTube'},
    {key:'tiktok',label:'TikTok',width:11,link:'TikTok'},
    {key:'twitter',label:'X',width:8,link:'X'},
    {key:'socialLinks',label:'Social Links',width:14,link:'Open Social'},
    {key:'facebook',label:'Facebook',width:13,link:'Facebook'},
    {key:'instagram',label:'Instagram',width:13,link:'Instagram'}
  ];

  const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
  const urls=v=>Array.from(new Set(String(v||'').match(/https?:\/\/[^\s|,;]+/gi)||[]));
  const phoneKey=v=>safePhone(v).replace(/\D/g,'').slice(-12);
  const norm=v=>clean(v).toLowerCase();

  function safePhone(value){
    let text=String(value||'')
      .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/\u2060/g,' ')
      .trim();
    if(!text)return '';
    let digits=text.replace(/\D/g,'');
    if(digits.startsWith('00'))digits=digits.slice(2);
    if(!/^\s*(?:\+|00)/.test(text))return '';
    if(digits.length<8||digits.length>15)return '';
    if(/^(\d)\1{6,}$/.test(digits))return '';
    return `+${digits}`;
  }

  function dedupe(leads){
    const out=[],seen=new Set();
    for(const raw of Array.isArray(leads)?leads:[]){
      const lead={...(raw||{})};
      if(!lead.email && lead.emails) lead.email=String(lead.emails).split(/[|,;\s]+/).find(x=>x.includes('@'))||lead.emails;
      const keys=[];
      if(clean(lead.mapsUrl)) keys.push(`m:${norm(lead.mapsUrl)}`);
      const pk=phoneKey(lead.phone); if(pk.length>=7) keys.push(`p:${pk}`);
      if(clean(lead.name)||clean(lead.address)) keys.push(`n:${norm(lead.name)}|a:${norm(lead.address)}`);
      if(keys.some(k=>seen.has(k))) continue;
      keys.forEach(k=>seen.add(k));
      out.push(lead);
    }
    return out;
  }

  const colName=n=>{let out='';for(n+=1;n>0;n=Math.floor((n-1)/26))out=String.fromCharCode(65+((n-1)%26))+out;return out};
  const ref=(col,row)=>colName(col)+row;
  function sCell(r,c,text,style=6){return `<c r="${ref(c,r)}" s="${style}" t="str"><v>${xml(text)}</v></c>`}
  function nCell(r,c,num,style=6){return `<c r="${ref(c,r)}" s="${style}"><v>${Number(num)||0}</v></c>`}

  function stylesXml(){
    // xfs: 0 default, 1 title, 2 info, 3 header, 4 body, 5 alt, 6 strong, 7 altStrong,
    // 8 phone, 9 altPhone, 10 rating, 11 altRating, 12 link, 13 altLink,
    // 14 statusOpen, 15 statusClosed, 16 statusNeutral, 17 integer.
    const align=' horizontal="center" vertical="center" wrapText="0"';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
 <fonts count="7">
  <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  <font><b/><sz val="15"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><color rgb="FF4A2F20"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><color rgb="FF176B3A"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><color rgb="FF9A6700"/><name val="Calibri"/></font>
  <font><u/><sz val="11"/><color rgb="FF1A5FB4"/><name val="Calibri"/></font>
 </fonts>
 <fills count="11">
  <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FF5B3A29"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFF2E7D8"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFE8892F"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFF8EE"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFEAF7EE"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFFF3CD"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFE7F6EC"/><bgColor indexed="64"/></patternFill></fill>
  <fill><patternFill patternType="solid"><fgColor rgb="FFFDE8E7"/><bgColor indexed="64"/></patternFill></fill>
 </fills>
 <borders count="2"><border/><border><left style="thin"><color rgb="FFE2D6C8"/></left><right style="thin"><color rgb="FFE2D6C8"/></right><top style="thin"><color rgb="FFE2D6C8"/></top><bottom style="thin"><color rgb="FFE2D6C8"/></bottom></border></borders>
 <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
 <cellXfs count="18">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  <xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="2" fillId="3" borderId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="3" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="0" fillId="5" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="0" fillId="6" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="2" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="2" fillId="6" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="49" fontId="4" fillId="7" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="49" fontId="4" fillId="7" borderId="1" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="5" fillId="8" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="5" fillId="8" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="6" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="6" fillId="6" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="4" fillId="9" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="3" fillId="10" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
  <xf numFmtId="0" fontId="0" fillId="5" borderId="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment${align}/></xf>
 </cellXfs>
 <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  }

  function workbook(leads,meta={}){
    const cleanLeads=dedupe(leads);
    const links=[];
    const rows=[];
    const totalCols=cols.length,lastCol=ref(totalCols-1,1).replace(/\d/g,'');
    rows.push(`<row r="1" ht="24" customHeight="1">${sCell(1,0,'MAPS HUNTER PRO — BUSINESS LEADS',1)}</row>`);
    const search=clean(meta.search||meta.cities||(cleanLeads.map(x=>x.searchCity).filter(Boolean).join(', ')));
    const exported=new Date().toLocaleString('en-GB',{hour12:false});
    const info=`Results: ${cleanLeads.length}   •   Exported: ${exported}${search?`   •   Search: ${search}`:''}`;
    rows.push(`<row r="2" ht="20" customHeight="1">${sCell(2,0,info,2)}</row>`);
    rows.push(`<row r="3" ht="20" customHeight="1">${cols.map((c,i)=>sCell(3,i,c.label,3)).join('')}</row>`);

    cleanLeads.forEach((lead,idx)=>{
      const r=idx+4,alt=idx%2===1,cells=[];
      cols.forEach((col,ci)=>{
        if(col.type==='index'){cells.push(nCell(r,ci,idx+1,17));return;}
        let raw=clean(lead[col.key]);
        if(col.phone) raw=safePhone(raw);
        if(col.key==='email'&&!raw) raw=clean(lead.emails).split(/[|,;\s]+/).find(v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))||clean(lead.emails);
        if(col.type==='rating'){
          const m=raw.replace(',','.').match(/\d+(?:\.\d+)?/);cells.push(m?nCell(r,ci,Number(m[0]),10):sCell(r,ci,'',alt?5:4));return;
        }
        if(col.type==='reviews'){
          const n=Number(raw.replace(/[^\d]/g,''));cells.push(raw&&Number.isFinite(n)?nCell(r,ci,n,17):sCell(r,ci,'',alt?5:4));return;
        }
        if(col.type==='status'){
          const low=raw.toLowerCase();const st=/open|opened|working|متاح|مفتوح/.test(low)?14:/closed|temporarily closed|permanently closed|مغلق/.test(low)?15:16;
          cells.push(sCell(r,ci,raw,st));return;
        }
        if(col.link){
          const u=urls(raw)[0]||(/^https?:\/\//i.test(raw)?raw:'');
          if(u){const rel=`rId${links.length+1}`;links.push({cell:ref(ci,r),url:u,rel});cells.push(sCell(r,ci,col.link,alt?13:12));}
          else cells.push(sCell(r,ci,'',alt?5:4));
          return;
        }
        if(col.email&&raw){
          const mail=raw.split(/[|,;\s]+/).find(v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))||raw;
          if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)){const rel=`rId${links.length+1}`;links.push({cell:ref(ci,r),url:`mailto:${mail}`,rel});cells.push(sCell(r,ci,mail,alt?13:12));}
          else cells.push(sCell(r,ci,mail,alt?5:4));
          return;
        }
        const style=col.phone?8:(col.strong?(alt?7:6):(alt?5:4));
        // Phone cells are inline strings, so +218/+49 stays text without scientific notation.
        cells.push(sCell(r,ci,raw,style));
      });
      rows.push(`<row r="${r}" ht="18" customHeight="1">${cells.join('')}</row>`);
    });

    const endRow=Math.max(3,cleanLeads.length+3);
    const colXml=cols.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="${c.width}" customWidth="1"/>`).join('');
    const hyperlinkXml=links.length?`<hyperlinks>${links.map(l=>`<hyperlink ref="${l.cell}" r:id="${l.rel}"/>`).join('')}</hyperlinks>`:'';
    const rels=links.map(l=>`<Relationship Id="${l.rel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(l.url)}" TargetMode="External"/>`).join('');
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    return zip({
      '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Business Leads" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml':stylesXml(),
      'xl/worksheets/sheet1.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${lastCol}${endRow}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${colXml}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A3:${lastCol}${endRow}"/><mergeCells count="2"><mergeCell ref="A1:${lastCol}1"/><mergeCell ref="A2:${lastCol}2"/></mergeCells>${hyperlinkXml}<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`,
      'xl/worksheets/_rels/sheet1.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
    });
  }

  return {
    workbook,
    async xlsx(leads,filename,meta={}){
      const rows=dedupe(leads).length;
      if(!rows) throw new Error('NO_EXPORT_ROWS');
      const blob=workbook(leads,meta),url=URL.createObjectURL(blob),name=filename||`maps_hunter_${Date.now()}.xlsx`;
      try{
        if(typeof chrome!=='undefined'&&chrome.downloads?.download){
          const id=await new Promise((resolve,reject)=>chrome.downloads.download({url,filename:name,saveAs:false},downloadId=>{
            const err=chrome.runtime?.lastError;
            if(err)reject(new Error(err.message));else resolve(downloadId);
          }));
          return {ok:true,rows,downloadId:id};
        }
        const a=document.createElement('a');a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
        return {ok:true,rows};
      }finally{setTimeout(()=>URL.revokeObjectURL(url),15000)}
    }
  };
})();
