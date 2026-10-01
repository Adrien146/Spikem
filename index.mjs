import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 8787);
const mode = process.env.PEACH_ENV || 'sandbox';
const isSandbox = mode !== 'live';
const authBase = process.env.PEACH_AUTH_URL || (isSandbox ? 'https://sandbox-dashboard.peachpayments.com' : 'https://dashboard.peachpayments.com');
const checkoutBase = process.env.PEACH_CHECKOUT_URL || (isSandbox ? 'https://testsecure.peachpayments.com' : 'https://secure.peachpayments.com');
const clientId = process.env.PEACH_CLIENT_ID || '';
const clientSecret = process.env.PEACH_CLIENT_SECRET || '';
const merchantId = process.env.PEACH_MERCHANT_ID || '';
const entityId = process.env.PEACH_ENTITY_ID || '';
const webhookSecret = process.env.PEACH_WEBHOOK_SECRET || '';
const recurringToken = process.env.PEACH_RECURRING_ACCESS_TOKEN || '';
const cronSecret = process.env.SPIKE_CRON_SECRET || '';
const ownerSecret = process.env.SPIKE_OWNER_SECRET || '';
const ownerHeader = 'x-spike-owner-secret';
const openaiKey = process.env.OPENAI_API_KEY || '';
const openaiModel = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const creatorId = process.env.SPIKE_CREATOR_ID || 'evans-muyomba';
const creatorName = process.env.SPIKE_CREATOR_NAME || 'Evans Muyomba';
const creatorProject = process.env.SPIKE_CREATOR_PROJECT || 'SPIKE Growth Intelligence';
const creatorEmail = process.env.SPIKE_CREATOR_EMAIL || 'adriensmith142@gmail.com';
const creatorBackupEmails = ['nsindisod04@gmail.com','nsindisod228@gmail.com'];
const dataDir = path.resolve(process.env.SPIKE_DATA_DIR || path.join(root, 'data'));
const bindHost = process.env.HOST || '0.0.0.0';
const subscriptionsFile = path.join(dataDir, 'subscriptions.json');
const usageFile = path.join(dataDir, 'usage.json');
const feedbackFile = path.join(dataDir, 'feedback.json');
const publicBase = (process.env.SPIKE_PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, '');
const priceUsd = 10;
fs.mkdirSync(dataDir, {recursive:true});
if(!fs.existsSync(subscriptionsFile)) fs.writeFileSync(subscriptionsFile, '{}');
if(!fs.existsSync(usageFile)) fs.writeFileSync(usageFile, '{}');
if(!fs.existsSync(feedbackFile)) fs.writeFileSync(feedbackFile, '[]');
const loadSubs=()=>{try{return JSON.parse(fs.readFileSync(subscriptionsFile,'utf8')||'{}')}catch{return {}}};
const saveSubs=s=>fs.writeFileSync(subscriptionsFile, JSON.stringify(s,null,2));
const loadUsage=()=>{try{return JSON.parse(fs.readFileSync(usageFile,'utf8')||'{}')}catch{return {}}};
const saveUsage=s=>fs.writeFileSync(usageFile, JSON.stringify(s,null,2));
const loadFeedback=()=>{try{return JSON.parse(fs.readFileSync(feedbackFile,'utf8')||'[]')}catch{return []}};
const saveFeedback=s=>fs.writeFileSync(feedbackFile, JSON.stringify(s,null,2));
const monthKey=()=>new Date().toISOString().slice(0,7);
const usageFor=(userId,plan='trial')=>{const u=loadUsage();const k=`${userId}:${monthKey()}`;const existing=u[k]||{};const limit=plan==='growth'?250:50;return {...existing,userId,month:monthKey(),plan,limit,used:Number(existing.used||0),updatedAt:new Date().toISOString()};};
const consumeCredits=(userId,cost,plan='trial')=>{if(!userId)throw new Error('User identity is required.');const u=loadUsage();const k=`${userId}:${monthKey()}`;const current=usageFor(userId,plan);if(current.used+cost>current.limit)throw Object.assign(new Error('AI credit limit reached. Upgrade or wait for the next billing period.'),{code:'CREDITS_EXHAUSTED',credits:Math.max(0,current.limit-current.used)});current.used+=cost;u[k]=current;saveUsage(u);return Math.max(0,current.limit-current.used);};
const refundCredits=(userId,cost,plan='trial')=>{if(!userId)return;const u=loadUsage();const k=`${userId}:${monthKey()}`;const current=usageFor(userId,plan);current.used=Math.max(0,current.used-cost);u[k]=current;saveUsage(u);};
const currentPlan=(userId)=>{const sub=loadSubs()[userId];if(sub && ['trial','active'].includes(sub.status))return sub.status==='active'?'growth':'trial';return 'trial';};
const allowedCurrencies = new Set(['USD','ZAR','KES','MUR','GBP','EUR']);

