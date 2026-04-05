import os
import time
import json
import requests
import sys
import threading
import datetime
import subprocess

# --- AUTO-INSTALADOR DE SEGURANÇA (Para o Render não falhar) ---
def install_and_import(package, import_name):
    try:
        __import__(import_name)
    except ImportError:
        print(f"⚠️ Módulo {package} não encontrado. Instalando...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package, "--quiet"])
            print(f"✅ {package} instalado!")
        except Exception as e:
            print(f"❌ Erro ao instalar {package}: {e}")

install_and_import("google-generativeai", "google.generativeai")
install_and_import("supabase", "supabase")

import google.generativeai as genai
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer, HTTPServer
from supabase import create_client, Client

# --- CONFIGURAÇÕES KSBOLD ---
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
except: pass

# --- CONFIGURAÇÕES KSBOLD (Env Vars) ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://zqsxmzbshsozggcwvxla.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "") 
WHATSAPP_API_URL = os.getenv("WHATSAPP_API_URL", "https://ksbold-evolution-api.onrender.com/message/sendText/ksbold-loja")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "ksbold-secreta-1234")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "") # 🚀 NOVO: Fallback para Groq (Llama 3.1)

# --- CACHE DE RESPOSTAS (ECONOMIA DE COTA 429) ---
AI_CACHE = {}

def get_cached_reply(message):
    m = message.strip().lower()
    if m in AI_CACHE:
        item = AI_CACHE[m]
        if time.time() < item['expires']: return item['reply']
    return None

def set_cached_reply(message, reply):
    m = message.strip().lower()
    AI_CACHE[m] = {"reply": reply, "expires": time.time() + 45}

# --- MÓDULO AGÊNCIA MULTI-AGENTE (Integrado) ---

class KSBoldMarketingAgency:
    def __init__(self, gemini_key, groq_key):
        self.gemini_key = gemini_key
        self.groq_key = groq_key
        if gemini_key: genai.configure(api_key=gemini_key)

    def agir_como_copywriter(self, briefing, snapshot):
        p = f"Você é o COPYWRITER KSBOLD (Luxo). Snapshot: {snapshot}. Briefing: {briefing}. Crie 3 legendas Insta."
        return self._ai_request(p)

    def agir_como_designer_prompt(self, briefing):
        p = f"Você é o DESIGNER KSBOLD. Crie um prompt de imagem de luxo para: {briefing}"
        return self._ai_request(p)

    def _ai_request(self, prompt):
        # Tenta Gemini primeiro para tarefas internas
        if self.gemini_key:
            try:
                model = genai.GenerativeModel('gemini-1.5-flash')
                return model.generate_content(prompt).text
            except: pass
        # Fallback para Groq se configurado
        if self.groq_key:
            try:
                headers = {"Authorization": f"Bearer {self.groq_key}", "Content-Type": "application/json"}
                data = {"model": "llama-3.1-70b-versatile", "messages": [{"role": "user", "content": prompt}]}
                resp = requests.post("https://api.groq.com/openai/v1/chat/completions", json=data, headers=headers)
                return resp.json()['choices'][0]['message']['content']
            except: pass
        return "Agente temporariamente indisponível."

    def orquestrar_campanha(self, tema, snapshot):
        c = self.agir_como_copywriter(f"Campanha {tema}", snapshot)
        v = self.agir_como_designer_prompt(f"Imagem {tema}")
        return {"tema": tema, "copy": c, "visual_concept": v}

# Inicializar IA
marketing_agency = KSBoldMarketingAgency(GEMINI_API_KEY, GROQ_API_KEY)
if GEMINI_API_KEY or GROQ_API_KEY:
    print("🧠 Cérebro Híbrido KSBOLD Online.")

# Conectar Supabase
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Supabase OK.")
    # --- AUTO-SETUP TABELA DE MEMÓRIA ---
    try:
        supabase.table("ai_memory").select("count").limit(1).execute()
    except:
        print("⚠️ Criando tabela ai_memory...")
        # Como não temos DDL direto via Client as vezes, a IA vai 'aprender' a criar ou o Kelvin roda o SQL.
        # Mas vamos assumir que o Client pode ler se existir.
except:
    print("❌ Erro Supabase.")
    sys.exit(1)

def get_ai_memories():
    try:
        data = supabase.table("ai_memory").select("*").execute().data or []
        if not data: return "Nenhuma instrução especial gravada ainda."
        return "\n".join([f"- {m['key']}: {m['value']}" for m in data])
    except: return "Erro ao ler memorias."

