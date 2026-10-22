# Fase 2 - HWID via launcher (estrutura pronta, NAO ligada)

O launcher nao consegue enviar o pacote `RequestHardWareInfo`; quem fala o protocolo e o `l2.exe`.
Por isso o servidor precisa de um canal proprio. Esta fase **nao esta implementada**: nao ha endpoint,
chave nem token no codigo.

## O que ja existe (`internal/hwid`)
- `Compute(salt, raw)`: SHA-256 de `salt + 0x00 + dado`. Nunca enviar MAC/serial em texto puro.
- `RawMachineSource()` (Windows): le o `MachineGuid` do registro; o valor bruto fica so em memoria.
- `Report{Account, SessionToken, MachineID}` e a interface `Reporter` (`Send`). Hoje so existe `Noop`.
- `launcher.json` -> `hwid.enabled=false`, `hwid.endpoint=""`. Nada e enviado.

## O que falta combinar
1. URL (HTTPS) e formato do endpoint no site/painel.
2. Como o launcher obtem conta + token de sessao (login no launcher? token emitido pelo painel?).
3. De onde vem o `salt` (entregue pelo servidor na sessao, nunca fixo no codigo).
4. Politica de privacidade: avisar o jogador do que e enviado (apenas o hash).
5. No servidor (AkamanahGuard): associar `MachineID` a conta; lembrar que quem controla o launcher
   controla o envio - o hash e um sinal adicional, nao prova.

## Como ligar depois
Implementar `Reporter` (cliente HTTPS), chamar `hwid.Compute` + `Send` em `cmd/launcher` apos o login,
somente se `hwid.enabled` for true e `endpoint` comecar com `https://`.
