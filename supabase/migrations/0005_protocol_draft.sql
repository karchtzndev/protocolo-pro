-- Marca um protocolo como rascunho — o PDF exibe marca d'água enquanto isso
-- não for desmarcado pelo profissional.
alter table protocols add column is_draft boolean not null default true;