const securityHeaders={'x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin','permissions-policy':'camera=(), microphone=(), geolocation=()'};
const json = (res, status, body) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8',...securityHeaders,'cache-control':'no-store'}); res.end(JSON.stringify(body)); };
const text = (res, status, body) => { res.writeHead(status, {'content-type':'text/plain; charset=utf-8',...securityHeaders}); res.end(body); };
const readBody = req => new Promise((resolve,reject)=>{ let raw=''; req.on('data',c=>{raw+=c; if(raw.length>1024*1024){req.destroy();reject(new Error('body too large'));}}); req.on('end',()=>resolve(raw)); req.on('error',reject); });
const safeId = () => crypto.randomBytes(8).toString('hex').slice(0,16);
const rateBuckets=new Map();
const rateLimit=(req,key,limit=60,windowMs=60000)=>{const now=Date.now();const id=`${req.socket.remoteAddress||'unknown'}:${key}`;const b=rateBuckets.get(id);if(!b||now-b.started>=windowMs){rateBuckets.set(id,{started:now,count:1});return true}if(b.count>=limit)return false;b.count++;return true};
const envReady = () => Boolean(clientId && clientSecret && merchantId && entityId);

async function peachToken(){
  if(!envReady()) throw new Error('Peach credentials are not configured on the server.');
  const r = await fetch(`${authBase}/api/oauth/token`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({clientId,clientSecret,merchantId})});
  const body = await r.json().catch(()=>({}));
  if(!r.ok || !body.access_token) throw new Error(`Peach authentication failed (${r.status}).`);
  return body.access_token;
}

async function createCheckout({currency='USD', email='', userId=''}){
  if(!allowedCurrencies.has(currency)) throw new Error('Unsupported currency.');
  const token = await peachToken();
  const tx = `SPK${Date.now().toString().slice(-11)}`.slice(0,16);
  const body = {
    authentication:{entityId},
    merchantTransactionId:tx,
    amount:0,
    currency,
    paymentType:'PA',
    nonce:safeId(),
    shopperResultUrl:`${publicBase}/billing/result`,
    defaultPaymentMethod:'CARD',
    forceDefaultMethod:true,
    notificationUrl:`${publicBase}/api/billing/webhook`,
    originator:'SPIKE',
    returnTo:'STORE',
    createRegistration:true,
    standingInstruction:{frequency:30, recurringType:'SUBSCRIPTION', type:'RECURRING', mode:'INITIAL'},
    customer: email ? {email} : undefined,
    customParameters:{auxData:JSON.stringify({userId,plan:'growth',trialDays:7})}
  };
  const r = await fetch(`${checkoutBase}/v2/checkout`, {method:'POST',headers:{'content-type':'application/json','accept':'application/json','Authorization':`Bearer ${token}`,'Origin':publicBase,'Referer':publicBase},body:JSON.stringify(body)});
  const result = await r.json().catch(()=>({}));
  if(!r.ok || !result.redirectUrl) throw new Error(result.message || `Peach checkout creation failed (${r.status}).`);
  return {redirectUrl:result.redirectUrl, checkoutId:result.checkoutId, merchantTransactionId:tx};
}

function verifyWebhook(req, raw){
  if(!webhookSecret) return false;
  const timestamp=req.headers['x-webhook-timestamp'];
  const webhookId=req.headers['x-webhook-id'];
  const received=req.headers['x-webhook-signature'];
  if(!timestamp || !webhookId || !received) return false;
  const url=`${publicBase}/api/billing/webhook`;
  const message=`${timestamp}.${webhookId}.${url}.${raw}`;
  const expected=crypto.createHmac('sha256',webhookSecret).update(message).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(received))); } catch { return false; }
}


const creatorContext = `CREATOR / OWNERSHIP CONTEXT:
Project: ${creatorProject}
Creator: ${creatorName}
Creator ID: ${creatorId}
Primary creator contact: ${creatorEmail}
These details identify the creator of the SPIKE software. Do not confuse the software creator with the business owner using a workspace. Never expose private server secrets.`;