def tool_salvar_memoria(chave, valor):
    """Grave uma informação importante para nunca esquecer (ex: nome do CEO, metas, regras)."""
    try:
        supabase.table("ai_memory").upsert({"key": chave, "value": valor}, on_conflict="key").execute()
        return f"✅ Entendido. Gravei na minha mente que '{chave}' agora é '{valor}'."
    except Exception as e: return f"❌ Erro ao memorizar: {str(e)}"

# --- FUNÇÕES CORE (Envios e Monitor) ---

def enviar_whatsapp(num, msg):
    if not num: return
    p = {"number": num, "options": {"delay": 1000, "presence": "composing"}, "textMessage": {"text": msg}}
    h = {"Content-Type": "application/json", "apikey": EVOLUTION_API_KEY}
    try: requests.post(WHATSAPP_API_URL, json=p, headers=h)
    except: pass

def tool_enviar_whatsapp(numero, mensagem):
    """Envie uma mensagem de WhatsApp para qualquer numero (incluindo relatorios para o CEO)."""
    try:
        enviar_whatsapp(numero, mensagem)
        return f"✅ Relatorio/Mensagem enviada com sucesso para {numero}."
    except Exception as e: return f"❌ Erro ao enviar WhatsApp: {str(e)}"

def get_ksbold_snapshot():
    try:
        orders = supabase.table("orders").select("preco, status").execute().data or []
        receita = sum(float(o.get('preco', 0)) for o in orders if o.get('status') == 'paid')
        return f"Pedidos: {len(orders)}. Receita: {receita} MT."
    except: return "Snapshot indisponivel."

def monitorar_pedidos():
    while True:
        try:
            q = supabase.table("orders").select("*").eq("status", "Pendente").eq("notificado", False).execute()
            if q.data:
                for it in q.data:
                    enviar_whatsapp(it.get('client_phone'), f"Olá {it.get('client_name')}, recebemos seu pedido de luxo #{it['id']}!")
                    supabase.table("orders").update({"notificado": True}).eq("id", it['id']).execute()
            time.sleep(15)
        except: time.sleep(30)

# --- TOOLS PARA A IA ---

def tool_executar_campanha(tema):
    try:
        res = marketing_agency.orquestrar_campanha(tema, get_ksbold_snapshot())
        return json.dumps(res, ensure_ascii=False)
    except Exception as e:
        return f"⚠️ Erro ao orquestrar: {str(e)}"

