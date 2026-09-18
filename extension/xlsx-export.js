// Maps Hunter Pro XLSX exporter — branded like the extension UI.
// Phone numbers/IDs stay as strings. External URLs render as named clickable button cells.
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

  // key, header, width, type, link label
  // Contact/search context comes first; details + social come after.
  const cols=[
    ['name','Business Name',26,'text','',true],
    ['phone','Phone',18,'text','',true],
    ['email','Email',28,'email','',true],
    ['category','Category',18,'text'],
    ['website','Website',12,'url','Website'],
    ['mapsUrl','Google Maps',12,'url','Maps'],
    ['rating','Rating',9,'center'],
    ['reviews','Reviews',10,'center'],
    ['address','Address',32,'wrap'],
    ['hours','Hours',22,'wrap'],
    ['emails','Other Emails',28,'wrap'],
    ['facebook','Facebook',12,'url','Facebook'],
    ['instagram','Instagram',12,'url','Instagram'],
    ['linkedin','LinkedIn',12,'url','LinkedIn'],
    ['twitter','X / Twitter',12,'url','X'],
    ['youtube','YouTube',12,'url','YouTube'],
    ['tiktok','TikTok',12,'url','TikTok'],
    ['imageUrl','Image',11,'url','Image'],
    ['status','Status',13,'text']
  ];
  const letters=n=>{let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s};
  const lastCol=letters(cols.length);
  const firstEmail=value=>String(value||'').split(/[|,;\s]+/).find(v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))||'';
  function valueFor(lead,key){
    if(key==='email')return String(lead?.email||firstEmail(lead?.emails)||'');
    if(key==='emails'){
      const all=String(lead?.emails||'').split('|').map(x=>x.trim()).filter(Boolean);
      const primary=String(lead?.email||firstEmail(lead?.emails)||'').toLowerCase();
      return all.filter(x=>x.toLowerCase()!==primary).join(' | ');
    }
    return String(lead?.[key]??'');
  }
  function hasSocial(lead){return ['facebook','instagram','linkedin','twitter','youtube','tiktok'].some(k=>/^https?:\/\//i.test(String(lead?.[k]||'')))}

  function workbook(leads){
    leads=Array.isArray(leads)?leads:[];
    const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const relationships=[];
    const relFor=(cell,target)=>{const id='rId'+(relationships.length+1);relationships.push({id,cell,target});return id};
    const inline=(cell,value,style)=>`<c r="${cell}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    const phoneCount=leads.filter(x=>String(x?.phone||'').trim()).length;
    const emailCount=leads.filter(x=>String(x?.email||firstEmail(x?.emails)||'').trim()).length;
    const socialCount=leads.filter(hasSocial).length;

    const title=`<row r="1" ht="30" customHeight="1">${inline('A1','Maps Hunter Pro  ·  Leads Export',1)}</row>`;
    const metaText=`${new Date().toISOString().replace('T',' ').slice(0,16)} UTC  ·  Click Website / Maps / Social cells to open`;
    const meta=`<row r="2" ht="20" customHeight="1">${inline('A2',metaText,2)}</row>`;
    const kpis=`<row r="3" ht="25" customHeight="1">${inline('A3',`${leads.length}  BUSINESSES`,12)}${inline('E3',`${phoneCount}  PHONES`,13)}${inline('J3',`${emailCount}  EMAILS`,14)}${inline('O3',`${socialCount}  SOCIAL`,15)}</row>`;
    const spacer='<row r="4" ht="5" customHeight="1"></row>';
    const headers=`<row r="5" ht="24" customHeight="1">${cols.map((c,j)=>inline(`${letters(j+1)}5`,c[1],3)).join('')}</row>`;
    const rows=leads.map((lead,i)=>{
      const rowNo=i+6,alt=i%2===1;
      const cells=cols.map(([key,label,width,type,linkLabel,isBold],j)=>{
        let value=valueFor(lead,key);
        const cell=`${letters(j+1)}${rowNo}`;
        let style=isBold?(alt?17:16):(alt?5:4),target='';
        if(type==='wrap')style=alt?7:6;
        if(type==='center')style=alt?9:8;
        if(type==='url'&&/^https?:\/\//i.test(value)){
          target=value;value=linkLabel||label;style=10;relFor(cell,target);
        }else if(type==='url'){
          value='—';style=alt?9:8;
        }else if(type==='email'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)){
          target='mailto:'+value;style=11;relFor(cell,target);
        }else if(type==='email'){
          style=alt?17:16;
        }
        return inline(cell,value,style);
      }).join('');
      return `<row r="${rowNo}" ht="22" customHeight="1">${cells}</row>`;
    }).join('');
    const colsXml=cols.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="${c[2]}" customWidth="1"/>`).join('');
    const hyperlinks=relationships.length?`<hyperlinks>${relationships.map(r=>`<hyperlink ref="${r.cell}" r:id="${r.id}"/>`).join('')}</hyperlinks>`:'';
    const rels=relationships.map(r=>`<Relationship Id="${r.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(r.target)}" TargetMode="External"/>`).join('');
    const lastRow=Math.max(5,leads.length+5);
    const merges='<mergeCells count="6"><mergeCell ref="A1:S1"/><mergeCell ref="A2:S2"/><mergeCell ref="A3:D3"/><mergeCell ref="E3:I3"/><mergeCell ref="J3:N3"/><mergeCell ref="O3:S3"/></mergeCells>';
    return zip({
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
      '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Leads" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'xl/styles.xml':`<styleSheet xmlns="${ns}">
        <fonts count="8">
          <font><sz val="10"/><name val="Calibri"/><color rgb="FF0B0B0B"/></font>
          <font><b/><sz val="17"/><name val="Calibri"/><color rgb="FFFFFDFA"/></font>
          <font><sz val="9"/><name val="Calibri"/><color rgb="FF6F6A63"/></font>
          <font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF0B0B0B"/></font>
          <font><b/><sz val="9"/><name val="Calibri"/><color rgb="FF0B0B0B"/></font>
          <font><b/><u/><sz val="10"/><name val="Calibri"/><color rgb="FFF95C4B"/></font>
          <font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF0B0B0B"/></font>
          <font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFDFA"/></font>
        </fonts>
        <fills count="8">
          <fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FF0B0B0B"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFE7E0D4"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFFFFDFA"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFF95C4B"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFF9F8F5"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFF2EEE7"/><bgColor indexed="64"/></patternFill></fill>
        </fills>
        <borders count="3">
          <border/>
          <border><left style="thin"><color rgb="FF171717"/></left><right style="thin"><color rgb="FF171717"/></right><top style="thin"><color rgb="FF171717"/></top><bottom style="thin"><color rgb="FF171717"/></bottom></border>
          <border><left style="thin"><color rgb="FFE0D8CC"/></left><right style="thin"><color rgb="FFE0D8CC"/></right><top style="thin"><color rgb="FFE0D8CC"/></top><bottom style="thin"><color rgb="FFE0D8CC"/></bottom></border>
        </borders>
        <cellStyleXfs count="1"><xf fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
        <cellXfs count="18">
          <xf fontId="0" fillId="0" borderId="0"/>
          <xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
          <xf fontId="2" fillId="3" borderId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
          <xf fontId="3" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
          <xf fontId="0" fillId="4" borderId="2" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
          <xf fontId="0" fillId="6" borderId="2" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
          <xf fontId="0" fillId="4" borderId="2" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
          <xf fontId="0" fillId="6" borderId="2" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
          <xf fontId="0" fillId="4" borderId="2" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
          <xf fontId="0" fillId="6" borderId="2" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
          <xf fontId="4" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
          <xf fontId="5" fillId="4" borderId="2" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
          <xf fontId="6" fillId="4" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
          <xf fontId="6" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
          <xf fontId="6" fillId="5" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
          <xf fontId="7" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
          <xf fontId="4" fillId="4" borderId="2" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
          <xf fontId="4" fillId="6" borderId="2" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
        </cellXfs>
      </styleSheet>`,
      'xl/worksheets/sheet1.xml':`<worksheet xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
        <sheetFormatPr defaultRowHeight="19"/>
        <cols>${colsXml}</cols>
        <sheetData>${title}${meta}${kpis}${spacer}${headers}${rows}</sheetData>
        <autoFilter ref="A5:${lastCol}${lastRow}"/>
        ${merges}
        ${hyperlinks}
      </worksheet>`,
      'xl/worksheets/_rels/sheet1.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
    });
  }
  return {workbook,xlsx(leads,filename){const url=URL.createObjectURL(workbook(leads)),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}};
})();
