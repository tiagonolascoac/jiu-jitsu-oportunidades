import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { idPresenca } from './presencaUtils';

// Transação evita que dois clientes ATUALIZADOS criem registros concorrentes
// para o mesmo aluno/dia. Registros legados addDoc devem ser conferidos antes.
export async function registrarPresencaUnica({ alunoId, data, ...campos }) {
  const referencia = doc(db, 'presencas', idPresenca(alunoId, data));
  return runTransaction(db, async (transacao) => {
    const registro = await transacao.get(referencia);
    if (registro.exists()) return { criado: false, registro: registro.data() };
    transacao.set(referencia, { ...campos, alunoId, data });
    return { criado: true };
  });
}
