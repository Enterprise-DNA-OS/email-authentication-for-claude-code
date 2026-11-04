import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {demoXml,parseAggregate} from './lib/aggregate.mjs';
import {ingest} from './auth.mjs';
export async function seed(db){
 await db.exec('BEGIN');try{
 await db.exec(fs.readFileSync(path.join(REPO_ROOT,'supabase/seed.sql'),'utf8'));
 for(const spec of [{key:'demo-harbour'},{domain:'ridge.example',key:'demo-ridge',days:40,rows:[['203.0.113.30',22,'pass','fail','none']]}]){
  const exists=await db.query('select id from reports where report_key=$1',[spec.key]);if(!exists.length)await ingest(db,parseAggregate(Buffer.from(demoXml(spec))),'Synthetic demo');
 }
 await db.exec('COMMIT');return {demo:'seeded',synthetic:true};
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const db=await getDb();try{console.log(await seed(db));}finally{await db.close();}}
