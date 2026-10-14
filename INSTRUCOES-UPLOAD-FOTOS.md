# Correção do upload de foto — Jiu-Jitsu Oportunidades

## O que foi corrigido no React

- Corrigido o HTML inválido de botão dentro de botão (`AlunoAvatar` sem clique agora é um `span`).
- Foto é validada e convertida no navegador em um JPEG quadrado de 512 x 512 px, antes do upload.
- O caminho de upload é sempre `alunos/{UID do usuário autenticado}/perfil.jpg`, evitando arquivos repetidos.
- O documento em `alunos/{idDoCadastro}` recebe **apenas** `fotoUrl`; `faixa`, `grau`, `tipo`, `turma` e outros campos não são alterados.
- Erros de upload/permissões aparecem na tela do aluno.

## Verifique o Firebase antes de testar

1. Firebase Console → **Storage**: confirme que o bucket foi criado. Confira se o **nome real do bucket** coincide com o `storageBucket` em `src/firebase.js`. Neste projeto, o código contém `jiu-jitsu-oportunidades.firebasestorage.app`.
2. Firebase Console → **Plano e faturamento**: desde 03/02/2026, o Cloud Storage for Firebase exige o plano **Blaze**. Pode haver uso gratuito dentro da cota, mas o plano Spark não atende ao serviço.
3. Firebase Console → Storage → **Rules**: junte um bloco de regras da foto às regras atuais. **Não substitua as regras inteiras sem revisar os demais caminhos.**
4. Firebase Console → Firestore Database → **Rules**: o aluno precisa de permissão para atualizar apenas `fotoUrl` do próprio cadastro, sem poder modificar a graduação. As regras de Firestore são diferentes das de Storage.

### Modelo de regra Storage (junte dentro de `match /b/{bucket}/o`)

```js
match /alunos/{uid}/perfil.jpg {
  // Permite que usuários autenticados consultem fotos para exibir na presença.
  allow read: if request.auth != null;
  // Somente o próprio aluno dono do UID envia uma foto JPEG pequena.
  allow write: if request.auth != null
               && request.auth.uid == uid
               && request.resource != null
               && request.resource.size < 2 * 1024 * 1024
               && request.resource.contentType == 'image/jpeg';
}
```

Exemplo completo **apenas** se você tiver certeza de que não existem outras regras Storage necessárias:

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /alunos/{uid}/perfil.jpg {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource != null
                   && request.resource.size < 2 * 1024 * 1024
                   && request.resource.contentType == 'image/jpeg';
    }
  }
}
```

### Modelo de permissão Firestore (mesclar com suas regras existentes)

Somente para demonstrar como autorizar a alteração de foto, **não publique isoladamente**:

```js
match /alunos/{alunoId} {
  allow update: if request.auth != null
    && (resource.data.usuarioId == request.auth.uid || alunoId == request.auth.uid)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['fotoUrl']);
}
```

Atenção: permissões Firestore de diferentes `allow` / `match` são combinadas com **OU**. Portanto, outras regras de update existentes também devem ser revisadas, especialmente para impedir que alunos editem `faixa` ou `grau` diretamente.

### Se aparecer erro CORS

O erro de preflight (resposta HTTP não-2xx) **não prova sozinho** que falta uma configuração CORS. No navegador, DevTools → Network → filtre `firebasestorage` e veja o **status do OPTIONS**. Respostas HTTP 402 ou 403 podem indicar plano/bucket/permissão. Primeiro confirme plano Blaze, existência do bucket e regras. Se a requisição ainda for bloqueada com bucket e plano corretos, será preciso investigar a configuração de CORS e a resposta HTTP real do bucket.

Não abra o Storage para o mundo com `allow read, write: if true` e não mude as regras do Firestore apenas para testar fotos.

## Testes

- Faça login como aluno, toque no avatar e envie PNG/JPG.
- Confirme que o avatar aparece após recarregar e na tela de presença para professor.
- Confirme que aluno não pode alterar a graduação.
- Teste novamente em celular.
