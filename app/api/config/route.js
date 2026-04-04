import db from '../../../lib/db';

export async function GET() {
  try {
    const stmt = db.prepare('SELECT key, value FROM config');
    const rows = stmt.all();
    
    // Reduce array to object
    const config = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    return new Response(JSON.stringify(config), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to fetch config' }), { status: 500 });
  }
}

export async function POST(req) {
  try {
    const configData = await req.json();
    
    // Using transaction for safe multiple inserts/updates
    const insert = db.prepare('INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const transaction = db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        insert.run(key, value);
      }
    });

    transaction(configData);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    console.error('Config API Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to save config' }), { status: 500 });
  }
}
