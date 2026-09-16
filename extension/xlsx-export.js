// Maps Hunter Pro XLSX exporter — branded, dependency-free OOXML writer.
// All lead values are exported as strings so phone numbers and IDs are preserved exactly.
const MHPExport=(()=>{
  const te=new TextEncoder();
  const xml=x=>String(x??'')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'')
    .replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
  function crc(a){let n=0xffffffff;for(const b of a)n=table[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0}
  function zip(files){
    const local=[],central=[];let offset=0,centralSize=0;
    for(const [name,text]of Object.entries(files)){
      const nameBytes=te.encode(name),data=te.encode(text),c=crc(data);
      const lh=new Uint8Array(30+nameBytes.length),lv=new DataView(lh.buffer);
      lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint32(14,c,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,nameBytes.length,true);lh.set(nameBytes,30);local.push(lh,data);
      const ch=new Uint8Array(46+nameBytes.length),cv=new DataView(ch.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,c,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,nameBytes.length,true);cv.setUint32(42,offset,true);ch.set(nameBytes,46);central.push(ch);centralSize+=ch.length;offset+=lh.length+data.length;
    }
    const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
    return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }

  const cols=[
    ['name','Business Name',28,'text'],
    ['phone','Phone',19,'text'],
    ['address','Address',38,'text'],
    ['website','Website',28,'url'],
    ['imageUrl','Image',18,'url'],
    ['email','Primary Email',28,'email'],
    ['emails','All Emails',36,'text'],
    ['facebook','Facebook',24,'url'],
    ['instagram','Instagram',24,'url'],
    ['twitter','Twitter / X',22,'url'],
    ['linkedin','LinkedIn',24,'url'],
    ['youtube','YouTube',24,'url'],
    ['tiktok','TikTok',22,'url'],
    ['socialLinks','All Social Links',38,'text'],
    ['category','Category',22,'text'],
    ['rating','Rating',10,'center'],
    ['reviews','Reviews',12,'center'],
    ['mapsUrl','Google Maps',30,'url'],
    ['hours','Hours',26,'text'],
    ['status','Status',18,'text'],
    ['searchCity','Search City',18,'text'],
    ['searchCountry','Country Code',14,'center']
  ];
  const letters=n=>{let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s};
  const lastCol=letters(cols.length);

  function workbook(leads){
    leads=Array.isArray(leads)?leads:[];
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const relationships=[];
    const relFor=(cell,target)=>{const id='rId'+(relationships.length+1);relationships.push({id,cell,target});return id};
    const inline=(cell,value,style)=>`<c r="${cell}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    const title=`<row r="1" ht="32" customHeight="1">${cols.map((_,j)=>inline(`${letters(j+1)}1`,j===0?'Maps Hunter Pro — Business Leads':'',1)).join('')}</row>`;
    const metaText=`Exported leads: ${leads.length} • Generated: ${new Date().toISOString().replace('T',' ').slice(0,16)} UTC`;
    const meta=`<row r="2" ht="22" customHeight="1">${cols.map((_,j)=>inline(`${letters(j+1)}2`,j===0?metaText:'',2)).join('')}</row>`;
    const spacer='<row r="3" ht="7" customHeight="1"></row>';
    const headers=`<row r="4" ht="27" customHeight="1">${cols.map((c,j)=>inline(`${letters(j+1)}4`,c[1],3)).join('')}</row>`;
    const rows=leads.map((lead,i)=>{
      const rowNo=i+5,alt=i%2===1;
      const cells=cols.map(([key,label,width,type],j)=>{
        let value=lead?.[key]??'';
        if(key==='email'&&!value)value=lead?.emails||'';
        value=String(value||'');
        const cell=`${letters(j+1)}${rowNo}`;
        let style=alt?5:4;
        if(type==='center')style=alt?9:8;
        let target='';
        if(type==='url'&&/^https?:\/\//i.test(value))target=value;
        if(type==='email'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))target='mailto:'+value;
        if(target){style=alt?7:6;relFor(cell,target)}
        return inline(cell,value,style);
      }).join('');
      return `<row r="${rowNo}" ht="30" customHeight="1">${cells}</row>`;
    }).join('');
    const colsXml=cols.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="${c[2]}" customWidth="1"/>`).join('');
    const hyperlinks=relationships.length?`<hyperlinks>${relationships.map(r=>`<hyperlink ref="${r.cell}" r:id="${r.id}"/>`).join('')}</hyperlinks>`:'';
    const rels=relationships.map(r=>`<Relationship Id="${r.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(r.target)}" TargetMode="External"/>`).join('');
    const lastRow=Math.max(4,leads.length+4);
    return zip({
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Leads" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml':`<styleSheet xmlns="${ns}">
        <fonts count="5">
          <font><sz val="10"/><name val="Calibri"/><color rgb="FF000000"/></font>
          <font><b/><sz val="18"/><name val="Calibri"/><color rgb="FFF95C4B"/></font>
          <font><sz val="10"/><name val="Calibri"/><color rgb="FF000000"/></font>
          <font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF000000"/></font>
          <font><u/><sz val="10"/><name val="Calibri"/><color rgb="FFF95C4B"/></font>
        </fonts>
        <fills count="6">
          <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFE4DED2"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFF95C4B"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFF6F4F1"/><bgColor indexed="64"/></patternFill></fill>
        </fills>
        <borders count="2"><border/><border><left style="thin"><color rgb="FFE4DED2"/></left><right style="thin"><color rgb="FFE4DED2"/></right><top style="thin"><color rgb="FFE4DED2"/></top><bottom style="thin"><color rgb="FFE4DED2"/></bottom></border></borders>
        <cellStyleXfs count="1"><xf fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
        <cellXfs count="10">
          <xf fontId="0" fillId="0" borderId="0"/>
          <xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
          <xf fontId="2" fillId="3" borderId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
          <xf fontId="3" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
          <xf fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
          <xf fontId="0" fillId="5" borderId="1" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
          <xf fontId="4" fillId="0" borderId="1" applyFont="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
          <xf fontId="4" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>
          <xf fontId="0" fillId="0" borderId="1" applyBorder="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
          <xf fontId="0" fillId="5" borderId="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
        </cellXfs>
      </styleSheet>`,
      'xl/worksheets/sheet1.xml':`<worksheet xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
        <sheetFormatPr defaultRowHeight="18"/>
        <cols>${colsXml}</cols>
        <sheetData>${title}${meta}${spacer}${headers}${rows}</sheetData>
        <autoFilter ref="A4:${lastCol}${lastRow}"/>
        ${hyperlinks}
      </worksheet>`,
      'xl/worksheets/_rels/sheet1.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
    });
  }
  return {workbook,xlsx(leads,filename){const url=URL.createObjectURL(workbook(leads)),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}};
})();
