-- Catálogo de alimentos brasileiros (base semelhante à TACO) usado pelo
-- motor de geração automática do protocolo alimentar. Valores nutricionais
-- por 100 g, mais uma porção usual em gramas para exibição/edição.
create table foods_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null
    check (category in ('cereais_e_paes','leguminosas','carnes_e_ovos','laticinios','frutas','vegetais','tuberculos','gorduras_e_oleaginosas','bebidas_e_outros')),
  kcal_100g numeric(6,1) not null,
  protein_100g numeric(5,1) not null default 0,
  carb_100g numeric(5,1) not null default 0,
  fat_100g numeric(5,1) not null default 0,
  usual_portion_g numeric(6,1) not null default 100,
  usual_portion_label text not null default '100 g'
);

alter table foods_catalog enable row level security;

create policy "anyone reads the food catalog" on foods_catalog
  for select using (true);

insert into foods_catalog (name, category, kcal_100g, protein_100g, carb_100g, fat_100g, usual_portion_g, usual_portion_label) values
('Arroz branco cozido','cereais_e_paes',128,2.5,28.1,0.2,100,'4 col. sopa'),
('Arroz integral cozido','cereais_e_paes',124,2.6,25.8,1.0,100,'4 col. sopa'),
('Pão francês','cereais_e_paes',300,8.0,58.6,3.1,50,'1 unidade'),
('Pão integral','cereais_e_paes',253,9.4,49.9,3.3,50,'2 fatias'),
('Aveia em flocos','cereais_e_paes',394,13.9,67.0,8.5,30,'3 col. sopa'),
('Tapioca (goma)','cereais_e_paes',240,0.2,58.9,0.0,60,'1 unidade média'),
('Macarrão cozido','cereais_e_paes',158,5.8,30.9,1.0,100,'1 escumadeira'),
('Granola','cereais_e_paes',471,10.1,64.8,19.8,30,'2 col. sopa'),
('Quinoa cozida','cereais_e_paes',120,4.4,21.3,1.9,100,'4 col. sopa'),
('Cuscuz de milho','cereais_e_paes',112,2.5,25.5,0.2,100,'2 fatias'),

('Feijão carioca cozido','leguminosas',76,4.8,13.6,0.5,100,'1 concha'),
('Feijão preto cozido','leguminosas',77,4.5,14.0,0.5,100,'1 concha'),
('Lentilha cozida','leguminosas',93,6.3,16.3,0.5,100,'3 col. sopa'),
('Grão-de-bico cozido','leguminosas',121,7.3,20.8,1.9,100,'3 col. sopa'),
('Ervilha cozida','leguminosas',81,5.4,14.5,0.4,80,'2 col. sopa'),

('Peito de frango grelhado','carnes_e_ovos',159,32.0,0.0,2.5,120,'1 filé'),
('Frango desfiado','carnes_e_ovos',163,29.8,0.0,4.3,100,'4 col. sopa'),
('Patinho grelhado','carnes_e_ovos',219,35.9,0.0,7.3,120,'1 bife'),
('Carne moída (patinho)','carnes_e_ovos',172,26.1,0.0,6.9,100,'4 col. sopa'),
('Filé de tilápia grelhado','carnes_e_ovos',128,26.2,0.0,2.0,120,'1 filé'),
('Salmão grelhado','carnes_e_ovos',208,25.4,0.0,11.0,120,'1 posta'),
('Atum em lata (água)','carnes_e_ovos',116,25.5,0.0,0.8,80,'1/2 lata'),
('Ovo cozido','carnes_e_ovos',146,13.3,0.6,9.5,50,'1 unidade'),
('Ovo mexido','carnes_e_ovos',196,13.9,1.2,15.0,60,'1 unidade'),
('Clara de ovo','carnes_e_ovos',48,10.9,0.7,0.0,33,'1 unidade'),
('Carne suína lombo grelhado','carnes_e_ovos',210,28.0,0.0,10.0,120,'1 filé'),

