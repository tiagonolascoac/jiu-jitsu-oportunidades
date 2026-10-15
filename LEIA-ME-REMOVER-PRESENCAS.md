# Atualização: nomes curtos e remoção de lançamentos de presença

## O que mudou
- A chamada exibe **primeiro nome + último sobrenome** em Pendentes e Registrados. O nome completo permanece no Firestore, na busca e no mini perfil.
- Ajustes de CSS para não quebrar o layout da chamada no celular.
- Novo botão **Remover presença** na seção Registrados, para Admin/Professor.
- Confirmação obrigatória antes de excluir.
- Para a data selecionada e o aluno escolhido, todos os documentos correspondentes da coleção `presencas` são removidos em um único lote: inclui documentos legados com IDs automáticos e possíveis duplicatas GPS/manual.
- A lista de Registrados/Pendentes se atualiza com `onSnapshot` sem precisar atualizar a página.

## Qual ZIP usar?
- `jiu-jitsu-ajuste-nomes-remover-presenca.zip`: use SE JÁ INSTALOU o patch anterior de sincronização; possui apenas `Presenca.js`, `Presenca.css` e este README.
- `jiu-jitsu-presencas-atualizacao-completa.zip`: use se ainda NÃO INSTALOU o patch anterior de sincronização; contém os arquivos da correção anterior + estes ajustes.

## Como instalar
1. Faça backup dos arquivos do projeto.
2. Extraia o ZIP **na raiz** do projeto `C:\\Users\\Administrator\\jiu-jitsu-manager` preservando a estrutura `src/components`, `src/styles` e, no ZIP completo, `src/utils`.
3. Execute `npm run build` antes do push.
4. Se compilar: `git add .`, `git commit -m "Ajusta nomes e permite remover presencas"`, `git push origin main`.

## Como remover os registros incorretos de 15/10/2026
1. Entre como Admin ou Professor e vá em **Presença**.
2. Em **Data**, selecione **15/10/2026**.
3. Em **Turma**, selecione a turma correta.
4. Abra **Registrados** e clique em **Remover presença** do aluno desejado.
5. Leia e confirme a quantidade de documentos que serão apagados. Quando concluir, o aluno volta a **Pendentes**.
6. Repita nos alunos com registros incorretos. **Não há exclusão em massa** para evitar apagar lançamentos válidos.

ATENÇÃO: Não apague automaticamente todos os registros do dia 15: versões anteriores utilizavam data UTC, então alguns podem se referir à noite local do dia 14. Verifique antes de apagar. Não existe recuperação automática dos documentos excluídos.

## Erro de permissão
A exclusão depende de as regras atuais do Firestore permitirem `delete` em `presencas` para professores autorizados e administradores. **Não altere regras existentes sem revisá-las**. Se retornar `permission-denied`, envie as regras atuais para revisão segura.

## Limitações
- Este ZIP altera o código local; NÃO modifica o Firebase remoto nem apaga os dados da coleção.
- Como não temos credenciais de leitura/gravação no Firebase deste projeto nesta conversa, não conferimos os registros reais de 15/10.
- O painel do aluno pode precisar de atualização da página para refletir a remoção, mas a chamada do professor atualiza em tempo real.
