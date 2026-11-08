-- Proteção contra conexões presas (PLANO Fase 5): se o servidor morrer no meio de uma requisição,
-- o pooler pode deixar a conexão "idle in transaction", segurando bloqueios indefinidamente.
-- Com este limite, o Postgres encerra essas conexões após 60 s. Vale para novas conexões do
-- papel usado pela aplicação e pelas migrações (o dono das tabelas).
ALTER ROLE CURRENT_USER SET idle_in_transaction_session_timeout = '60s';
