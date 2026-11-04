import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
export const MAX_BYTES=5*1024*1024;
export function domainName(value){
 const s=String(value||'').trim().toLowerCase().replace(/\.$/,'');
 if(s.length>253||!s.includes('.')||!s.split('.').every(x=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x)))throw Error('Expected an ASCII domain name (use punycode for international names)');
 return s;
}
function text(v,label){if(typeof v!=='string'||!v.trim())throw Error(`Missing or repeated ${label}`);return v.trim();}
function choice(v,allowed,label){const s=text(v,label);if(!allowed.includes(s))throw Error(`Invalid ${label}: ${s}`);return s;}
function integer(v,label,min,max){const s=text(v,label);if(!/^\d+$/.test(s))throw Error(`Invalid ${label}`);const n=Number(s);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(`Invalid ${label}`);return n;}
export function parseAggregate(input){
 if(input.length>MAX_BYTES)throw Error('Report exceeds 5 MiB limit');
 const bytes=input[0]===31&&input[1]===139?gunzipSync(input,{maxOutputLength:MAX_BYTES}):input;
 const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('DTD and entities are not allowed');
 if(XMLValidator.validate(xml)!==true)throw Error('Malformed XML');
 const parsed=new XMLParser({parseTagValue:false,trimValues:true,ignoreAttributes:true,removeNSPrefix:true}).parse(xml);
 const f=parsed.feedback;if(!f||Array.isArray(f))throw Error('Expected one feedback document');
 const m=f.report_metadata,p=f.policy_published;if(!m||!p)throw Error('Missing metadata or published policy');
 const start=integer(m.date_range?.begin,'begin',0,4102444800),end=integer(m.date_range?.end,'end',1,4102444800);
 if(end<=start||end>Date.now()/1000+300)throw Error('Invalid or future report period');
 const records=Array.isArray(f.record)?f.record:f.record?[f.record]:[];
 if(!records.length||records.length>20000)throw Error('Report requires 1 to 20000 records');
 let total=0;
 const rows=records.map((r,i)=>{
  const row=r.row,pe=row?.policy_evaluated;const ip=text(row?.source_ip,'source_ip');if(!isIP(ip))throw Error('Invalid source IP');
  const messages=integer(row.count,'count',1,2147483647);total+=messages;if(!Number.isSafeInteger(total))throw Error('Message total too large');
  return {ip,messages,ordinal:i+1,header_from:domainName(text(r.identifiers?.header_from,'header_from')),spf:choice(pe?.spf,['pass','fail'],'aligned SPF'),dkim:choice(pe?.dkim,['pass','fail'],'aligned DKIM'),disposition:choice(pe?.disposition,['none','pass','quarantine','reject'],'disposition'),raw:r};
 });
 return {xml,sha256:createHash('sha256').update(xml).digest('hex'),domain:domainName(text(p.domain,'policy domain')),reporter:text(m.org_name,'reporter'),email:text(m.email,'reporter email'),key:text(m.report_id,'report id'),start:new Date(start*1000).toISOString(),end:new Date(end*1000).toISOString(),policy:choice(p.p,['none','quarantine','reject'],'published policy'),metadata:{report_metadata:m,policy_published:p,version:f.version||'legacy'},rows,total};
}
export function demoXml({domain='harbour.example',key='demo-harbour',days=1,rows=[['192.0.2.10',120,'pass','fail','none'],['198.51.100.20',12,'fail','fail','none']]}={}){
 const end=Math.floor(Date.now()/86400000)*86400-days*86400;return `<?xml version="1.0"?><feedback xmlns="urn:ietf:params:xml:ns:dmarc-2.0"><version>1.0</version><report_metadata><org_name>Example Receiver</org_name><email>reports@receiver.example</email><report_id>${key}</report_id><date_range><begin>${end-86400}</begin><end>${end}</end></date_range></report_metadata><policy_published><domain>${domain}</domain><p>none</p></policy_published>${rows.map(([ip,count,dkim,spf,disposition])=>`<record><row><source_ip>${ip}</source_ip><count>${count}</count><policy_evaluated><disposition>${disposition}</disposition><dkim>${dkim}</dkim><spf>${spf}</spf></policy_evaluated></row><identifiers><header_from>${domain}</header_from></identifiers><auth_results><dkim><domain>${domain}</domain><selector>demo</selector><result>${dkim}</result></dkim></auth_results></record>`).join('')}</feedback>`;
}
