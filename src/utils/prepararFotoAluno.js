/**
 * Converte uma foto selecionada da galeria ou capturada no celular para
 * um JPEG quadrado de 512px. O upload final é pequeno e padronizado.
 */
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const LIMITE_ORIGINAL = 8 * 1024 * 1024;
const TAMANHO = 512;

export async function prepararFotoAluno(arquivo) {
  if (!arquivo || !TIPOS.includes(arquivo.type)) {
    throw new Error('Selecione uma foto JPG, PNG, WebP ou HEIC compatível com seu navegador.');
  }
  if (arquivo.size > LIMITE_ORIGINAL) {
    throw new Error('A foto deve ter no máximo 8 MB.');
  }

  let imagem;
  let enderecoTemporario;
  try {
    if (typeof createImageBitmap === 'function') {
      imagem = await createImageBitmap(arquivo);
    } else {
      enderecoTemporario = URL.createObjectURL(arquivo);
      imagem = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Não foi possível abrir a foto.'));
        img.src = enderecoTemporario;
      });
    }

    const largura = imagem.width || imagem.naturalWidth;
    const altura = imagem.height || imagem.naturalHeight;
    if (!largura || !altura) throw new Error('A foto possui dimensões inválidas.');

    const lado = Math.min(largura, altura);
    const canvas = document.createElement('canvas');
    canvas.width = TAMANHO;
    canvas.height = TAMANHO;
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('O dispositivo não conseguiu preparar a foto.');
    contexto.drawImage(
      imagem,
      (largura - lado) / 2, (altura - lado) / 2, lado, lado,
      0, 0, TAMANHO, TAMANHO
    );

    const resultado = await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Não foi possível comprimir a foto.'));
      }, 'image/jpeg', 0.82);
    });
    if (resultado.size > 2 * 1024 * 1024) {
      throw new Error('A foto ficou muito grande. Escolha outra imagem.');
    }
    return resultado;
  } finally {
    if (imagem && typeof imagem.close === 'function') imagem.close();
    if (enderecoTemporario) URL.revokeObjectURL(enderecoTemporario);
  }
}

export function mensagemErroFotoProfessor(erro) {
  switch (erro?.code) {
    case 'storage/unauthorized':
      return 'O Storage recusou a foto. É necessário autorizar o envio pelo professor nas regras do Firebase Storage.';
    case 'storage/bucket-not-found':
      return 'O bucket do Firebase Storage não foi encontrado. Confira a configuração do projeto.';
    case 'storage/quota-exceeded':
      return 'O Firebase Storage atingiu uma cota. Confira o plano e o consumo.';
    case 'permission-denied':
      return 'A foto foi enviada, mas o Firestore não permitiu vinculá-la ao aluno. Verifique as regras da coleção alunos.';
    default:
      return erro?.message || 'Não foi possível enviar a foto. Confira a conexão e as regras do Firebase.';
  }
}
