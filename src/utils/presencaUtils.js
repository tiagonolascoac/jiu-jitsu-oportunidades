// Mesma data civil para aluno e professor, mesmo se o dispositivo estiver em outro fuso.
const fuso = 'America/Rio_Branco';

export function dataHojeAcre() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

export function diaSeguinte(data) {
  const base = new Date(`${data}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
}

// Uma presença por aluno por data: escritor aluno e professor compartilham o documento.
export function idPresenca(alunoId, data) {
  return `${alunoId}_${data}`;
}

// Registros antigos criados via addDoc() podem ser duplicados: contabilizar apenas
// um por aluno e dia, priorizando presença quando há registros divergentes.
export function presencasSemDuplicidade(registros) {
  const unicos = new Map();
  (registros || []).forEach((registro, posicao) => {
    const chave = registro.alunoId && registro.data
      ? `${registro.alunoId}::${registro.data}`
      : `desconhecido-${registro.id || posicao}`;
    const anterior = unicos.get(chave);
    if (!anterior || (anterior.status !== 'presente' && registro.status === 'presente')) {
      unicos.set(chave, registro);
    }
  });
  return Array.from(unicos.values());
}
