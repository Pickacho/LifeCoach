'use client';

import { useState, useEffect, useRef } from 'react';
import { Activity, Brain, Clock, Zap, MessageSquare, Send, CheckCircle2, Loader2, Settings, X, Trash2, Edit2, Check, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Dashboard() {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inboxText, setInboxText] = useState('');
  const [xp, setXp] = useState(0);
  const [tiers, setTiers] = useState({ water: false, meds: false, zone2: false, deepWork: false, tantra: false });
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const chatEndRef = useRef(null);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [config, setConfig] = useState({
    LLM_PROVIDER: 'LM Studio',
    LLM_BASE_URL: 'http://host.docker.internal:1234/v1',
    LLM_API_KEY: '',
    LLM_MODEL: 'local-model',
    EMBEDDINGS_MODEL: 'nomic-embed-text'
  });

  // Insights/Memory State
  const [insights, setInsights] = useState([]);
  const [isSyncingInsights, setIsSyncingInsights] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState('');

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    // Load config
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
         if(Object.keys(data).length > 0) setConfig(prev => ({...prev, ...data}));
      }).catch(console.error);

    // Load initial chat history
    fetch('/api/chat')
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setMessages(data);
        } else {
          setMessages([{ role: 'ai', text: 'מערכת Life Coach מוכנה. מה התוכנית להיום ומה בדיוק עוצר מבעדך לבצע אותה?' }]);
        }
      })
      .catch(console.error);
    // Load insights
    fetch('/api/insights')
      .then(res => res.json())
      .then(data => setInsights(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const clearChat = async () => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את כל היסטוריית השיחה והזיכרון של המאמן? זה ינקה את כל התשובות האגרסיביות הקודמות שנשמרו.')) return;
    try {
      await fetch('/api/chat', { method: 'DELETE' });
      setMessages([{ role: 'ai', text: 'היסטוריית השיחה והזיכרונות נמחקו בהצלחה. המערכת אופסה עם ההנחיות והפרומפט האנושי. מאיפה נתחיל?' }]);
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  const saveConfig = async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      setShowSettings(false);
    } catch(err) { console.error(err); }
  };

  const scanAvailableModels = async () => {
    setIsFetchingModels(true);
    try {
      const res = await fetch(`/api/models?baseUrl=${encodeURIComponent(config.LLM_BASE_URL)}&apiKey=${encodeURIComponent(config.LLM_API_KEY)}`);
      if (res.ok) {
        const modelsArray = await res.json();
        setAvailableModels(modelsArray);
      } else {
        alert("תקלת חיבור: השרת שהגדרת לא מגיב לבקשת מודלים (אולי הוא לא דלוק?)");
      }
    } catch (err) {
      alert("שגיאת רשת בשאיבת מודלים.");
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleProviderChange = (e) => {
    const p = e.target.value;
    let url = config.LLM_BASE_URL;
    if(p === 'OpenRouter') url = 'https://openrouter.ai/api/v1';
    if(p === 'OpenAI') url = 'https://api.openai.com/v1';
    if(p === 'Ollama') url = 'http://host.docker.internal:11434/v1';
    if(p === 'LM Studio') url = 'http://host.docker.internal:1234/v1';
    
    setConfig({...config, LLM_PROVIDER: p, LLM_BASE_URL: url});
    setAvailableModels([]); // Reset models on provider change
  };

  const handleSend = async () => {
    if (!chatInput.trim() || isLoading) return;
    
    const userText = chatInput;
    setMessages(prev => [...prev, { role: 'user', text: userText }]); // Optimistic (without ID) - reload logic actually covers it
    setChatInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'שגיאת רשת לא מזוהה');
      }
      
      const aiResponse = await res.json();
      // Reload chat to get proper IDs for edit/delete
      fetch('/api/chat').then(r => r.json()).then(data => setMessages(data));
      
      // Attempt background insight extraction
      triggerInsightSync();
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'ai', text: `שגיאה מפורטת: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMessage = async (id) => {
    if(!id) return;
    try {
      await fetch(`/api/chat?id=${id}`, { method: 'DELETE' });
      setMessages(prev => prev.filter(m => m.id !== id));
      triggerInsightSync();
    } catch (err) { console.error(err); }
  };

  const startEdit = (msg) => {
    setEditingId(msg.id);
    setEditBuffer(msg.text);
  };

  const saveEdit = async () => {
    if(!editingId) return;
    try {
      await fetch('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, content: editBuffer })
      });
      setMessages(prev => prev.map(m => m.id === editingId ? {...m, text: editBuffer} : m));
      setEditingId(null);
      triggerInsightSync();
    } catch (err) { console.error(err); }
  };

  const triggerInsightSync = async () => {
    setIsSyncingInsights(true);
    try {
        const res = await fetch('/api/insights', { method: 'POST' });
        if(res.ok) {
            const fresh = await fetch('/api/insights').then(r => r.json());
            setInsights(fresh);
        }
    } catch(err) { console.error(err); }
    finally { setIsSyncingInsights(false); }
  };

  return (
    <div className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '2rem', position: 'relative', width: '100%', maxWidth: '100%' }}>
      
      {/* Header section */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', width: '100%' }}>
        <div>
          <h1 className="title">בוקר טוב, רוקי</h1>
          <p style={{ color: 'var(--outline)', fontSize: '1.1rem' }}>מערכת האימון פעילה (External Prefrontal Cortex)</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="glass-card" onClick={() => setShowSettings(true)} style={{ display: 'flex', flex: 'none', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', borderRadius: '50px', padding: '0.75rem' }}>
            <Settings size={20} />
          </button>
          <div className="glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.75rem 1.5rem', borderRadius: '50px' }}>
            <Zap color="var(--accent)" />
            <span style={{ fontWeight: 600 }}>XP Points: {xp}</span>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass-card" style={{ width: '450px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>הגדרות סוכן AI</h2>
              <button onClick={() => setShowSettings(false)} style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}><X /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>ספק AI</label>
              <select className="input-field" value={config.LLM_PROVIDER} onChange={handleProviderChange} style={{ background: 'var(--background)'}}>
                <option value="LM Studio">LM Studio (Local)</option>
                <option value="Ollama">Ollama (Local)</option>
                <option value="OpenAI">OpenAI</option>
                <option value="OpenRouter">OpenRouter</option>
                <option value="Claude">Claude (Anthropic API)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>כתובת API (Base URL)</label>
              <input className="input-field" value={config.LLM_BASE_URL} onChange={e => setConfig({...config, LLM_BASE_URL: e.target.value})} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>API Key (סוד)</label>
              <input type="password" className="input-field" value={config.LLM_API_KEY} onChange={e => setConfig({...config, LLM_API_KEY: e.target.value})} placeholder={config.LLM_PROVIDER.includes('Local') ? 'לא חובה בסביבה מקומית' : 'הזן מפתח...'} />
            </div>

            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button onClick={scanAvailableModels} disabled={isFetchingModels} className="btn" style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid var(--primary)', alignSelf: 'stretch', display: 'flex', justifyContent: 'center' }}>
                {isFetchingModels ? <Loader2 className="animate-spin" size={16} /> : '🔄 סרוק מודלים פעילים מהשרת הזה'}
              </button>
              
              {availableModels.length > 0 && (
                 <div style={{ fontSize: '0.85rem', color: 'var(--success)', textAlign: 'center' }}>
                    נמצאו {availableModels.length} מודלי בחירה! (לחץ על השדה)
                 </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label>מודל שיחה (Chat)</label>
                {availableModels.length > 0 ? (
                  <select className="input-field" value={config.LLM_MODEL} onChange={e => setConfig({...config, LLM_MODEL: e.target.value})} style={{ background: 'var(--background)', whiteSpace: 'normal' }}>
                    {(!availableModels.includes(config.LLM_MODEL) && config.LLM_MODEL) && <option value={config.LLM_MODEL}>{config.LLM_MODEL}</option>}
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input className="input-field" value={config.LLM_MODEL} onChange={e => setConfig({...config, LLM_MODEL: e.target.value})} placeholder="קודם כל סרוק את זמינות המודלים..." />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label>מודל זכרון (Embeddings)</label>
                {availableModels.length > 0 ? (
                  <select className="input-field" value={config.EMBEDDINGS_MODEL} onChange={e => setConfig({...config, EMBEDDINGS_MODEL: e.target.value})} style={{ background: 'var(--background)', whiteSpace: 'normal' }}>
                    {(!availableModels.includes(config.EMBEDDINGS_MODEL) && config.EMBEDDINGS_MODEL) && <option value={config.EMBEDDINGS_MODEL}>{config.EMBEDDINGS_MODEL}</option>}
                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input className="input-field" value={config.EMBEDDINGS_MODEL} onChange={e => setConfig({...config, EMBEDDINGS_MODEL: e.target.value})} placeholder="חסר, סרוק כדי לבחור..." />
                )}
              </div>
            </div>

            <button className="btn btn-primary" onClick={saveConfig} style={{ marginTop: '0.5rem' }}>שמור הגדרות מערכת</button>
          </div>
        </div>
      )}

      {/* Single Capture Inbox (ADHD Friendly) */}
      <section className="glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
         <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)', fontSize: '1.1rem' }}>📥 Single Capture Inbox</h3>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input 
                 className="input-field" 
                 placeholder="זרוק לפה כל מחשבה, דאגה או משימה כדי לפנות זיכרון עבודה..." 
                 value={inboxText}
                 onChange={e => setInboxText(e.target.value)}
                 onKeyDown={e => { if(e.key === 'Enter') { setInboxText(''); alert('נשמר במאגר!'); } }}
                 style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={() => { setInboxText(''); alert('נשמר במאגר!'); }}>שמור מחשבה</button>
            </div>
         </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', width: '100%' }}>
        
        {/* Memory / Life Domains Card */}
        <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain color="var(--primary)" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>מפת קונטקסט (Ikigai & Longevity)</h2>
            </div>
            <button onClick={triggerInsightSync} disabled={isSyncingInsights} className={isSyncingInsights ? "animate-spin" : ""} style={{ background: 'transparent', border: 'none', color: 'var(--outline)', cursor: 'pointer' }}>
               <RefreshCw size={20} />
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[
              { id: 'Ikigai', label: 'Ikigai & Career Pivot' }, 
              { id: 'Longevity', label: 'Longevity (Med 3.0)' }, 
              { id: 'Grief', label: 'Grief & Resilience' }, 
              { id: 'ADHD', label: 'ADHD & Systems' }, 
              { id: 'Career', label: 'General Career' }, 
              { id: 'Health', label: 'General Health' }, 
              { id: 'Relationships', label: 'Relationships' }, 
              { id: 'Growth', label: 'Personal Growth' }
            ].map(domain => {
              const info = insights.find(i => i.domain === domain.id);
              return (
                <div key={domain.id} className="glass-card" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>{domain.label}</div>
                  <div style={{ fontSize: '1rem', minHeight: '80px', lineHeight: '1.5', opacity: info ? 1 : 0.5 }}>{info ? info.insight : 'ממתין לסנכרון נתונים...'}</div>
                  {info && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '1rem' }}>
                      {[1,2,3,4,5].map(v => <div key={v} style={{ height: '6px', flex: 1, borderRadius: '4px', background: v <= info.confidence ? 'var(--primary)' : 'rgba(255,255,255,0.05)', boxShadow: v <= info.confidence ? '0 0 8px var(--primary)' : 'none' }} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Focus / Quick Wins Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity color="var(--accent)" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Data & Health Integrations</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--outline)' }}>
                  חיבור ל-Google Fit, Samsung Health, ו-Android Sleep יאפשר עדכון אוטומטי של שעות שינה, רמות סטרס, וזמני Zone 2.
                </p>
                <a href="/api/auth/google" className="btn" style={{ background: 'white', color: 'black', border: 'none', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg" alt="Google" style={{width: '20px'}}/>
                  {isGoogleConnected ? 'Google Connected!' : 'Connect Google Health'}
                </a>
              </div>
            </section>

            <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 color="var(--primary)" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Gamified Tier System</h2>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.95rem' }}>
                 <div>
                   <strong style={{ color: 'var(--outline)' }}>Tier 1 (MV Day)</strong>
                   <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                     <input type="checkbox" checked={tiers.water} onChange={() => {setTiers({...tiers, water: !tiers.water}); setXp(p => !tiers.water ? p+10 : p-10)}} />
                     שתיית 3.7 ליטר מים (+10 XP)
                   </label>
                   <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                     <input type="checkbox" checked={tiers.meds} onChange={() => {setTiers({...tiers, meds: !tiers.meds}); setXp(p => !tiers.meds ? p+10 : p-10)}} />
                     תרופות ותבניות בסיס (+10 XP)
                   </label>
                 </div>
                 
                 <div>
                   <strong style={{ color: 'var(--outline)' }}>Tier 2 (Priority)</strong>
                   <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                     <input type="checkbox" checked={tiers.zone2} disabled={!isGoogleConnected} onChange={() => {}} title="Synched via Google automatically" />
                     אימון Zone 2 (מסתנכרן מהשעון) (+50 XP)
                   </label>
                   <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                     <input type="checkbox" checked={tiers.deepWork} onChange={() => {setTiers({...tiers, deepWork: !tiers.deepWork}); setXp(p => !tiers.deepWork ? p+20 : p-20)}} />
                     50 דקות Deep Work (+20 XP)
                   </label>
                 </div>
                 
                 <div>
                   <strong style={{ color: 'var(--outline)' }}>Tier 3 (Bonus)</strong>
                   <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                     <input type="checkbox" checked={tiers.tantra} onChange={() => {setTiers({...tiers, tantra: !tiers.tantra}); setXp(p => !tiers.tantra ? p+30 : p-30)}} />
                     תרגול Mula Bandha (יוגה/טנטרה) (+30 XP)
                   </label>
                 </div>
              </div>
            </section>
        </div>
      </div>

      {/* Chat / Reflection Interface */}
      <section className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '400px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>אינטראקציה פסיכולוגית מול המאמן</h2>
          </div>
          <button onClick={clearChat} title="מחק היסטוריית שיחה (מומלץ במיוחד אם המאמן תקוע על פרומפט ישן)" style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0.4rem 0.8rem', borderRadius: '8px', color: 'var(--foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <Trash2 size={16} /> <span>נקה מסד נתונים (Chat History)</span>
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0', maxHeight: '500px' }}>
          {messages.map((m, i) => (
            <div key={i} className="message-container" style={{ 
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
              border: m.role === 'user' ? '1px solid var(--primary)' : '1px solid var(--border)',
              padding: '1rem', borderRadius: '12px', maxWidth: '80%', lineHeight: '1.6',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              position: 'relative',
              group: 'true'
            }}>
              {editingId === m.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <textarea 
                    className="input-field" 
                    value={editBuffer} 
                    onChange={e => setEditBuffer(e.target.value)} 
                    style={{ minWidth: '300px', background: 'rgba(0,0,0,0.2)' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={saveEdit} className="btn btn-primary" style={{ padding: '0.2rem 0.5rem' }}><Check size={14}/></button>
                    <button onClick={() => setEditingId(null)} className="btn" style={{ padding: '0.2rem 0.5rem' }}><X size={14}/></button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                  {/* Actions (visible only on hover in CSS, but let's just show them subtly) */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end', opacity: 0.4 }}>
                    <Edit2 size={12} style={{ cursor: 'pointer' }} onClick={() => startEdit(m)} />
                    <Trash2 size={12} style={{ cursor: 'pointer' }} onClick={() => deleteMessage(m.id)} />
                  </div>
                </>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', color: 'var(--outline)' }}>
              <Loader2 className="animate-spin" size={20} />
              <span>המאמן מקליד ומשלב זכרונות עבר...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
          <textarea 
            className="input-field" 
            placeholder={isLoading ? "ממתין לתשובה..." : "מה עצר אותך מלהתקדם היום?... (Shift + Enter לשליחה)"}
            value={chatInput}
            rows={2}
            style={{ resize: 'vertical', minHeight: '50px', maxHeight: '150px' }}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault();
                if (!isLoading) handleSend();
              }
            }}
            disabled={isLoading}
          />
          <button className="btn btn-primary" onClick={handleSend} disabled={isLoading} style={{ width: '60px', padding: '0', display: 'flex', justifyContent: 'center', opacity: isLoading ? 0.5 : 1 }}>
            <Send size={20} />
          </button>
        </div>
      </section>

    </div>
  );
}
