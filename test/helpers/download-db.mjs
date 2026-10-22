import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function createDownloadDB(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../../drizzle/0000_download_counts.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../../drizzle/0001_testing_events.sql',import.meta.url),'utf8'));
 return {prepare(sql){const s=db.prepare(sql);let values=[];const p={bind(...args){values=args;return p},async run(){s.run(...values);return {success:true}},async all(){return {results:s.all(...values)}}};return p},rows(){return db.prepare('SELECT * FROM download_counts ORDER BY book_id, kind').all()}};
}
