# Faixa e grau

O cadastro público agora recebe faixa e grau (0 a 4). O professor e o admin podem atualizar na aba Alunos. Ao trocar de faixa, o grau volta a zero. Registros antigos sem `grau` são exibidos como zero.

## Segurança obrigatória

A restrição de alteração da faixa e do grau pelo aluno precisa ser implementada nas regras do Firestore, tanto em `alunos/{uid}` quanto em `usuarios/{uid}`. A UI por si só não impede escrita direta no Firebase. **Não publique regras genéricas sem revisar as atuais**. Como o cadastro público escreve faixa e grau, permita-os somente na criação do documento pelo próprio aluno e impeça alterações subsequentes por esse papel.
