# Semana 1 — Etapa 4: preparação da distribuição Windows assinada

**Status:** código e validações prévias preparados. **Nenhum instalador foi assinado** nesta entrega: falta o certificado de assinatura confiável do proprietário. **Não foi feita publicação no GitHub.**

## 1. Por que não existe EXE assinado pronto?

Assinatura Authenticode requer certificado de *code signing* legítimo e acesso à chave de assinatura. Chaves de certificados públicos novos (desde junho de 2023) normalmente ficam protegidas em token/hardware/HSM e não podem ser exportadas para `.pfx`. **Não envie chaves ou PINs para a conversa e não os comite no repositório.** Um certificado autoassinado pode servir para testes em ambiente controlado, mas não é equivalente a uma assinatura confiável por Windows/SmartScreen.

O serviço de assinatura pública Azure Artifact Signing/Trusted Signing atualmente restringe países de habilitação; **Brasil não consta como elegível para certificados Public Trust**, mesmo existindo a região *Brazil South*. Verifique a política vigente antes de contratar. No Brasil, caminhos possíveis incluem certificados de CA com hardware token/HSM e serviços compatíveis de assinatura remota, conforme elegibilidade da CA.

## 2. O que foi preparado

- `scripts/signed-builder.config.cjs`: configuração isolada do `electron-builder` **v26** para assinatura Windows real e `forceCodeSigning: true`; verifica o subject exato do certificado no updater.
- `scripts/build-signed.js`: build manual, verifica lockfile/testes, liga o updater **apenas durante empacotamento**, executa a assinatura e a verificação posterior, restaura o template seguro com `enabled: false` mesmo quando falha.
- `scripts/verify-signed.ps1`: exige Authenticode `Status = Valid`, publisher idêntico ao certificado declarado, executável interno e instalador assinados, `latest.yml` ou `beta.yml` com SHA512, e `app-update.yml` com publisher.
- `.github/workflows/windows-signed-candidate.yml`: workflow manual em runner próprio com token/HSM, ambiente `signed-release` protegido; gera **somente um artefato de teste**, não uma Release.
- `test/signed-release.test.js`: testes de segurança que bloqueiam uso sem certificado e não alteram a política de desenvolvimento.
- `.gitignore`: exclusão de arquivos sensíveis de certificação, além das exclusões anteriores.

**Esta versão continua sendo a prévia `0.4.0-beta.1`.** Uma versão estável precisa de bump de versão, changelog e testes de atualização antes do primeiro lançamento público.

## 3. Pré-requisitos reais

1. Certificado válido para **assinatura de código Windows** de publicador verificado, armazenado em token/HSM ou serviço de assinatura compatível.
2. Driver/middleware da CA instalado no Windows e certificado visível no **Windows Certificate Store** (assinatura via `signtool`).
3. Nome (CN) e subject exatos do certificado, observados **localmente**, sem compartilhar chave privada nem PIN.
4. Versão correta de Node.js, npm e Git; no projeto: `npm run lock:sync`, `npm run lock:verify`, `npm ci` e testes.
5. Windows SDK/signtool disponível quando solicitado pelo fornecedor da CA e chave/timestamp acessíveis.

### Como identificar sua identidade de assinatura

No PowerShell, **no próprio computador que possui o token**:

```powershell
Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Select-Object Subject, Thumbprint, NotAfter
```

A CA pode usar outro repositório; verifique com o fornecedor. O CN usado no `EDGE_SIGN_CERT_NAME` identifica o certificado no armazenamento. O `EDGE_SIGN_PUBLISHER` deve corresponder **exatamente ao `Subject`** do certificado, por exemplo `CN=Nome Validado, O=Empresa, C=BR`. Não use `geanjhonatan` como valor inventado.

## 4. Gerar candidato assinado (somente Windows, sem publicar)

Use **uma cópia separada do projeto**. A partir do PowerShell:

```powershell
npm run lock:sync
npm run lock:verify
npm ci
npm run check
npm test
npm run release:preflight

$env:EDGE_SIGN_CERT_NAME = 'CN_REAL_DO_SEU_CERTIFICADO'
$env:EDGE_SIGN_PUBLISHER = 'SUBJECT_EXATO_DO_SEU_CERTIFICADO'
npm run dist:signed
```

Quando houver certificado instalado e acesso ao PIN/timestamp, o script executará e conferirá a assinatura. O arquivo resultante estará em `dist/Edge Sidebar Lite-Setup-0.4.0-beta.1-x64.exe` e o manifesto no canal beta (`beta.yml`). Não publique no canal `latest` ainda.

**Sem certificado**, `npm run dist:signed` falha propositalmente. **Nunca** edite `src/update-security.json` manualmente para tentar habilitar instalação de updates não assinados.

## 5. Candidato via GitHub Actions (opcional)

GitHub-hosted runners comuns **não possuem acesso ao seu token físico**. O workflow preparado utiliza um runner Windows **self-hosted** com as labels `self-hosted`, `windows`, `x64`, `code-signing`, certificado e middleware configurados.

1. Isolar o runner para builds autorizados; jamais executá-lo em PRs de terceiros.
2. Criar o ambiente GitHub `signed-release`, com aprovadores obrigatórios e acesso restrito à branch `main`.
3. Configurar as variáveis de ambiente GitHub `EDGE_SIGN_CERT_NAME` e `EDGE_SIGN_PUBLISHER` com **identidade pública** do certificado (não com PIN/chave).
4. Autorizar manualmente **Signed Windows candidate (manual only)** em **Actions** após aprovação do código na `main`.
5. Baixar o artefato privado de teste (retenção curta). **Não há publicação automática em Releases.**

Importante: um runner que tenha acesso ao token deve ser dedicado a esse workflow e não executar código arbitrário. Não guarde PIN em variáveis de repositório sem orientação da CA e controles apropriados.

## 6. Checklist para uma Release pública futura

- [ ] Certificado de publicador validado, sem chave/PIN no Git.
- [ ] `npm run lock:sync` concluído e **lockfile versionado coerente**, depois `npm ci`.
- [ ] `npm audit` e análise de dependências concluídos em rede funcional.
- [ ] `npm run check`, `npm test`, assinatura Authenticode real e inspeção do `app-update.yml` aprovados.
- [ ] Instalador assinado testado em **Windows 10/11** e diversas resoluções/DPI.
- [ ] Upgrade **real** da versão A assinada para versão B assinada, preservando cookies, favicons, configuração e abas protegidas.
- [ ] Simular alterações maliciosas e recusa de atualizações com assinatura de outro publicador.
- [ ] Testar `autoDownload`, `installOnQuit`, falta de internet, download interrompido e rollback manual.
- [ ] Definir licença de distribuição e identidade pública do publicador.
- [ ] Escolher versão estável `v0.4.0` ou superior e publicar **somente com aprovação explícita** uma GitHub Release, com EXE assinado, `.blockmap`, `latest.yml` e notas.

A primeira atualização segura **não será retroativa**: usuários com instaladores antigos sem identidade de publicador confiável podem precisar instalar a nova base assinada manualmente. O manifesto v26 é servido por HTTPS e referencia hashes SHA512; a proteção decisiva do instalador é sua assinatura Authenticode verificada. Avalie a assinatura Ed25519 de manifestos das novas versões do builder após estabilização da linha v27.

### Referências

- https://www.electron.build/v26/docs/features/code-signing/code-signing-win/
- https://www.electron.build/v26/docs/win/
- https://www.electron.build/v26/docs/features/auto-update/
- https://learn.microsoft.com/pt-br/azure/artifact-signing/quickstart
- https://cabforum.org/working-groups/code-signing/requirements/
