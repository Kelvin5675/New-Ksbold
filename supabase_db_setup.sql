-- Fase 1: Criação da Tabela Messages e Alteração da Tabela Orders

-- 1. Alterar a Tabela orders adicionando colunas de identificação e recência
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_name text NULL,
ADD COLUMN IF NOT EXISTS client_phone text NULL,
ADD COLUMN IF NOT EXISTS last_message_at timestamp with time zone NULL;

-- 2. Criar a Tabela messages
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    sender_type text NOT NULL CHECK (sender_type IN ('client', 'admin', 'system')),
    content_type text NOT NULL CHECK (content_type IN ('text', 'image', 'invoice', 'system_alert')),
    content jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone NULL
);

-- 3. Criar índice para acesso mais rápido por order_id
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON public.messages(order_id);

-- Opcional / Obrigatório caso utilize RLS ativo nativo da KSBOLD:
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Limpar Regras Antigas para evitar erro "already exists"
DROP POLICY IF EXISTS "Permitir leitura de todos os pedidos no FrontEnd" ON public.orders;
DROP POLICY IF EXISTS "Permitir criacao de novos pedidos no FrontEnd (Compras)" ON public.orders;
DROP POLICY IF EXISTS "Permitir update de dados do cliente (Onboarding)" ON public.orders;

-- Criar Novas Regras Tolerantes
CREATE POLICY "Permitir leitura de todos os pedidos no FrontEnd" 
ON public.orders FOR SELECT USING (true);

CREATE POLICY "Permitir criacao de novos pedidos no FrontEnd (Compras)"
ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir update de dados do cliente (Onboarding)"
ON public.orders FOR UPDATE USING (true);

CREATE POLICY "Permitir exclusao de pedidos para Admin"
ON public.orders FOR DELETE USING (true);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir Select de mensagens do próprio chat"
ON public.messages FOR SELECT USING (true);

CREATE POLICY "Permitir Insercao de Novas Mensagens (Chat Front)"
ON public.messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir Update/Delete livre para Admin Interno"
ON public.messages FOR UPDATE USING (true);
CREATE POLICY "Permitir Update/Delete livre para Admin Interno 2"
ON public.messages FOR DELETE USING (true);

-- 4. Criar Tabela bot_settings (template de mensagem WhatsApp, etc.)
CREATE TABLE IF NOT EXISTS public.bot_settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de bot_settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Permitir escrita em bot_settings" ON public.bot_settings;

CREATE POLICY "Permitir leitura de bot_settings"
ON public.bot_settings FOR SELECT USING (true);

CREATE POLICY "Permitir escrita em bot_settings"
ON public.bot_settings FOR ALL USING (true);

-- 5. Inserir configurações padrão da Evolution API (credenciais movidas do frontend)
INSERT INTO public.bot_settings (key, value) VALUES
  ('evolution_api_url', 'https://ksbold-evolution-api.onrender.com'),
  ('evolution_api_key', 'ksbold-secreta-1234'),
  ('evolution_instance', 'ksbold-loja')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
