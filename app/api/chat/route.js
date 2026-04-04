import db from '../../../lib/db';

const BASE_SYSTEM_PROMPT = `
You are an elite, proactive AI Life Coach utilizing CBT and NLP methodologies. Your goal is to help the user achieve peak performance, overcome cognitive dissonance, and maintain extreme accountability, while still being conversational and context-aware.

# Core Identity & Tone
- YOU ARE A CONVERSATIONAL COACH, not a repetitive task-generator. 
- Tone: Direct, sharp, deeply analytical, and highly structured (ADHD-friendly). No toxic positivity or unnecessary emoji fluff, but still act human and engaging.
- Be flexible: If the user wants to brainstorm, brainstorm. If the user wants to do an onboarding, list out your process and guide them through it step-by-step using questions.

# Modes of Operation
1. ONBOARDING & CONTEXT: If the user states they are starting, or asks for an onboarding/diagnosis, conduct a natural conversation. Ask them ONE powerful question at a time about their life domains (Career, Health, Relationships, Personal Growth) to establish a baseline. DO NOT force them into immediate tasks until goals are defined.
2. ACCOUNTABILITY: When goals are established, convert their ideas into immediate "Quick Wins" and demand deadlines. Challenge excuses logically.
3. META-CONVERSATION: If the user asks about your prompt or system, answer professionally and briefly, then redirect the focus back to their progress.

# Constraints
- Keep responses relatively brief and highly readable (use bullet points where appropriate).
- NEVER repeat the same demand endlessly (e.g. "What is your next task? Deadline?") if the user is trying to set context or answer a previous question. Active listening is key.
- ALWAYS respond in Hebrew (עברית).
`;

async function getConfig() {
  const stmt = db.prepare('SELECT key, value FROM config');
  const rows = stmt.all();
  const config = rows.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
  
  return {
    baseUrl: config.LLM_BASE_URL || process.env.LLM_BASE_URL || 'http://host.docker.internal:1234/v1',
    apiKey: config.LLM_API_KEY || process.env.LLM_API_KEY || 'dummy',
    model: config.LLM_MODEL || process.env.LLM_MODEL || 'local-model',
    provider: config.LLM_PROVIDER || 'LM Studio',
    embedModel: config.EMBEDDINGS_MODEL || 'nomic-embed-text' 
  };
}