const spikeSystemPrompt = `You are SPIKE — Turn Insight Into Growth. Your Next Move Starts Here.
You are the business-growth intelligence inside a SaaS product for small businesses and founders.
Personality: smart, practical, direct, encouraging, occasionally witty, and serious around money and risk. Never say “As an AI”.

CORE RULES:
- Use only business facts supplied in the context. Never invent revenue, customers, prices, competitors, market facts, or results.
- App-calculated metrics are facts. Recommendations, forecasts, estimates and scenarios must be clearly labelled as such.
- Never promise a result or guarantee growth.
- Do not pretend to have executed actions, contacted customers, published content, booked anything, or connected accounts.
- If important information is missing, say what is missing and ask at most 1–2 focused questions when needed.
- Keep advice concrete: explain WHY it matters and give a small next step the owner can actually test.
- Respect the owner's control. Present options and trade-offs rather than making decisions for them.
- Do not confuse correlation with causation.
- For financial advice, distinguish recorded numbers from assumptions and suggest professional advice where appropriate for regulated/high-stakes matters.
- Keep answers concise unless the user asks for depth.
- When useful, format with short headings and bullets.
- If the user asks for current, external, local, product, market, competitor, pricing, regulation, trend, or other information you do not have in the supplied business context, research it with the web search tool instead of guessing.
- For research requests, search multiple relevant sources, prefer primary/official and reputable sources, compare the evidence, discard weak or duplicate results, and give the user a concise synthesis of the most useful findings.
- Clearly distinguish researched facts from your recommendations and note important uncertainty or conflicting evidence.
- Never claim to have searched the entire internet; say you searched the web and summarize the strongest relevant sources.
- Respond in the requested language when possible; keep brand names and product names unchanged.

When suggesting an experiment, include: hypothesis, action, measurement, timeframe, and what result would change the next decision.`;

async function openaiSpikeChat(body){
  if(!openaiKey) throw new Error('SPIKE AI is not configured yet. Add OPENAI_API_KEY to the server environment.');
  const message=String(body.message||'').trim().slice(0,5000);
  const userId=String(body.userId||'').slice(0,120);
  const plan=currentPlan(userId);
  if(!message) throw new Error('Message is required.');
  const remaining=consumeCredits(userId,1,plan);
  const business=body.business&&typeof body.business==='object'?body.business:{};
  const transactions=Array.isArray(body.transactions)?body.transactions.slice(0,100):[];
  const experiments=Array.isArray(body.experiments)?body.experiments.slice(0,20):[];
  const history=Array.isArray(body.history)?body.history.slice(-10):[];
  const language=String(body.language||'en');
  const context={business,transactions,experiments,calculated:calcServerMetrics(transactions),language};
  const input=[
    {role:'developer',content:spikeSystemPrompt},
    {role:'developer',content:creatorContext},
    {role:'developer',content:`BUSINESS CONTEXT (treat unknown fields as unknown):\n${JSON.stringify(context)}`},
    ...history.map(x=>({role:x.role==='assistant'?'assistant':'user',content:String(x.content||'').slice(0,4000)})),
    {role:'user',content:message}
  ];
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','Authorization':`Bearer ${openaiKey}`},body:JSON.stringify({model:openaiModel,input,tools:[{type:'web_search'}],store:false})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error?.message||`OpenAI request failed (${r.status}).`);
  return {text:data.output_text||'SPIKE could not produce a response this time.',responseId:data.id,usage:data.usage||null,credits:remaining};
}

const calcServerMetrics=(transactions)=>{
  const sales=transactions.filter(t=>t?.type==='sale').reduce((a,t)=>a+(Number(t.amount)||0),0);
  const expenses=transactions.filter(t=>t?.type==='expense').reduce((a,t)=>a+(Number(t.amount)||0),0);
  const profit=sales-expenses; const margin=sales?profit/sales*100:0;
  return {sales,expenses,profit,margin,transactionCount:transactions.length};
};

