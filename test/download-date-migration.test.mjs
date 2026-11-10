import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
test('download date migration preserves undated history, records only new increments, and remains compatible with the previous writer',()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_download_counts.sql','utf8'));db.prepare('INSERT INTO download_counts VALUES (?,?,?,?)').run('life-secrets','sample',120,'2026-10-01T12:00:00.000Z');
 const sql=readFileSync('drizzle/0013_download_date_filters.sql','utf8');db.exec(sql);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM download_daily_counts').get().n,0,'old totals cannot be assigned to the last updated date');const started=db.prepare('SELECT started_at FROM download_date_tracking').get().started_at;
 db.prepare('UPDATE download_counts SET download_count=download_count+1,updated_at=? WHERE book_id=? AND kind=?').run('2026-11-01T22:00:00.000Z','life-secrets','sample');
 assert.equal(db.prepare('SELECT download_count FROM download_counts').get().download_count,121);const row=db.prepare('SELECT * FROM download_daily_counts').get();assert.equal(row.day,'2026-11-02');assert.equal(row.download_count,1);
 db.exec(sql);assert.equal(db.prepare('SELECT started_at FROM download_date_tracking').get().started_at,started);assert.equal(db.prepare('SELECT download_count FROM download_daily_counts').get().download_count,1);
 db.close();
});