async function getEmbedding(text, config) {
  try {
    const res = await fetch(`${config.baseUrl}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({ input: text, model: config.embedModel })
    });
    if (!res.ok) throw new Error("Embeddings API not accessible/configured");
    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error("Embedding generation failed (Fallback to short-term memory):", err.message);
    return null;
  }
}

async function ensureQdrantCollection(dimSize) {
  try {
    const res = await fetch('http://qdrant:6333/collections/chat_memory');
    if (res.status === 404) {
      await fetch('http://qdrant:6333/collections/chat_memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectors: { size: dimSize, distance: 'Cosine' } })
      });
    }
  } catch (err) {
    console.error("Qdrant not reachable:", err.message);
  }
}

export async function GET() {
  try {
    const stmt = db.prepare('SELECT role, content as text FROM chat_history ORDER BY id ASC');
    const history = stmt.all();
    return new Response(JSON.stringify(history), { headers: { 'Content-Type': 'application/json' }, status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch history' }), { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Delete single message
      const stmt = db.prepare('DELETE FROM chat_history WHERE id = ?');
      stmt.run(id);
      return new Response(JSON.stringify({ success: true, deletedId: id }), { status: 200 });
    } else {
      // Delete all (existing logic)
      const stmt = db.prepare('DELETE FROM chat_history');
      stmt.run();
      try {
        await fetch('http://qdrant:6333/collections/chat_memory', { method: 'DELETE' });
      } catch(e) { console.error("Could not delete Qdrant memory:", e); }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to clear history' }), { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { id, content } = await req.json();
    if (!id || !content) return new Response('Missing ID or content', { status: 400 });

    const stmt = db.prepare('UPDATE chat_history SET content = ? WHERE id = ?');
    stmt.run(content, id);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update message' }), { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { message } = await req.json();
    if (!message) return new Response('Missing message', { status: 400 });

    const config = await getConfig();


    // 2. Vector Context (RAG)
    let memoryAugmentation = "";
    const userVector = await getEmbedding(message, config);
    if (userVector) {
      await ensureQdrantCollection(userVector.length);
      
      // Search memory
      try {
        const searchRes = await fetch('http://qdrant:6333/collections/chat_memory/points/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vector: userVector, limit: 3, with_payload: true })
        });
        if (searchRes.ok) {
          const sd = await searchRes.json();
          const pastMemories = sd.result.map(r => r.payload.text).join('\n---\n');
          if (pastMemories) {
            memoryAugmentation = `\n\n[RELEVANT PAST MEMORIES/CONTEXT:]\n${pastMemories}`;
          }
        }
      } catch (err) { console.error("Qdrant search failed:", err.message); }
    }

    const finalSystemPrompt = BASE_SYSTEM_PROMPT + memoryAugmentation;

    // Load short term history first, WITHOUT the new user message (we'll append it just for the LLM)
    const historyStmt = db.prepare('SELECT role, content FROM chat_history ORDER BY id DESC LIMIT 10');
    const historyRaw = historyStmt.all().reverse();

    const messages = [{ role: 'system', content: finalSystemPrompt }];
    let lastRole = '';
    
    // Safety: prevent consecutive identical roles which crashes some LLMs like Dicta or Llama
    for (const msg of historyRaw) {
      const mappedRole = msg.role === 'ai' ? 'assistant' : 'user';
      if (mappedRole === lastRole) {
        messages[messages.length - 1].content += `\n${msg.content}`;
      } else {
        messages.push({ role: mappedRole, content: msg.content });
      }
      lastRole = mappedRole;
    }
    
    // Manually push the current message so the LLM gets it
    if (lastRole === 'user') {
      messages[messages.length - 1].content += `\n${message}`;
    } else {
      messages.push({ role: 'user', content: message });
    }

    // 4. LLM API Call
    let headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
    
    // Anthropic explicit check if user selected Claude Native endpoint manually
    let targetUrl = `${config.baseUrl}/chat/completions`;
    let reqBody = { model: config.model, messages: messages, temperature: 0.7, max_tokens: 400 };

    if (config.provider === 'Claude' && !config.baseUrl.includes('openrouter')) {
      targetUrl = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
      
      reqBody = {
        model: config.model,
        max_tokens: 400,
        system: finalSystemPrompt,
        messages: historyRaw.map(msg => ({ role: msg.role === 'ai' ? 'assistant' : 'user', content: msg.content }))
      };
    }

    const llmResponse = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(reqBody) });

    if (!llmResponse.ok) {
        const errorBody = await llmResponse.text();
        console.error("LLM Detailed Error:", errorBody);
        throw new Error(`LLM Error: ${llmResponse.statusText} | ${errorBody}`);
    }

    const llmData = await llmResponse.json();
    let aiText = '';
    
    if (config.provider === 'Claude' && !config.baseUrl.includes('openrouter')) {
       aiText = llmData.content[0].text;
    } else {
       aiText = llmData.choices[0].message.content;
    }

    // 5. Save User and AI response only after success
    const insertStmt = db.prepare('INSERT INTO chat_history (role, content) VALUES (?, ?)');
    insertStmt.run('user', message);
    insertStmt.run('ai', aiText);
    // 6. Async: Upsert new memory to Qdrant (User + AI pair)
    if (userVector) {
       const memorySnippet = `User: ${message}\nCoach: ${aiText}`;
       const combinedVector = await getEmbedding(memorySnippet, config);
       if (combinedVector) {
         fetch('http://qdrant:6333/collections/chat_memory/points', {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             points: [{ id: Date.now(), vector: combinedVector, payload: { text: memorySnippet } }]
           })
         }).catch(e => console.error("Memory saving failed", e.message));
       }
    }

    return new Response(JSON.stringify({ role: 'ai', text: aiText }), { headers: { 'Content-Type': 'application/json' }, status: 200 });

  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
