# Semana 1 — Etapa 3: Atualizações automáticas (prévia segura)

## O que está entregue

Código e UI de atualização incluídos em `src/update-service.js`, `src/main.js`, `src/preload.js` e renderer; versão `0.4.0-beta.1` com uma etapa de teste Windows ainda pendente.

### Fluxo A — Aplicativo em desenvolvimento / sem assinatura

1. O usuário abre Configurações -> Atualizações.
2. O app consulta `https://api.github.com/repos/geanjhonatan/edge-sidebar-lite/releases/latest` e compara a versão com a instalada.
3. Se encontrar uma versão mais nova, apresenta a versão, notas de lançamento, aviso e opção de adiar ou **Ver Releases**.
4. O download/install automático **não está disponível**; não segue URLs arbitrários retornados pelo GitHub.
5. Sem Release publicada, informa que não há versões públicas. Falhas de conexão não alteram a instalação.

### Fluxo B — Futuro instalador com assinatura (código preparado)

Quando tiver certificado confiável, aprovação explícita e testes:

1. Configure assinatura Authenticode do `electron-builder` para EXE/NSIS, usando as credenciais no ambiente seguro da CI (não em commits).
2. Confira o subject exato do certificado e configure o campo `publisherName` do builder, mantendo `verifyUpdateCodeSignature=true`.
3. Configure `src/update-security.json` **somente na branch de lançamento assinada**; nunca habilite manualmente em um binário sem assinatura.
4. Publique o NSIS assinado, `latest.yml`, `.blockmap` e notas na GitHub Releases, com tag correspondente ao `package.json`.
5. Faça teste de upgrade em Windows 10/11 de uma versão assinada para outra e confira o publisher com PowerShell: `Get-AuthenticodeSignature <arquivo>.exe`.
6. Teste falha de assinatura, download interrompido, sem internet, rollback, fechamento com música e preservação de `userData`.

> **Não é um guia para habilitar verificação de assinatura falsa**. SHA512 do instalador não substitui assinatura de publicador. `electron-builder` v26 e `electron-updater` 6 possuem verificação Authenticode no Windows, mas não há autenticação do manifesto GitHub (`latest.yml`) por chave Ed25519 nesta linha estável. Considere migrar com cuidado para a v27 quando estabilizar, para verificação assinada dos manifestos.

## Publicação após aprovação (não executar agora)

1. Atualize a versão em `package.json` e `package-lock.json` e execute `npm ci`.
2. Faça `npm run check`, `npm test`, `npm audit --omit=dev` e verificações de segurança.
3. Gere o pacote Windows usando certificado aprovado. `npm run dist:win` cria a saída em `dist/`.
4. Verifique `signtool verify /pa` ou `Get-AuthenticodeSignature` e confira o publicador.
5. Crie no GitHub uma **Release oficial** com versão maior, com changelog e os arquivos `.exe`, `latest.yml` e `.blockmap` (artefatos relevantes). Não publique Releases para esta prévia não assinada.
6. Ative a experiência automática somente após um instalador inicial assinado que possua o publicador confiável incorporado.

## Checklist de testes Windows

- [ ] Instalação limpa sem apagar outra versão.
- [ ] Configurações e cookies existentes preservados ao atualizar.
- [ ] Abas tocando áudio continuam vivas ao trocar de sites.
- [ ] Configurações -> Atualizações mostra a versão correta.
- [ ] Sem internet: erro legível, sem travar a Sidebar.
- [ ] Sem Release: mostra estado adequado.
- [ ] Release mais nova: mostra notas e notificação.
- [ ] Notificação adiada não aparece repetidamente.
- [ ] Testar atualização assinada simulando `download-progress` e `update-downloaded`.
- [ ] Assinatura adulterada é rejeitada por verificação real do instalador.
- [ ] Atualização real assinada da versão A para B com rollback e logs.
- [ ] Instalar ao fechar e "Depois" preservam trabalho e não encerram música inesperadamente.
- [ ] Verificar desempenho (CPU/memória) e compatibilidade com AppBar, múltiplos monitores e DPI.

## Decisões de privacidade

Nenhum analytics foi adicionado. A checagem lê metadados públicos de GitHub Releases, sem enviar cookies de navegação, histórico ou dados do usuário. Preferências de atualização ficam no `config.json` protegido por gravação atômica.
