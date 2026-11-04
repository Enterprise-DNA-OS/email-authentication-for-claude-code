import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {isIP} from 'node:net';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {domainName,parseAggregate,MAX_BYTES} from './lib/aggregate.mjs';
import {table as textTable} from './lib/format.mjs';
import {page,table} from './lib/render.mjs';
export const reads={
 domains:'select name as domain,owner,policy,purpose,retention_review from domains order by name',
 reports:'select r.id,d.name as domain,r.reporter,r.report_key,r.period_start,r.period_end,r.policy from reports r join domains d on d.id=r.domain_id order by period_end desc,domain',
 sources:'select domain,ip,service,decision,messages_30d,failures_30d,review_by from source_health order by domain,ip',
 failures:'select domain,ip,service,decision,messages_30d,failures_30d from source_health where failures_30d>0 order by failures_30d desc,domain,ip',
 'unknown-senders':"select domain,ip,service,decision,messages_30d,failures_30d from source_health where decision='unknown' order by domain,ip",
 'quiet-senders':"select domain,ip,service,last_seen,review_by from source_health where last_seen is null or last_seen<now()-interval '30 days' order by domain,ip",
 coverage:'select domain,owner,reports,last_report,coverage from report_coverage order by domain',
 'policy-review':'select * from domain_summary order by domain',
 investigations:'select code,domain,title,owner,due,status,outcome from investigation_queue order by due,code',
 overdue:"select code,domain,title,owner,due from investigation_queue where attention='overdue' order by due,code",
 compliance:`select name as subject,'missing purpose' as issue,'NZ IPP 1' as rule from domains where purpose=''
 UNION ALL select name,'retention review due','NZ IPP 9; local review schedule' from domains where retention_review is null or retention_review<current_date
 UNION ALL select domain||' / '||ip,'sender review due','Local review schedule' from source_health where decision='unknown' or review_by is null or review_by<current_date
 UNION ALL select domain,'report coverage '||coverage,'RFC 9990; local three-day threshold' from report_coverage where coverage<>'recent' order by subject,issue`,
 activity:'select actor,action,subject,created_at from activity order by created_at,id',
 summary:'select * from domain_summary order by domain'
};
export const usage={...Object.fromEntries(Object.keys(reads).map(k=>[k,k])),
 domain:'domain <name-or-id-prefix>', report:'report <id-prefix-or-report-key>',
 'add-domain':'add-domain <domain> --owner=NAME --purpose=TEXT --review-by=YYYY-MM-DD --actor=NAME',
 'review-domain':'review-domain <domain> --owner=NAME --purpose=TEXT --review-by=YYYY-MM-DD --actor=NAME',
 'review-sender':'review-sender <domain> <ip> --service=NAME --decision=approved|blocked|unknown --evidence=TEXT --review-by=YYYY-MM-DD --actor=NAME',
 'record-policy':'record-policy <domain> --policy=none|quarantine|reject --observed-at=ISO --evidence=TEXT --actor=NAME',
 'log-investigation':'log-investigation <domain> --code=CODE --title=TEXT --owner=NAME --due=YYYY-MM-DD --evidence=TEXT --actor=NAME',
 'close-investigation':'close-investigation <code-or-id-prefix> --outcome=TEXT --actor=NAME',
 import:'import dmarc-global <saved.xml|saved.xml.gz> --actor=NAME [--dry-run]',
 export:'export --out=NEW-FILE.json',
 'draft-domain':'draft-domain <domain> --actor=NAME',
 'draft-policy':'draft-policy <domain> --policy=none|quarantine|reject --rationale=TEXT --actor=NAME',
 'weekly-review':'weekly-review --actor=NAME', help:'help'
};
const flags={
 'add-domain':['owner','purpose','review-by','actor'], 'review-domain':['owner','purpose','review-by','actor'],
 'review-sender':['service','decision','evidence','review-by','actor'], 'record-policy':['policy','observed-at','evidence','actor'],
 'log-investigation':['code','title','owner','due','evidence','actor'],'close-investigation':['outcome','actor'],
 import:['actor','dry-run'],export:['out'],'draft-domain':['actor'],'draft-policy':['policy','rationale','actor'],'weekly-review':['actor']
};
const counts={domain:1,report:1,'add-domain':1,'review-domain':1,'review-sender':2,'record-policy':1,'log-investigation':1,'close-investigation':1,import:2,'draft-domain':1,'draft-policy':1};
function parse(args){
 const cmd=args[0]||'help';if(!usage[cmd])throw Error(`Unknown command: ${cmd}`);const opts={},pos=[];
 for(const a of args.slice(1)){
  if(!a.startsWith('--')){pos.push(a);continue;}const ix=a.indexOf('='),key=a.slice(2,ix<0?undefined:ix),value=ix<0?true:a.slice(ix+1);
  if(!['json',...(flags[cmd]||[])].includes(key))throw Error(`Unknown flag --${key}`);
  if(key in opts)throw Error(`Repeated flag --${key}`);
  if(['json','dry-run'].includes(key)&&value!==true)throw Error(`--${key} takes no value`);
  opts[key]=value;
 }
 if(pos.length!==(counts[cmd]||0))throw Error(`Usage: ${usage[cmd]}`);
 return {cmd,opts,pos};
}
function required(o,k){const v=o[k];if(typeof v!=='string'||!v.trim())throw Error(`--${k} is required`);if(v.length>10000)throw Error(`--${k} is too long`);return v.trim();}
function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Expected a valid YYYY-MM-DD date');return v;}
function reviewDate(v){date(v);if(v<new Date().toISOString().slice(0,10))throw Error('Review date must be today or later');return v;}
function policy(o){const s=required(o,'policy');if(!['none','quarantine','reject'].includes(s))throw Error('Invalid policy');return s;}
async function resolve(db,table,q,label){
 const labelCol={domains:'name',reports:'report_key',investigations:'code'}[table];if(!labelCol)throw Error('Invalid lookup');
 const all=await db.query(`select * from ${table} order by ${labelCol}`);const s=String(q).toLowerCase();
 const exact=all.filter(r=>String(r[labelCol]).toLowerCase()===s||r.id===s);const found=exact.length?exact:all.filter(r=>r.id.startsWith(s)||String(r[labelCol]).toLowerCase().includes(s));
 if(found.length!==1)throw Error(`${found.length?'Ambiguous':'No matching'} ${label}: ${found.map(r=>r[labelCol]+' '+r.id).join(', ')}`);
 return found[0];
}
const audit=(db,actor,action,subject,detail={})=>db.query('insert into activity(actor,action,subject,detail) values($1,$2,$3,$4)',[actor,action,subject,JSON.stringify(detail)]);
export async function ingest(db,a,actor,{dryRun=false}={}){
 const ds=await db.query('select * from domains where name=$1',[a.domain]);if(!ds.length)throw Error(`Register the exact policy domain first: ${a.domain}`);const d=ds[0];
 const old=await db.query('select sha256 from reports where domain_id=$1 and reporter=$2 and report_key=$3',[d.id,a.reporter,a.key]);
 if(old.length){if(old[0].sha256!==a.sha256)throw Error('Conflicting report identity: inspect the original before importing');return {status:'duplicate',domain:a.domain,report:a.key,records:a.rows.length,messages:a.total};}
 const overlaps=await db.query('select report_key from reports where domain_id=$1 and reporter=$2 and period_start<$4::timestamptz and period_end>$3::timestamptz',[d.id,a.reporter,a.start,a.end]);
 if(overlaps.length)throw Error('Overlapping report period from the same receiver: reconcile before importing');
 if(dryRun)return {status:'validated',domain:a.domain,report:a.key,records:a.rows.length,messages:a.total};
 const [r]=await db.query('insert into reports(domain_id,reporter,reporter_email,report_key,period_start,period_end,policy,sha256,original_xml,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id',[d.id,a.reporter,a.email,a.key,a.start,a.end,a.policy,a.sha256,a.xml,JSON.stringify(a.metadata)]);
 for(const o of a.rows){
  await db.query('insert into sources(domain_id,ip) values($1,$2) on conflict(domain_id,ip) do nothing',[d.id,o.ip]);
  const [s]=await db.query('select id from sources where domain_id=$1 and ip=$2',[d.id,o.ip]);
  await db.query('insert into observations(report_id,source_id,ordinal,messages,header_from,spf,dkim,disposition,raw_record) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[r.id,s.id,o.ordinal,o.messages,o.header_from,o.spf,o.dkim,o.disposition,JSON.stringify(o.raw)]);
 }
 await audit(db,actor,'import',a.domain,{report:a.key,sha256:a.sha256,rows:a.rows.length});
 return {status:'imported',domain:a.domain,report:a.key,records:a.rows.length,messages:a.total};
}
async function atomic(db,fn){await db.exec('BEGIN');try{const out=await fn();await db.exec('COMMIT');return out;}catch(e){await db.exec('ROLLBACK');throw e;}}
function newFile(file,contents){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,contents,{flag:'wx',mode:0o600});return file;}
function draftFile(name,html){return newFile(path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts',`${name}-${randomUUID()}.html`),html);}
export async function run(db,args){
 const {cmd,opts:o,pos}=parse(args);
 if(cmd==='help')return Object.values(usage).map(command=>({command}));
 if(reads[cmd])return db.query(reads[cmd]);
 if(cmd==='domain'){
  const d=await resolve(db,'domains',pos[0],'domain');return {domain:d,sources:await db.query('select * from source_health where domain=$1 order by ip',[d.name]),investigations:await db.query('select * from investigation_queue where domain=$1 order by due,code',[d.name])};
 }
 if(cmd==='report'){
  const r=await resolve(db,'reports',pos[0],'report');return {report:r,observations:await db.query('select o.*,host(s.ip) as ip from observations o join sources s on s.id=o.source_id where report_id=$1 order by ordinal',[r.id])};
 }
 if(cmd==='export'){
  const result={format:'email-authentication-v1',exported_at:new Date().toISOString(),tables:{}};
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try{for(const t of ['domains','sources','reports','observations','investigations','policy_reviews','activity'])result.tables[t]=await db.query(`select * from ${t} order by id`);}finally{await db.exec('ROLLBACK');}
  return {file:newFile(path.resolve(required(o,'out')),JSON.stringify(result,null,2)+'\n'),records:Object.values(result.tables).reduce((n,r)=>n+r.length,0)};
 }
 const actor=required(o,'actor');
 if(cmd==='import'){
  if(pos[0]!=='dmarc-global')throw Error('Import supports dmarc-global retained aggregate XML only');
  const f=path.resolve(pos[1]);if(fs.statSync(f).size>MAX_BYTES)throw Error('Report exceeds 5 MiB limit');const a=parseAggregate(fs.readFileSync(f));
  return atomic(db,()=>ingest(db,a,actor,{dryRun:!!o['dry-run']}));
 }
 if(cmd==='weekly-review'){
  const sections=[];for(const name of ['policy-review','unknown-senders','overdue'])sections.push({title:name,html:table(await db.query(reads[name]))});
  const file=draftFile('weekly-review',page({title:'Weekly email authentication review',subtitle:'Private draft. Reports are receiver observations, not proof of delivery.',sections}));
  await audit(db,actor,cmd,'portfolio',{file:path.basename(file)});return {file};
 }
 return atomic(db,async()=>{
  let result;
  if(cmd==='add-domain'){
   const name=domainName(pos[0]);const [d]=await db.query('insert into domains(name,owner,purpose,retention_review) values($1,$2,$3,$4) returning id,name',[name,required(o,'owner'),required(o,'purpose'),reviewDate(required(o,'review-by'))]);result=d;
  }else if(cmd==='close-investigation'){
   const c=await resolve(db,'investigations',pos[0],'investigation');if(c.status!=='open')throw Error('Investigation is already closed');
   [result]=await db.query("update investigations set status='closed',outcome=$2,closed_at=now() where id=$1 returning code,status,outcome",[c.id,required(o,'outcome')]);
  }else{
   const d=await resolve(db,'domains',pos[0],'domain');
   if(cmd==='review-domain'){
    [result]=await db.query('update domains set owner=$2,purpose=$3,retention_review=$4 where id=$1 returning name,owner,purpose,retention_review',[d.id,required(o,'owner'),required(o,'purpose'),reviewDate(required(o,'review-by'))]);
   }else if(cmd==='review-sender'){
    if(!isIP(pos[1]))throw Error('Invalid source IP');const decision=required(o,'decision');if(!['approved','blocked','unknown'].includes(decision))throw Error('Invalid decision');
    const s=await db.query('select id from sources where domain_id=$1 and ip=$2',[d.id,pos[1]]);if(!s.length)throw Error('Source has no report history for this domain');
    [result]=await db.query('update sources set service=$2,decision=$3,evidence=$4,reviewer=$5,review_by=$6 where id=$1 returning id,service,decision,review_by',[s[0].id,required(o,'service'),decision,required(o,'evidence'),actor,reviewDate(required(o,'review-by'))]);
   }else if(cmd==='record-policy'){
    const observed=required(o,'observed-at');if(!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(observed)||Number.isNaN(Date.parse(observed))||Date.parse(observed)>Date.now())throw Error('Policy observation needs a nonfuture ISO timestamp with timezone');
    if(d.policy_observed_at&&Date.parse(observed)<new Date(d.policy_observed_at).getTime())throw Error('Policy observation is older than the current observation');
    [result]=await db.query('update domains set policy=$2,policy_observed_at=$3,policy_evidence=$4 where id=$1 returning name,policy,policy_observed_at',[d.id,policy(o),observed,required(o,'evidence')]);
   }else if(cmd==='log-investigation'){
    const code=required(o,'code');if(!/^[A-Za-z0-9-]{1,64}$/.test(code))throw Error('Invalid investigation code');
    [result]=await db.query('insert into investigations(code,domain_id,title,owner,due,evidence) values($1,$2,$3,$4,$5,$6) returning code,title,owner,due',[code,d.id,required(o,'title'),required(o,'owner'),date(required(o,'due')),required(o,'evidence')]);
   }else if(['draft-domain','draft-policy'].includes(cmd)){
    const health=await db.query('select * from domain_summary where domain=$1',[d.name]);
    const sourceRows=await db.query('select domain,ip,service,decision,messages_30d,failures_30d,review_by from source_health where domain=$1 order by ip',[d.name]);
    const cases=await db.query("select code,title,owner,due from investigation_queue where domain=$1 and status='open' order by due",[d.name]);
    const notes=['Counts reflect retained reports and may not cover all mail. A pass does not prove inbox delivery. Sender approval is an operator decision, not authentication.'];
    let title='Domain authentication review';
    if(cmd==='draft-policy'){
     const proposed=policy(o),rationale=required(o,'rationale');title='Policy change review draft';
     notes.push(`Proposed policy: ${proposed}. Rationale: ${rationale}. Review all listed gaps and confirm legitimate services before any separately authorised DNS change. This draft is not approval and changes nothing.`);
     await db.query('insert into policy_reviews(domain_id,proposed_policy,actor,rationale,snapshot) values($1,$2,$3,$4,$5)',[d.id,proposed,actor,rationale,JSON.stringify({health,sourceRows,cases,policy_observed_at:d.policy_observed_at})]);
    }
    const file=draftFile(cmd,page({title,subtitle:d.name,sections:[{title:'Scope and decisions',note:notes.join(' '),html:''},{title:'Domain',html:table(health)},{title:'Sending sources',html:table(sourceRows)},{title:'Open investigations',html:table(cases)}]}));result={file};
   }else throw Error('Unsupported command');
  }
  await audit(db,actor,cmd,pos.join(' '),{inputs:o,result});return result;
 });
}
function display(result){
 if(Array.isArray(result)){if(!result.length)return '(none)';return textTable(result,Object.keys(result[0]).map(key=>({key,label:key,format:v=>v instanceof Date?v.toISOString():v===null?'':typeof v==='object'?JSON.stringify(v):v})));}
 return JSON.stringify(result,null,2);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result):display(result));}
 catch(e){if(process.argv.includes('--json'))console.error(JSON.stringify({error:e.message}));else console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}
}
