export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const baseUrl = searchParams.get('baseUrl') || 'http://host.docker.internal:1234/v1';
  const apiKey = searchParams.get('apiKey') || '';

  try {
    const res = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${apiKey}`, 
        'Content-Type': 'application/json' 
      }
    });
    
    if (!res.ok) {
        throw new Error(`Model fetch failed with status ${res.status}`);
    }
    
    const data = await res.json();
    
    // Most OpenAI compatible servers return { data: [ { id: 'model_name' }, ... ] }
    if (data && data.data && Array.isArray(data.data)) {
        const modelNames = data.data.map(m => m.id);
        return new Response(JSON.stringify(modelNames), { status: 200 });
    } else {
        throw new Error("Unexpected API schema");
    }
    
  } catch (err) {
    console.error("Models API Proxy Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