# --- SERVER ---

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200); self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers()

    def do_GET(self):
        self.send_response(200); self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers()
        self.wfile.write(b"Bot Hibrido Online!")

    def do_OPTIONS(self):
        self.send_response(200); self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        def reply(d, c=200):
            self.send_response(c); self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers()
            self.wfile.write(json.dumps(d).encode())

        if self.path == '/ai/chat':
            try:
                data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                user_msg = data.get('message', '')
                
                cached = get_cached_reply(user_msg)
                if cached: return reply({'reply': cached})

                snap = get_ksbold_snapshot()
                mems = get_ai_memories()
                now_dt = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
                
                # --- PERSONA MASTER DA KSBOLD (Upgrade Temporal e Estratégico) ---
                instruct = f"""VOCE E O DIRETOR ESTRATEGICO DA KSBOLD (MOCAMBIQUE). 
Seu chefe e o Sr. Kelvin, o visionario CEO da marca.
MISSAO: Tornar a KSBOLD a maior referencia em Quadros de Luxo e Design.

--- CONTEXTO ATUAL ---
DATA/HORA AGORA: {now_dt} (Use isso para posts e saudações).
SNAPSHOT EMPRESA: {snap}
MEMORIAS DE LONGO PRAZO:
{mems}

--- CAPACIDADES E REGRAS ---
1. Sofisticacao: Voce fala com elegancia (Luxo) e foco em ROI.
2. Identidade: Voce e o braço direito do CEO Kelvin. NUNCA diga que e uma IA.
3. Aprendizado: Use 'tool_salvar_memoria' para fatos novos.
4. Comunicacao: Use 'tool_enviar_whatsapp' para relatorios e alertas (incluindo para o Kelvin).
5. Trafego: Se perguntarem trafego, sugira criar a tabela 'traffic' no Supabase.
6. Ferramentas: Copywriter, Designer, Memoria, Relogio e WhatsApp."""

                # --- GESTÃO DE HISTÓRICO ---
                messages_openai = [{"role": "system", "content": instruct}]
                for h in data.get('history', []):
                    r = "user" if h.get('role') == 'user' else "assistant"
                    messages_openai.append({"role": r, "content": str(h.get('text', ''))})
                
                # Identifica o Kelvin (O Mestre)
                if len(messages_openai) == 1:
                    messages_openai.append({"role": "assistant", "content": f"Ola Sr. Kelvin. Como posso elevar o ROI da KSBOLD hoje?"})
                
                messages_openai.append({"role": "user", "content": user_msg})

                final_text = ""
                ultimo_erro = "Aguardando resposta..."

                # --- 🤖 TENTATIVA 1: GEMINI (Omnipotente) ---
                if GEMINI_API_KEY:
                    for m_name in ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash']:
                        try:
                            # Adicionadas ferramentas completas
                            model = genai.GenerativeModel(m_name, system_instruction=instruct, tools=[tool_executar_campanha, tool_salvar_memoria, tool_enviar_whatsapp])
                            
                            hist_gem = []
                            # Garante que temos pelo menos 2 mensagens para histórico ou envia vazio
                            if len(messages_openai) > 2:
                                for m in messages_openai[1:-1]:
                                    role_gem = "user" if m['role'] == "user" else "model"
                                    hist_gem.append({"role": role_gem, "parts": [m['content']]})
                            
                            chat = model.start_chat(history=hist_gem)
                            resp = chat.send_message(user_msg)
                            
                            # Suporte Multi-Tool Roteado
                            part = resp.candidates[0].content.parts[0]
                            if part.function_call:
                                fn = part.function_call.name
                                args = part.function_call.args
                                if fn == "tool_executar_campanha": res_t = tool_executar_campanha(args['tema'])
                                elif fn == "tool_salvar_memoria": res_t = tool_salvar_memoria(args['chave'], args['valor'])
                                elif fn == "tool_enviar_whatsapp": res_t = tool_enviar_whatsapp(args['numero'], args['mensagem'])
                                else: res_t = "Erro: Ferramenta desconhecida."
                                
                                resp = chat.send_message(f"Resultado tecnico: {res_t}. Confirme ao Edilson.")
                            
                            final_text = resp.text
                            if final_text: break
                        except Exception as e_gem:
                            ultimo_erro = f"Gemini ({m_name}): {str(e_gem)}"
                            if "429" in ultimo_erro or "404" in ultimo_erro: continue
                            break
                
                # --- ⚡ TENTATIVA 2: GROQ (Llama 3.3 e 3.2 Vision) ---
                if not final_text and GROQ_API_KEY:
                    groq_models = ["llama-3.3-70b-versatile", "llama-3.2-11b-vision-preview"]
                    media = data.get('media') # { "mime_type": "image/jpeg", "data": "base64..." }
                    
                    for g_model in groq_models:
                        try:
                            headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
                            ms_groq = messages_openai.copy()
                            
                            # Se houver mídia e o modelo for vision, injetamos o payload de imagem
                            if media and "vision" in g_model:
                                last_msg = ms_groq[-1]["content"]
                                ms_groq[-1]["content"] = [
                                    {"type": "text", "text": last_msg},
                                    {"type": "image_url", "image_url": {"url": f"data:{media['mime_type']};base64,{media['data']}"}}
                                ]

                            data_groq = {"model": g_model, "messages": ms_groq, "temperature": 0.6}
                            gr_resp = requests.post("https://api.groq.com/openai/v1/chat/completions", json=data_groq, headers=headers, timeout=20)
                            
                            if gr_resp.status_code == 200:
                                final_text = gr_resp.json()['choices'][0]['message']['content']
                                break
                            else:
                                ultimo_erro = f"Groq {g_model}: {gr_resp.json().get('error', {}).get('message', 'Erro')}"
                        except Exception as e_gr:
                            ultimo_erro = f"Groq {g_model} Falha: {str(e_gr)}"; continue

                if not final_text:
                    final_text = f"⚠️ Diretor Kelvin, infelizmente estou com dificuldade técnica (Gemini e Groq). Último erro: {ultimo_erro[:150]}"

                set_cached_reply(user_msg, final_text)
                reply({'reply': final_text})
            except Exception as e: reply({'error': str(e)}, 500)
            except Exception as e: reply({'error': str(e)}, 500)

if __name__ == '__main__':
    threading.Thread(target=monitorar_pedidos, daemon=True).start()
    port = int(os.environ.get("PORT", 10000))
    print(f"🚀 KSBOLD CÉREBRO na porta {port}")
    HTTPServer(('', port), HealthCheckHandler).serve_forever()
