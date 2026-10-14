import React, { useRef, useState } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db, storage } from '../firebase';
import AlunoAvatar from './AlunoAvatar';
import '../styles/FotoPerfilAluno.css';

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANHO_MAXIMO_ORIGINAL = 8 * 1024 * 1024;
const LADO_FOTO = 512;

// Padroniza em JPEG quadrado, reduzindo consumo de internet e armazenamento.
async function prepararFoto(arquivo) {
  let imagem;
  let enderecoTemporario;
  let fecharImagem = () => {};

  try {
    if (typeof createImageBitmap === 'function') {
      imagem = await createImageBitmap(arquivo);
      fecharImagem = () => imagem.close();
    } else {
      enderecoTemporario = URL.createObjectURL(arquivo);
      imagem = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('A imagem não pôde ser aberta.'));
        img.src = enderecoTemporario;
      });
    }

    const largura = imagem.width || imagem.naturalWidth;
    const altura = imagem.height || imagem.naturalHeight;
    if (!largura || !altura) throw new Error('Dimensões inválidas.');

    const lado = Math.min(largura, altura);
    const canvas = document.createElement('canvas');
    canvas.width = LADO_FOTO;
    canvas.height = LADO_FOTO;
    const contexto = canvas.getContext('2d');
    if (!contexto) throw new Error('Não foi possível preparar a imagem.');

    contexto.drawImage(
      imagem,
      (largura - lado) / 2, (altura - lado) / 2, lado, lado,
      0, 0, LADO_FOTO, LADO_FOTO
    );

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        convertido => convertido ? resolve(convertido) : reject(new Error('Não foi possível comprimir a imagem.')),
        'image/jpeg',
        0.82
      );
    });
    return blob;
  } finally {
    fecharImagem();
    if (enderecoTemporario) URL.revokeObjectURL(enderecoTemporario);
  }
}

function mensagemDeErro(error) {
  if (error?.code === 'storage/unauthorized') {
    return 'O Storage não autorizou o envio. Confira as regras de fotos no Firebase Storage.';
  }
  if (error?.code === 'storage/bucket-not-found') {
    return 'Bucket de fotos não encontrado. Confira o endereço do bucket no Firebase Storage.';
  }
  if (error?.code === 'permission-denied') {
    return 'O Firestore não autorizou salvar a foto no perfil. Confira as regras da coleção alunos.';
  }
  if (error?.code === 'storage/canceled') return 'Envio cancelado.';
  if (error?.code === 'storage/quota-exceeded') {
    return 'O Firebase Storage bloqueou o acesso. Verifique o plano Blaze e as cotas do bucket.';
  }
  return 'Não foi possível enviar a foto. Confira se o Firebase Storage está ativado, o plano Blaze, as regras e a requisição na aba Rede (Network) do navegador.';
}

export default function FotoPerfilAluno({ aluno, onAtualizado }) {
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const escolherArquivo = () => {
    if (!enviando) inputRef.current?.click();
  };

  const handleChange = async (event) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;
    // Limpa o input imediatamente para permitir escolher a mesma foto novamente.
    event.target.value = '';
    setErro('');
    setMensagem('');

    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      setErro('Selecione uma foto JPG, PNG ou WebP.');
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_ORIGINAL) {
      setErro('Selecione uma foto de até 8 MB.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid || !aluno?.id) {
      setErro('Não foi possível identificar seu cadastro. Entre novamente na sua conta.');
      return;
    }

    setEnviando(true);
    try {
      setMensagem('Preparando imagem...');
      const blob = await prepararFoto(arquivo);

      // Caminho fixo evita acumular uma foto antiga a cada troca.
      // O diretório é identificado pelo UID autenticado, mesmo para cadastros legados.
      const caminho = `alunos/${uid}/perfil.jpg`;
      setMensagem('Enviando foto...');
      const storageRef = ref(storage, caminho);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const urlDownload = await getDownloadURL(storageRef);
      // Evita cache da imagem anterior quando o arquivo é substituído.
      const fotoUrl = `${urlDownload}${urlDownload.includes('?') ? '&' : '?'}v=${Date.now()}`;

      // Atualiza somente fotoUrl; não modifica faixa, grau, turma ou outros dados.
      setMensagem('Salvando foto no perfil...');
      await updateDoc(doc(db, 'alunos', aluno.id), { fotoUrl });
      if (onAtualizado) await onAtualizado();
      setMensagem('Foto atualizada!');
    } catch (error) {
      console.error('Erro ao enviar foto do aluno:', error);
      setErro(mensagemDeErro(error));
      setMensagem('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="foto-perfil-bloco">
      <button
        type="button"
        className="foto-perfil-botao"
        onClick={escolherArquivo}
        disabled={enviando}
        aria-label={aluno?.fotoUrl ? 'Trocar minha foto de perfil' : 'Adicionar minha foto de perfil'}
      >
        <AlunoAvatar aluno={aluno} size={96} />
        <span className="foto-perfil-overlay">
          {enviando ? 'Aguarde...' : (aluno?.fotoUrl ? 'Trocar foto' : 'Adicionar foto')}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        aria-label="Escolher uma foto de perfil"
        hidden
      />
      <small className="foto-perfil-ajuda">Toque na foto para adicionar ou trocar.</small>
      {mensagem && <small className="foto-perfil-mensagem" role="status">{mensagem}</small>}
      {erro && <small className="foto-perfil-erro" role="alert">{erro}</small>}
    </div>
  );
}