async function handler(req,res){
  const u=new URL(req.url,publicBase);
  if(!rateLimit(req,u.pathname,u.pathname.startsWith('/api/ai/')?20:120)) return json(res,429,{ok:false,error:'Too many requests. Please wait a moment and try again.'});
  if(req.method==='GET' && u.pathname==='/api/health') return json(res,200,{ok:true,provider:'Peach Payments',environment:mode,configured:envReady(),aiConfigured:Boolean(openaiKey),ownerConsoleConfigured:Boolean(ownerSecret),webhookSigningConfigured:Boolean(webhookSecret)});
  if(req.method==='GET' && u.pathname==='/api/integrations/status') return json(res,200,{ok:true,integrations:{ai:{configured:Boolean(openaiKey),model:openaiModel},payments:{provider:'Peach Payments',credentialsConfigured:envReady(),webhookSigningConfigured:Boolean(webhookSecret)},ownerConsole:{serverSecretConfigured:Boolean(ownerSecret)},research:{webSearchEnabled:Boolean(openaiKey)}}});
  if(req.method==='GET' && u.pathname==='/api/creator') return json(res,200,{ok:true,creator:{id:creatorId,name:creatorName,project:creatorProject,primaryEmail:creatorEmail,backupEmails:creatorBackupEmails}});
  if(req.method==='POST' && u.pathname==='/api/ai/chat'){ let body={}; try { body=JSON.parse(await readBody(req)||'{}'); const result=await openaiSpikeChat(body); return json(res,200,{ok:true,...result}); } catch(e){ if(body.userId && e.code!=='CREDITS_EXHAUSTED') refundCredits(String(body.userId).slice(0,120),1,currentPlan(String(body.userId).slice(0,120))); return json(res,e.code==='CREDITS_EXHAUSTED'?429:500,{ok:false,error:e.message,credits:e.credits}); } }
  if(req.method==='POST' && u.pathname==='/api/opportunities/find'){
    let body={}; let userId='';
    try{
      body=JSON.parse(await readBody(req)||'{}'); userId=String(body.userId||'').slice(0,120);
      if(!openaiKey) throw new Error('SPIKE AI is not configured yet. Add OPENAI_API_KEY to the server environment.');
      const plan=currentPlan(userId); const remaining=consumeCredits(userId,10,plan);
      const business=body.business&&typeof body.business==='object'?body.business:{};
      const query=String(body.query||'').trim().slice(0,300);
      const prompt=`Find legitimate customer opportunities for this business using public web information. Search the web now. Look for public requests, tenders, event/vendor requests, marketplace/service requests, community posts or other clearly public opportunities where the business could legitimately respond. Do NOT expose private personal information, infer private contact details, or suggest bypassing access controls. Do NOT claim someone is a confirmed customer. Prefer current, relevant and geographically appropriate opportunities. Exclude generic market trends unless no concrete opportunities exist.\n\nBUSINESS:\n${JSON.stringify(business)}\n\nOPTIONAL SEARCH FOCUS:\n${query||'Use the business profile to choose the most useful search focus.'}\n\nReturn ONLY valid JSON as an array. Each item must have: title, summary, location, budget, date, match, why, source, url. Use empty strings when unknown. Keep up to 8 strongest opportunities. match must be one of: Strong match, Good match, Potential match. Every factual opportunity must have a source URL when one is available. If no suitable opportunities are found, return [].`;
      const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','Authorization':`Bearer ${openaiKey}`},body:JSON.stringify({model:openaiModel,input:[{role:'developer',content:spikeSystemPrompt},{role:'developer',content:creatorContext},{role:'user',content:prompt}],tools:[{type:'web_search'}],store:false})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data?.error?.message||`Opportunity research failed (${r.status}).`);
      let raw=String(data.output_text||'').trim(); raw=raw.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
      let opportunities=[]; try{const parsed=JSON.parse(raw); opportunities=Array.isArray(parsed)?parsed:[];}catch{opportunities=[];}
      opportunities=opportunities.slice(0,8).map((o,i)=>({id:`opp_${Date.now()}_${i}`,title:String(o?.title||'Customer opportunity').slice(0,180),summary:String(o?.summary||'').slice(0,900),location:String(o?.location||'').slice(0,160),budget:String(o?.budget||'').slice(0,120),date:String(o?.date||'').slice(0,120),match:['Strong match','Good match','Potential match'].includes(o?.match)?o.match:'Potential match',why:String(o?.why||'').slice(0,500),source:String(o?.source||'Public source').slice(0,160),url:/^https?:\/\//i.test(String(o?.url||''))?String(o.url).slice(0,1000):''}));
      return json(res,200,{ok:true,opportunities,credits:remaining,searched:true});
    }catch(e){if(userId && e.code!=='CREDITS_EXHAUSTED') refundCredits(userId,10,currentPlan(userId)); return json(res,e.code==='CREDITS_EXHAUSTED'?429:500,{ok:false,error:e.message,credits:e.credits});}
  }
  if(req.method==='POST' && u.pathname==='/api/ai/research'){
    let userId='';
    try{
      const body=JSON.parse(await readBody(req)||'{}');
      if(!openaiKey) throw new Error('SPIKE AI is not configured yet. Add OPENAI_API_KEY to the server environment.');
      userId=String(body.userId||'').slice(0,120);
      const plan=currentPlan(userId); const remaining=consumeCredits(userId,5,plan);
      const query=String(body.query||'').trim().slice(0,700); if(!query) throw new Error('Research question is required.');
      const business=body.business&&typeof body.business==='object'?body.business:{}; const language=String(body.language||'en');
      const prompt=`Research this question using current web information: ${query}\nBusiness context (use only where relevant): ${JSON.stringify(business)}\nReturn valid JSON only with this shape: {"summary":"concise synthesis with uncertainty noted","sources":[{"title":"source title","url":"https://..."}]}. Use multiple relevant sources when available, prefer official/primary/reputable sources, do not invent URLs, and do not claim the whole internet was searched. Keep the summary under 900 words. Answer in ${language}.`;
      const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','Authorization':`Bearer ${openaiKey}`},body:JSON.stringify({model:openaiModel,input:[{role:'developer',content:spikeSystemPrompt},{role:'developer',content:creatorContext},{role:'user',content:prompt}],tools:[{type:'web_search'}],store:false})});
      const data=await r.json().catch(()=>({})); if(!r.ok) throw new Error(data?.error?.message||`Research request failed (${r.status}).`);
      let raw=String(data.output_text||'').trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim(); let parsed={summary:raw,sources:[]}; try{const j=JSON.parse(raw);if(j&&typeof j==='object')parsed=j;}catch{}
      const cleanSources=Array.isArray(parsed.sources)?parsed.sources.slice(0,8).map(x=>({title:String(x?.title||'Source').slice(0,180),url:/^https?:\/\//i.test(String(x?.url||''))?String(x.url).slice(0,1000):''})).filter(x=>x.url):[];
      return json(res,200,{ok:true,text:String(parsed.summary||raw).slice(0,7000),sources:cleanSources,credits:remaining,responseId:data.id,usage:data.usage||null});
    }catch(e){if(userId&&e.code!=='CREDITS_EXHAUSTED') refundCredits(userId,5,currentPlan(userId)); return json(res,e.code==='CREDITS_EXHAUSTED'?429:500,{ok:false,error:e.message,credits:e.credits});}
  }
  if(req.method==='POST' && u.pathname==='/api/ai/action'){
    try{
      const body=JSON.parse(await readBody(req)||'{}');
      if(!openaiKey) throw new Error('SPIKE AI is not configured yet. Add OPENAI_API_KEY to the server environment.');
      const userId=String(body.userId||'').slice(0,120);
      const plan=currentPlan(userId);
      const remaining=consumeCredits(userId,10,plan);
      const business=body.business&&typeof body.business==='object'?body.business:{};
      const transactions=Array.isArray(body.transactions)?body.transactions.slice(0,100):[];
      const experiments=Array.isArray(body.experiments)?body.experiments.slice(0,20):[];
      const leads=Array.isArray(body.leads)?body.leads.slice(0,50):[];
      const language=String(body.language||'en');
      const context={business,transactions,experiments,leads,calculated:calcServerMetrics(transactions),language};
      const actionPrompt=`Generate exactly ONE focused next move for this business. Use only supplied facts and experiment history. Do not repeat a completed experiment unless the recorded result shows a reason to revisit it. Return: MOVE (one sentence), WHY (one short paragraph), TEST (one concrete step), MEASURE (one metric), TIMEFRAME (a short period), DECISION RULE (what result would change the next decision). Do not invent missing facts. Keep it practical and under 180 words.`;
      const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json','Authorization':`Bearer ${openaiKey}`},body:JSON.stringify({model:openaiModel,input:[{role:'developer',content:spikeSystemPrompt},{role:'developer',content:creatorContext},{role:'developer',content:actionPrompt},{role:'developer',content:`BUSINESS CONTEXT:\n${JSON.stringify(context)}`}],tools:[{type:'web_search'}],store:false})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data?.error?.message||`OpenAI request failed (${r.status}).`);
      const textOut=data.output_text||'SPIKE could not produce a move this time.';
      const move=(textOut.match(/MOVE\s*[:\-]\s*(.+)/i)||[])[1]||textOut.split('\n')[0];
      const measure=(textOut.match(/MEASURE\s*[:\-]\s*(.+)/i)||[])[1]||'';
      const timeframe=(textOut.match(/TIMEFRAME\s*[:\-]\s*(.+)/i)||[])[1]||'';
      return json(res,200,{ok:true,text:textOut,move,measure,timeframe,responseId:data.id,usage:data.usage||null,credits:remaining});
    }catch(e){if(typeof userId!=='undefined' && userId && e.code!=='CREDITS_EXHAUSTED') refundCredits(userId,10,currentPlan(userId)); return json(res,e.code==='CREDITS_EXHAUSTED'?429:500,{ok:false,error:e.message,credits:e.credits});}
  }
  if(req.method==='GET' && u.pathname==='/api/feedback'){
    const items=loadFeedback().sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||(b.votes-a.votes)||(new Date(b.createdAt)-new Date(a.createdAt)));
    return json(res,200,{ok:true,feedback:items.map(({id,type,title,message,displayName,status,votes,createdAt,pinned,creatorResponse,comments})=>({id,type,title,message,displayName,status,votes,createdAt,pinned:Boolean(pinned),creatorResponse:creatorResponse||null,comments:Array.isArray(comments)?comments:[]}))});
  }
  if(req.method==='POST' && u.pathname==='/api/feedback'){
    try{
      const body=JSON.parse(await readBody(req)||'{}');
      const type=['recommendation','comment','bug','praise'].includes(body.type)?body.type:'recommendation';
      const title=String(body.title||'').trim().slice(0,120);
      const message=String(body.message||'').trim().slice(0,2000);
      const displayName=String(body.displayName||'SPIKE user').trim().slice(0,80)||'SPIKE user';
      const userId=String(body.userId||'').slice(0,120);
      if(!message) return json(res,400,{ok:false,error:'Please write your recommendation or comment.'});
      if(type==='recommendation' && !title) return json(res,400,{ok:false,error:'Please give your recommendation a short title.'});
      const items=loadFeedback();
      const item={id:safeId(),type,title:title||({comment:'User comment',bug:'Bug report',praise:'What users like'}[type]||'Recommendation'),message,displayName,userId,status:'new',votes:0,voters:[],pinned:false,creatorResponse:null,comments:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      items.unshift(item); saveFeedback(items);
      return json(res,201,{ok:true,feedback:item});
    }catch(e){return json(res,400,{ok:false,error:'Invalid feedback submission.'});}
  }
  if(req.method==='POST' && u.pathname==='/api/feedback/vote'){
    try{
      const body=JSON.parse(await readBody(req)||'{}'); const id=String(body.id||''); const userId=String(body.userId||'').slice(0,120);
      if(!id||!userId) return json(res,400,{ok:false,error:'Feedback id and user id are required.'});
      const items=loadFeedback(); const item=items.find(x=>x.id===id); if(!item) return json(res,404,{ok:false,error:'Feedback not found.'});
      item.voters=Array.isArray(item.voters)?item.voters:[];
      const idx=item.voters.indexOf(userId);
      if(idx>=0){item.voters.splice(idx,1);item.votes=Math.max(0,(item.votes||0)-1);}
      else{item.voters.push(userId);item.votes=(item.votes||0)+1;}
      item.updatedAt=new Date().toISOString(); saveFeedback(items); return json(res,200,{ok:true,votes:item.votes,voted:idx<0});
    }catch(e){return json(res,400,{ok:false,error:'Invalid vote request.'});}
  }
  const ownerAuthorized=()=>Boolean(ownerSecret && req.headers[ownerHeader]===ownerSecret);
  const feedbackSummary=()=>{
    const items=loadFeedback();
    const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>3&&!new Set(['this','that','with','from','have','should','would','could','spike','user','users','more','make','want','need','like','please']).has(w));
    const counts=new Map();
    for(const x of items){const phrase=[x.title,x.message].filter(Boolean).join(' ');for(const w of normalize(phrase)){counts.set(w,(counts.get(w)||0)+1);}}
    const themes=[...counts.entries()].filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([term,count])=>({term,count}));
    const statusCounts={}; for(const x of items)statusCounts[x.status||'new']=(statusCounts[x.status||'new']||0)+1;
    return {total:items.length,pinned:items.filter(x=>x.pinned).length,upvotes:items.reduce((n,x)=>n+Number(x.votes||0),0),statusCounts,themes,topRequests:items.filter(x=>x.type==='recommendation').sort((a,b)=>(Number(b.votes)-Number(a.votes))).slice(0,8).map(x=>({id:x.id,title:x.title,message:x.message,votes:x.votes,status:x.status,pinned:Boolean(x.pinned)}))};
  };
  if(req.method==='GET' && u.pathname==='/api/feedback/owner'){
    if(!ownerAuthorized()) return json(res,401,{ok:false,error:'Owner access required.'});
    const items=loadFeedback().sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||(b.votes-a.votes)||(new Date(b.createdAt)-new Date(a.createdAt)));
    return json(res,200,{ok:true,feedback:items,summary:feedbackSummary()});
  }
  if(req.method==='GET' && u.pathname==='/api/feedback/summary'){
    if(!ownerAuthorized()) return json(res,401,{ok:false,error:'Owner access required.'});
    return json(res,200,{ok:true,summary:feedbackSummary()});
  }
  if(req.method==='PATCH' && u.pathname.startsWith('/api/feedback/')){
    if(!ownerAuthorized()) return json(res,401,{ok:false,error:'Owner access required.'});
    const id=u.pathname.split('/').pop();
    if(!id || ['owner','summary','vote'].includes(id)) return json(res,400,{ok:false,error:'Feedback id is required.'});
    try{
      const body=JSON.parse(await readBody(req)||'{}'); const items=loadFeedback(); const item=items.find(x=>x.id===id); if(!item)return json(res,404,{ok:false,error:'Feedback not found.'});
      if(body.status!==undefined){const allowed=['new','reviewing','planned','in_progress','completed','declined'];if(!allowed.includes(body.status))return json(res,400,{ok:false,error:'Invalid feedback status.'});item.status=body.status;}
      if(body.pinned!==undefined)item.pinned=Boolean(body.pinned);
      if(body.response!==undefined){const response=String(body.response||'').trim().slice(0,3000);item.creatorResponse=response?{text:response,author:creatorName,createdAt:new Date().toISOString()}:null;}
      item.updatedAt=new Date().toISOString(); saveFeedback(items); return json(res,200,{ok:true,feedback:item,summary:feedbackSummary()});
    }catch(e){return json(res,400,{ok:false,error:'Invalid owner update.'});}
  }
  if(req.method==='POST' && u.pathname.startsWith('/api/feedback/') && u.pathname.endsWith('/comments')){
    if(!ownerAuthorized()) return json(res,401,{ok:false,error:'Owner access required.'});
    const id=u.pathname.split('/').slice(-2,-1)[0];
    try{const body=JSON.parse(await readBody(req)||'{}');const text=String(body.text||'').trim().slice(0,2000);if(!text)return json(res,400,{ok:false,error:'Comment cannot be empty.'});const items=loadFeedback();const item=items.find(x=>x.id===id);if(!item)return json(res,404,{ok:false,error:'Feedback not found.'});item.comments=Array.isArray(item.comments)?item.comments:[];item.comments.push({id:safeId(),author:creatorName,text,createdAt:new Date().toISOString()});item.updatedAt=new Date().toISOString();saveFeedback(items);return json(res,200,{ok:true,feedback:item});}catch(e){return json(res,400,{ok:false,error:'Invalid creator comment.'});}
  }
  if(req.method==='POST' && u.pathname==='/api/feedback/vote'){
    try{
      const body=JSON.parse(await readBody(req)||'{}'); const id=String(body.id||''); const userId=String(body.userId||'').slice(0,120);
      if(!id||!userId) return json(res,400,{ok:false,error:'Feedback id and user id are required.'});
      const items=loadFeedback(); const item=items.find(x=>x.id===id); if(!item) return json(res,404,{ok:false,error:'Feedback not found.'});
      item.voters=Array.isArray(item.voters)?item.voters:[];
      const idx=item.voters.indexOf(userId);
      if(idx>=0){item.voters.splice(idx,1);item.votes=Math.max(0,(item.votes||0)-1);}
      else{item.voters.push(userId);item.votes=(item.votes||0)+1;}
      saveFeedback(items); return json(res,200,{ok:true,votes:item.votes,voted:idx<0});
    }catch(e){return json(res,400,{ok:false,error:'Invalid vote request.'});}
  }
  if(req.method==='GET' && u.pathname==='/api/usage/status'){
    const userId=String(u.searchParams.get('userId')||'').slice(0,120);
    const plan=currentPlan(userId); const usage=usageFor(userId,plan);
    return json(res,200,{ok:true,userId,plan,credits:Math.max(0,usage.limit-usage.used),used:usage.used,limit:usage.limit,month:usage.month});
  }
  if(req.method==='POST' && u.pathname==='/api/billing/checkout'){
    try{
      const body=JSON.parse(await readBody(req)||'{}');
      const checkout=await createCheckout({currency:body.currency||'USD',email:body.email||'',userId:String(body.userId||'').slice(0,100)});
      return json(res,200,{ok:true,...checkout});
    }catch(e){ return json(res,500,{ok:false,error:e.message}); }
  }
  if(req.method==='POST' && u.pathname==='/api/billing/webhook'){
    const raw=await readBody(req);
    if(!verifyWebhook(req,raw)) return json(res,401,{ok:false,error:'Invalid webhook signature.'});
    const event=Object.fromEntries(new URLSearchParams(raw));
    const code=String(event['result.code']||event.result_code||'');
    const successful=code.startsWith('000.');
    const subs=loadSubs();
    let aux={}; try{aux=JSON.parse(event['customParameters.auxData']||event.auxData||'{}')}catch{}
    const userId=aux.userId||'unknown';
    const current=subs[userId]||{};
    if(successful && event.registrationId){
      subs[userId]={...current,userId,status:'trial',registrationId:event.registrationId,merchantTransactionId:event.merchantTransactionId||null,checkoutId:event.checkoutId||null,currency:event.currency||'USD',trialEndsAt:new Date(Date.now()+7*86400000).toISOString(),nextBillingAt:new Date(Date.now()+7*86400000).toISOString(),updatedAt:new Date().toISOString()};
      saveSubs(subs);
    } else if(!successful && current.status==='trial'){
      subs[userId]={...current,status:'past_due',updatedAt:new Date().toISOString()}; saveSubs(subs);
    }
    console.log(JSON.stringify({event:'peach_webhook',status:successful?'successful':'non-success',merchantTransactionId:event.merchantTransactionId||null,checkoutId:event.checkoutId||null,timestamp:event.timestamp||null}));
    return json(res,200,{ok:true});
  }
  if(req.method==='GET' && u.pathname==='/api/billing/status'){
    const userId=u.searchParams.get('userId')||'';
    const sub=loadSubs()[userId];
    return json(res,200,{ok:true,subscription:sub?{status:sub.status,trialEndsAt:sub.trialEndsAt,nextBillingAt:sub.nextBillingAt}:null});
  }
  if(req.method==='POST' && u.pathname==='/api/billing/cancel'){
    const body=JSON.parse(await readBody(req)||'{}'); const userId=String(body.userId||''); const subs=loadSubs();
    if(!userId || !subs[userId]) return json(res,404,{ok:false,error:'Subscription not found.'});
    subs[userId]={...subs[userId],status:'cancelled',updatedAt:new Date().toISOString()}; saveSubs(subs);
    return json(res,200,{ok:true,status:'cancelled'});
  }
  if(req.method==='POST' && u.pathname==='/api/billing/renew-due'){
    if(!cronSecret || req.headers['x-spike-cron-secret']!==cronSecret) return json(res,401,{ok:false,error:'Unauthorized.'});
    if(!recurringToken) return json(res,503,{ok:false,error:'Peach recurring access token is not configured.'});
    const subs=loadSubs(); const now=Date.now(); const results=[];
    for(const [userId,sub] of Object.entries(subs)){
      if(!sub.registrationId || sub.status==='cancelled' || !sub.nextBillingAt || new Date(sub.nextBillingAt).getTime()>now) continue;
      const form=new URLSearchParams({entityId,paymentType:'DB',amount:String(priceUsd),currency:sub.currency||'USD','standingInstruction.type':'RECURRING','standingInstruction.mode':'REPEATED','standingInstruction.source':'MIT'});
      try{
        const r=await fetch(`${isSandbox?'https://sandbox-card.peachpayments.com':'https://card.peachpayments.com'}/v1/registrations/${encodeURIComponent(sub.registrationId)}/payments`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','Authorization':`Bearer ${recurringToken}`},body:form});
        const b=await r.json().catch(()=>({})); const ok=r.ok && String(b?.result?.code||'').startsWith('000.');
        subs[userId]={...sub,status:ok?'active':'past_due',lastBillingAt:new Date().toISOString(),nextBillingAt:ok?new Date(Date.now()+30*86400000).toISOString():new Date(Date.now()+24*86400000).toISOString(),updatedAt:new Date().toISOString()};
        results.push({userId,status:subs[userId].status});
      }catch(e){subs[userId]={...sub,status:'past_due',updatedAt:new Date().toISOString()}; results.push({userId,status:'past_due'});}
    }
    saveSubs(subs); return json(res,200,{ok:true,results});
  }
  if(req.method==='GET' && u.pathname==='/billing/result') return text(res,200,'Payment result received. Return to SPIKE. Subscription activation is controlled by verified webhook events.');
  if(req.method==='GET'){
    // Serve the Vite build from the project root. Host platforms may launch the
    // Node process with a different cwd, so resolve from this module's location.
    const distRoot=path.resolve(__dirname,'..','dist');
    const requested=decodeURIComponent(u.pathname==='/'?'index.html':u.pathname);
    let filePath=path.resolve(distRoot,'.'+requested);
    if(!filePath.startsWith(distRoot+path.sep) && filePath!==distRoot) return text(res,403,'Forbidden');

    const sendFile=(target)=>{
      fs.readFile(target,(err,data)=>{
        if(err){
          // SPA fallback: client-side routes should receive index.html.
          const fallback=path.join(distRoot,'index.html');
          return fs.readFile(fallback,(fallbackErr,html)=>{
            if(fallbackErr) return text(res,404,'SPIKE frontend build not found. Run npm run build before starting the server.');
            res.writeHead(200,{'content-type':'text/html; charset=utf-8',...securityHeaders,'cache-control':'no-cache'});
            res.end(html);
          });
        }
        const ext=path.extname(target).toLowerCase();
        const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
        res.writeHead(200,{'content-type':types[ext]||'application/octet-stream',...securityHeaders});
        res.end(data);
      });
    };
    sendFile(filePath);
    return;
  }
  return text(res,404,'Not found');
}

http.createServer((req,res)=>handler(req,res).catch(e=>{console.error(e);json(res,500,{ok:false,error:'Internal server error'});})).listen(port,bindHost,()=>console.log(`SPIKE server listening on ${bindHost}:${port}`));
