import db from '../../../lib/db';

async function getConfig() {
  const stmt = db.prepare('SELECT key, value FROM config');
  const rows = stmt.all();
  const config = rows.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
  
  return {
    baseUrl: config.LLM_BASE_URL || process.env.LLM_BASE_URL || 'http://host.docker.internal:1234/v1',
    apiKey: config.LLM_API_KEY || process.env.LLM_API_KEY || 'dummy',
    model: config.LLM_MODEL || process.env.LLM_MODEL || 'local-model'
  };
}

export async function GET() {
  try {
    const stmt = db.prepare('SELECT * FROM user_insights ORDER BY last_updated DESC');
    const insights = stmt.all();
    return new Response(JSON.stringify(insights), { headers: { 'Content-Type': 'application/json' }, status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function POST() {
  try {
    const config = await getConfig();
    
    // 1. Get entire chat history
    const historyStmt = db.prepare('SELECT role, content FROM chat_history ORDER BY id ASC LIMIT 50');
    const history = historyStmt.all();
    
    if (history.length === 0) {
        return new Response(JSON.stringify({ message: 'No history to analyze' }), { status: 200 });
    }

    const conversationText = history.map(h => `${h.role}: ${h.content}`).join('\n');

    const prompt = `
You are a psychologist analyzing a conversation between a Life Coach and a Client.
Your task is to extract exactly 8 insights based on the user's specific life strategy framework.
LIFE STRATEGY DOMAINS (Use EXACTLY the keys in quotes):
- "Ikigai" (Focus, 'Flow' states, micro-experiments for career)
- "Longevity" (Zone 2 cardio, Uric acid/Asthma tracking, Stability)
- "Grief" (Action over talking, MV Day adherence)
- "ADHD" (Use of external systems, cognitive load management)
- "Career" (General Career & Finance)
- "Health" (General Physical & Mental Health)
- "Relationships" (General Relationships & Social)
- "Growth" (General Personal Growth & Purpose)

Analyze the history below and output a JSON array of 8 objects with keys: "domain", "insight", "confidence" (1-5).
Ensure the "domain" value exactly matches the keys provided above (e.g., "Ikigai").
ONLY OUTPUT THE JSON. NOTHING ELSE. No markdown formatting around the JSON, just the raw array.
If you know nothing about a domain, write "No data yet".

CONVERSATION:
${conversationText}
    `;

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!res.ok) throw new Error("LLM Analysis failed");
    
    const data = await res.json();
    let analysisResult;
    try {
        let jsonStr = data.choices[0].message.content.trim();
        // Remove markdown codeblock formatting if present
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.replace(/^```json/, '');
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```/, '');
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.replace(/```$/, '');
        jsonStr = jsonStr.trim();
        
        try {
           analysisResult = JSON.parse(jsonStr);
        } catch(parseErr) {
           // Fallback to regex extraction of array if there's pre/post conversational text
           const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
           if (!jsonMatch) throw parseErr;
           analysisResult = JSON.parse(jsonMatch[0]);
        }
    } catch(e) {
        throw new Error("Failed to parse LLM insight JSON: " + data.choices[0].message.content);
    }

    // 2. Clear old insights and insert new ones (Transaction)
    const del = db.prepare('DELETE FROM user_insights');
    const insert = db.prepare('INSERT INTO user_insights (domain, insight, confidence) VALUES (?, ?, ?)');
    
    const runTransaction = db.transaction((data) => {
      del.run();
      for (const item of data) {
        insert.run(item.domain, item.insight, item.confidence);
      }
    });

    runTransaction(analysisResult);

    return new Response(JSON.stringify({ success: true, insights: analysisResult }), { status: 200 });

  } catch (error) {
    console.error('Insights synthesis error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