('Leite desnatado','laticinios',35,3.4,4.9,0.2,200,'1 copo'),
('Leite integral','laticinios',61,3.2,4.5,3.3,200,'1 copo'),
('Iogurte natural','laticinios',51,4.1,4.9,1.5,170,'1 pote'),
('Iogurte natural desnatado','laticinios',41,4.4,5.7,0.2,170,'1 pote'),
('Iogurte grego','laticinios',97,9.0,4.0,5.0,100,'1 pote pequeno'),
('Queijo branco (minas frescal)','laticinios',264,17.4,3.2,20.2,30,'2 fatias'),
('Queijo mussarela','laticinios',330,22.6,3.0,25.2,30,'2 fatias'),
('Ricota','laticinios',140,12.6,3.8,8.1,30,'2 col. sopa'),
('Requeijão','laticinios',257,9.6,3.0,23.0,20,'1 col. sopa'),

('Banana prata','frutas',98,1.3,26.0,0.1,100,'1 unidade'),
('Maçã','frutas',56,0.3,15.2,0.1,130,'1 unidade'),
('Mamão','frutas',40,0.6,10.4,0.1,150,'1 fatia'),
('Laranja','frutas',37,0.9,8.9,0.1,150,'1 unidade'),
('Morango','frutas',30,0.9,6.8,0.3,100,'8 unidades'),
('Abacate','frutas',96,1.2,6.0,8.4,100,'1/2 unidade pequena'),
('Uva','frutas',53,0.7,13.3,0.2,100,'1 cacho pequeno'),
('Melancia','frutas',33,0.9,8.1,0.0,150,'1 fatia'),
('Manga','frutas',64,0.4,16.7,0.2,120,'1/2 unidade'),

('Brócolis cozido','vegetais',25,2.1,4.0,0.3,100,'4 col. sopa'),
('Couve refogada','vegetais',35,1.9,3.9,1.7,80,'3 col. sopa'),
('Cenoura crua','vegetais',34,0.9,7.7,0.2,80,'1 unidade'),
('Abobrinha refogada','vegetais',19,1.2,3.4,0.3,100,'4 col. sopa'),
('Tomate','vegetais',18,0.9,3.9,0.2,90,'1 unidade'),
('Alface','vegetais',15,1.4,2.4,0.2,50,'4 folhas'),
('Espinafre refogado','vegetais',23,2.6,3.6,0.3,80,'3 col. sopa'),
('Abóbora cozida','vegetais',40,1.4,9.7,0.1,100,'1 pedaço'),
('Vagem cozida','vegetais',22,1.5,4.6,0.1,80,'3 col. sopa'),

('Batata-doce cozida','tuberculos',77,0.6,18.4,0.1,100,'1 unidade média'),
('Batata inglesa cozida','tuberculos',52,1.2,11.9,0.0,100,'1 unidade média'),
('Mandioca cozida','tuberculos',125,0.6,30.1,0.3,100,'1 pedaço'),
('Inhame cozido','tuberculos',97,1.5,23.2,0.1,100,'1 pedaço'),
('Mandioquinha (batata-baroa) cozida','tuberculos',80,1.0,18.9,0.2,100,'1 unidade'),

('Azeite de oliva','gorduras_e_oleaginosas',884,0.0,0.0,100.0,10,'1 col. sopa'),
('Castanha-do-pará','gorduras_e_oleaginosas',656,14.5,12.3,66.4,20,'3 unidades'),
('Castanha de caju','gorduras_e_oleaginosas',570,18.5,29.1,46.3,20,'1 punhado'),
('Amêndoas','gorduras_e_oleaginosas',579,21.2,21.7,49.9,20,'1 punhado'),
('Pasta de amendoim integral','gorduras_e_oleaginosas',588,25.1,20.0,50.4,15,'1 col. sopa'),
('Chia (semente)','gorduras_e_oleaginosas',486,16.5,42.1,30.7,10,'1 col. sopa'),
('Linhaça (semente)','gorduras_e_oleaginosas',495,14.1,43.3,32.3,10,'1 col. sopa'),

('Água de coco','bebidas_e_outros',22,0.1,5.3,0.1,200,'1 copo'),
('Whey protein (pó)','bebidas_e_outros',376,80.0,7.0,3.5,30,'1 dose'),
('Mel','bebidas_e_outros',309,0.4,84.0,0.0,15,'1 col. sopa'),
('Chá verde','bebidas_e_outros',1,0.0,0.2,0.0,200,'1 xícara');
