// N+1 query loop fixture
for (const id of ids) { await db.query('SELECT * FROM items WHERE user_id = ' + id); }
