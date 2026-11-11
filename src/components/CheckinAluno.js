import React, { useEffect, useRef, useState } from 'react';
import {
  collection, doc, getDoc, getDocsFromServer, query, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { dataHojeAcre } from '../utils/presencaUtils';
import { registrarPresencaUnica } from '../utils/registrarPresenca';
import '../styles/CheckinAluno.css';

const rad = (v) => (v * Math.PI) / 180;
function distanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function registroDoDia(alunoId, data) {
  // Inclui lançamentos antigos, cujos documentos possuem IDs automáticos.
  const snap = await getDocsFromServer(
    query(collection(db, 'presencas'), where('alunoId', '==', alunoId))
  );
  const registros = snap.docs.map((item) => ({ id: item.id, ...item.data() }))
    .filter((registro) => registro.data === data);
  return registros.find((registro) => registro.status === 'presente') || registros[0] || null;
}

function distanciaEPrecisao(coords, config) {
  const distancia = distanciaMetros(
    coords.latitude, coords.longitude, Number(config.latitude), Number(config.longitude)
  );
  const raio = Number(config.raioMetros || 100);
  const precisao = Number(coords.accuracy);

  // A margem do GPS (accuracy) é uma estimativa, não uma distância que
  // precisamos somar integralmente ao ponto informado para um check-in comum.
  // A exigência anterior (distancia + precisao <= raio) rejeitava alunos
  // muito próximos do centro em ambientes fechados.
  // Ainda exigimos: ponto dentro do raio, precisão razoável para esse raio
  // e uma margem extra de segurança junto à borda.
  const precisaoValida = Number.isFinite(precisao) && precisao > 0;
  const limitePrecisao = Math.min(180, Math.max(30, raio * 1.5));
  const margemBorda = Math.min(25, raio * 0.30);
  const margemAplicada = precisaoValida ? Math.min(precisao, margemBorda) : margemBorda;
  const dentro = distancia <= raio
    && precisaoValida
    && precisao <= limitePrecisao
    && distancia + margemAplicada <= raio;

  // Quando a margem inteira está fora, podemos avisar sem esperar outro GPS.
  const foraComMargem = precisaoValida && distancia - precisao > raio;
  const requerRefino = !dentro && !foraComMargem;

  return { distancia, raio, precisao, limitePrecisao, requerRefino };
}

/**
 * Aguarda leituras sucessivas do GPS, em vez de confiar em uma única amostra.
 * Posições de rede com margens de quilômetros NUNCA autorizam presença.
 * O observador é encerrado em sucesso, erro ou ao atingir o tempo limite.
 */
/**
 * Começa a solicitar acesso ao GPS IMEDIATAMENTE no clique do aluno,
 * antes das consultas assíncronas ao Firestore. Isso evita que uma falha
 * de leitura impeça silenciosamente até a tentativa de solicitar a permissão.
 *
 * As coordenadas ficam temporariamente em memória até carregarmos o raio
 * configurado, quando então são avaliadas. Nunca validamos presença sem
 * uma posição recente e suficientemente precisa.
 */
function iniciarCapturaGPS() {
  if (!navigator.geolocation) {
    throw new Error('GEO');
  }

  let observador = null;
  let timer = null;
  let encerrado = false;
  let configAtual = null;
  let aoAtualizar = null;
  let melhorPosicao = null;
  let melhorAvaliacao = null;
  let ultimoErro = null;
  const duracaoMaxima = 25000;

  let resolver;
  let rejeitar;
  const promessa = new Promise((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  // O GPS pode falhar enquanto o Firestore ainda está carregando. Já deixamos
  // um tratador de rejeição instalado; o erro será exibido ao aguardar().
  promessa.catch(() => {});

  const encerrar = (erro, resultado) => {
    if (encerrado) return;
    encerrado = true;
    if (timer !== null) clearTimeout(timer);
    if (observador !== null) navigator.geolocation.clearWatch(observador);
    if (erro) rejeitar(erro);
    else resolver(resultado);
  };

  const avaliarPosicao = (posicao) => {
    if (encerrado || !configAtual) return;
    const avaliacao = distanciaEPrecisao(posicao.coords, configAtual);
    if (!melhorAvaliacao || avaliacao.precisao < melhorAvaliacao.precisao) {
      melhorAvaliacao = avaliacao;
    }
    if (!avaliacao.requerRefino) {
      encerrar(null, { coords: posicao.coords, avaliacao });
    } else {
      aoAtualizar?.(avaliacao);
    }
  };

  timer = setTimeout(() => {
    if (melhorAvaliacao) {
      const erro = new Error('PRECISAO');
      erro.avaliacao = melhorAvaliacao;
      encerrar(erro);
    } else if (ultimoErro) {
      encerrar(ultimoErro);
    } else {
      const erro = new Error('TIMEOUT');
      erro.code = 3;
      encerrar(erro);
    }
  }, duracaoMaxima);

  try {
    observador = navigator.geolocation.watchPosition(
      (posicao) => {
        if (encerrado) return;
        if (Date.now() - posicao.timestamp > 15000) return;
        const { coords } = posicao;
        if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return;
        if (!melhorPosicao || coords.accuracy < melhorPosicao.coords.accuracy) {
          melhorPosicao = posicao;
        }
        avaliarPosicao(posicao);
      },
      (erro) => {
        if (encerrado) return;
        ultimoErro = erro;
        if (erro.code === 1) encerrar(erro);
        // POSITION_UNAVAILABLE pode ser transitório enquanto o GPS inicializa.
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: duracaoMaxima }
    );
    if (encerrado && observador !== null) navigator.geolocation.clearWatch(observador);
  } catch (erro) {
    encerrar(erro);
  }

  return {
    aguardar(config, onUpdate) {
      configAtual = config;
      aoAtualizar = onUpdate;
      if (melhorPosicao) avaliarPosicao(melhorPosicao);
      return promessa;
    },
    cancelar() { encerrar(null, { cancelado: true }); },
  };
}

const TEXTOS_ETAPA = {
  localizando: {
    titulo: 'Aguardando localização',
    texto: 'Consultando a localização do seu celular. Mantenha a localização ativada.',
  },
  refinando: {
    titulo: 'Melhorando a precisão',
    texto: 'Precisamos de uma posição mais precisa para confirmar que você está na aula.',
  },
  validando: {
    titulo: 'Validando presença',
    texto: 'Conferindo a distância até o local da aula e o registro de hoje.',
  },
  registrando: {
    titulo: 'Salvando presença',
    texto: 'Sua localização foi validada. Registrando a presença com segurança.',
  },
};

function CheckinAluno({ aluno, user, onSuccess }) {
  const alunoId = aluno?.id;
  const [estado, setEstado] = useState('idle');
  const [mensagem, setMensagem] = useState('');
  const [detalhes, setDetalhes] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [etapa, setEtapa] = useState('localizando');
  const emProcessamento = useRef(false);

  useEffect(() => {
    let ativo = true;
    setEstado('idle');
    setMensagem('');
    setDetalhes(null);
    setModalAberto(false);

    const verificar = async () => {
      if (!alunoId) return;
      try {
        const existente = await registroDoDia(alunoId, dataHojeAcre());
        if (!ativo || emProcessamento.current || !existente) return;
        if (existente.status === 'presente') {
          setEstado('success');
          setMensagem('Sua presença de hoje já está registrada.');
        } else {
          setEstado('already');
          setMensagem('Já existe uma ausência lançada para hoje. Solicite a correção ao professor.');
        }
        if (existente.metodo === 'geolocalizacao') {
          setDetalhes({
            distancia: Number.isFinite(Number(existente.distanciaMetros)) ? Number(existente.distanciaMetros) : null,
            raio: null,
            precisao: Number.isFinite(Number(existente.precisaoMetros)) ? Number(existente.precisaoMetros) : null,
            local: 'Registro encontrado',
          });
        }
      } catch (e) {
        console.error('Erro ao verificar presença:', e);
        if (ativo && !emProcessamento.current) {
          setEstado('error');
          setMensagem('Não foi possível verificar sua presença. Verifique a conexão e tente novamente.');
        }
      }
    };
    verificar();
    return () => { ativo = false; };
  }, [alunoId]);

  const marcarPresenca = async () => {
    if (!aluno || aluno.ativo === false || emProcessamento.current || estado === 'success' || estado === 'already') return;
    emProcessamento.current = true;
    setEstado('loading');
    setEtapa('localizando');
    setModalAberto(true);
    setMensagem('Aguardando localização...');
    setDetalhes(null);

    let capturaGPS = null;
    try {
      // O navegador deve receber a solicitação de GPS no gesto do usuário.
      // A captura começa aqui, antes de qualquer await do Firebase.
      if (!window.isSecureContext) throw new Error('HTTPS');
      capturaGPS = iniciarCapturaGPS();
      const data = dataHojeAcre();

      // Firestore é consultado em paralelo com o GPS, já inicializado acima.
      // A distância só será avaliada depois de ler o raio configurado.
      const [existente, configSnap] = await Promise.all([
        registroDoDia(aluno.id, data),
        getDoc(doc(db, 'configuracoes', 'presenca')),
      ]);

      // Quando o professor já fez o lançamento, não cria outro.
      if (existente) {
        const presente = existente.status === 'presente';
        setEstado(presente ? 'success' : 'already');
        setMensagem(presente
          ? '✅ Sua presença de hoje já estava confirmada!'
          : 'Já existe uma ausência lançada para hoje. Solicite a correção ao professor.');
        return;
      }

      if (!configSnap.exists() || configSnap.data().ativo === false) throw new Error('CONFIG');
      const config = configSnap.data();
      // Evita que campos vazios (Number('') === 0) sejam lidos como coordenadas.
      const latConfigurada = config.latitude;
      const lonConfigurada = config.longitude;
      const latitude = Number(latConfigurada);
      const longitude = Number(lonConfigurada);
      if (latConfigurada === '' || lonConfigurada === '' || latConfigurada == null || lonConfigurada == null
        || !Number.isFinite(latitude) || !Number.isFinite(longitude)
        || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
        || (latitude === 0 && longitude === 0)) {
        throw new Error('CONFIG');
      }

      setEtapa('localizando');
      setMensagem('Buscando sinal de GPS preciso...');
      const { avaliacao } = await capturaGPS.aguardar(config, ({ precisao }) => {
        setEtapa('refinando');
        if (precisao > 1000) {
          setMensagem('O celular está fornecendo localização aproximada. Aguardando um sinal melhor do GPS...');
        } else {
          setMensagem('Aguardando precisão suficiente para validar a presença...');
        }
      });

      setEtapa('validando');
      setMensagem('Validando distância e verificando a presença...');
      const { distancia, raio, precisao } = avaliacao;
      setDetalhes({
        distancia: Math.round(distancia),
        raio,
        precisao: Math.round(precisao),
        local: config.nomeLocal || 'Local da aula',
      });

      if (distancia > raio) {
        setEstado('outside');
        setMensagem('Você está fora da área permitida para presença.');
        return;
      }

      setEtapa('registrando');
      setMensagem('Localização validada. Salvando presença...');
      // A transação cobre disputas entre os aplicativos atualizados do professor e aluno.
      const resultado = await registrarPresencaUnica({
        alunoId: aluno.id,
        data,
        turma: aluno.turma || '',
        turmaSelecionada: aluno.turmaId || '',
        status: 'presente',
        metodo: 'geolocalizacao',
        registradoPor: user.uid,
        dataCriacao: serverTimestamp(),
        distanciaMetros: Math.round(distancia),
        precisaoMetros: Math.round(precisao),
      });

      if (!resultado.criado && resultado.registro?.status !== 'presente') {
        setEstado('already');
        setMensagem('O professor já registrou uma ausência para hoje. Procure-o para corrigir.');
      } else {
        setEstado('success');
        setMensagem(resultado.criado ? '✅ Presença confirmada!' : '✅ Sua presença de hoje já estava registrada.');
      }

      // Atualiza estatísticas em segundo plano; não atrasa a confirmação na tela.
      if (onSuccess) Promise.resolve().then(() => onSuccess({ silencioso: true })).catch((erro) => {
        console.error('Falha ao atualizar resumo após check-in:', erro);
      });
    } catch (e) {
      console.error('Erro no check-in:', e);
      setEstado('error');
      if (e.message === 'CONFIG') {
        setMensagem('O administrador ainda não configurou o local de presença.');
      } else if (e.message === 'GEO') {
        setMensagem('Este dispositivo não oferece acesso à localização.');
      } else if (e.message === 'HTTPS') {
        setMensagem('A localização exige uma conexão segura (HTTPS). Acesse o endereço oficial do site.');
      } else if (e.message === 'PRECISAO') {
        if (e.avaliacao) {
          const { distancia, raio, precisao } = e.avaliacao;
          const numero = (valor) => Number.isFinite(valor) ? Math.round(valor) : '?';
          const muitoImprecisa = precisao >= 1000;
          setDetalhes({
            // A distância aparente (até 0m) não é confiável com erro de quilômetros.
            distancia: muitoImprecisa ? null : numero(distancia),
            raio: numero(raio),
            precisao: numero(precisao),
            local: muitoImprecisa ? 'Localização aproximada do dispositivo' : 'Medição do GPS (não registrada)',
          });
          setMensagem(muitoImprecisa
            ? `O aparelho forneceu uma localização aproximada (margem de erro ~${numero(precisao)} m), ` +
              `inadequada para o raio de ${numero(raio)} m. Habilite a localização precisa para o navegador ` +
              'e tente ao ar livre. Se não melhorar, peça a presença manual ao professor.'
            : `O sinal ainda está impreciso (~${numero(precisao)} m) para validar o raio de ` +
              `${numero(raio)} m. Tente perto de uma janela ou peça ao professor para lançar sua presença.`
          );
        } else {
          setMensagem('O GPS não conseguiu uma posição confiável. Ative a localização precisa ou peça ajuda ao professor.');
        }
      } else if (e.code === 1 || e.code === 'PERMISSION_DENIED') {
        let estadoPermissao = '';
        try {
          const status = await navigator.permissions?.query({ name: 'geolocation' });
          estadoPermissao = status?.state || '';
        } catch (_) { /* Safari e navegadores embutidos podem não oferecer a API. */ }
        if (estadoPermissao === 'denied') {
          setMensagem('A localização está BLOQUEADA para este site. Abra as permissões do site no navegador, permita Localização e tente novamente. O navegador não mostrará um novo pop-up enquanto estiver bloqueada.');
        } else {
          setMensagem('O navegador recusou o acesso ao GPS. Verifique a permissão de Localização para este site e para o aplicativo do navegador. Abra o site diretamente no Chrome ou Safari, não dentro de outro aplicativo.');
        }
      } else if (e.code === 3 || e.code === 'TIMEOUT') {
        setMensagem('A localização demorou mais que o esperado. Verifique o GPS e tente novamente.');
      } else if (e.code === 2 || e.code === 'POSITION_UNAVAILABLE') {
        setMensagem('Localização indisponível no momento. Ative o GPS e tente novamente.');
      } else if (e.code === 'permission-denied') {
        setMensagem('O FIREBASE bloqueou a consulta ou gravação da presença (Firestore). Isso é diferente da permissão de GPS: peça ao administrador para conferir as regras da coleção presencas e de configuracoes/presenca.');
      } else {
        setMensagem('Não foi possível registrar a presença. Verifique sua conexão e tente novamente.');
      }
    } finally {
      capturaGPS?.cancelar();
      emProcessamento.current = false;
    }
  };

  const carregando = estado === 'loading';
  const modalTexto = carregando ? TEXTOS_ETAPA[etapa] : null;
  const modalSucesso = estado === 'success';
  const modalErro = estado === 'error' || estado === 'outside' || estado === 'already';

  return (
    <>
      <div className={`checkin-card state-${estado}`}>
        <div className="checkin-icon">📍</div>
        <div className="checkin-copy">
          <span>Presença de hoje</span>
          <h2>{modalSucesso ? '✓ Presença registrada' : estado === 'already' ? 'Registro já existente' : 'Marcar minha presença'}</h2>
          <p>{modalSucesso
            ? 'Seu check-in de hoje já foi confirmado.'
            : estado === 'already'
              ? 'O professor pode corrigir o lançamento existente.'
              : 'Usaremos sua localização somente para verificar se você está no local da aula.'}</p>
        </div>
        {mensagem && <div className="checkin-message">{mensagem}</div>}
        {detalhes && (
          <div className="checkin-details">
            <span>{detalhes.local}</span>
            {detalhes.distancia !== null && <strong>{detalhes.distancia} m do local</strong>}
            {detalhes.raio !== null && (
              <small>Raio permitido: {detalhes.raio} m • Precisão do aparelho: ~{detalhes.precisao} m</small>
            )}
          </div>
        )}
        {!modalSucesso && estado !== 'already' && (
          <button type="button" onClick={marcarPresenca} disabled={carregando || aluno?.ativo === false}>
            {carregando ? 'Aguardando confirmação...' : '📍 Marcar minha presença'}
          </button>
        )}
      </div>

      {modalAberto && (
        <div className="checkin-modal-fundo">
          <section className={`checkin-modal ${modalSucesso ? 'modal-success' : modalErro ? 'modal-error' : ''}`}
            role="dialog" aria-modal="true" aria-labelledby="checkin-modal-titulo" aria-describedby="checkin-modal-descricao">
            <div className={`checkin-modal-icone ${carregando ? 'icone-carregando' : ''}`} aria-hidden="true">
              {carregando ? '📍' : modalSucesso ? '✓' : estado === 'outside' ? '📍' : '!' }
            </div>
            <div aria-live="polite" aria-atomic="true">
              <h3 id="checkin-modal-titulo">{carregando ? modalTexto.titulo : modalSucesso ? '✅ Presença confirmada!' : estado === 'already' ? 'Presença já lançada' : estado === 'outside' ? 'Fora da área permitida' : 'Não foi possível confirmar'}</h3>
              <p id="checkin-modal-descricao">{carregando ? modalTexto.texto : mensagem}</p>
            </div>
            {carregando && (
              <div className="checkin-modal-etapas" aria-label="Etapas da confirmação">
                <span className={etapa === 'localizando' || etapa === 'refinando' ? 'ativo' : 'concluido'}>Localização</span>
                <span className={etapa === 'validando' ? 'ativo' : etapa === 'registrando' ? 'concluido' : ''}>Validação</span>
                <span className={etapa === 'registrando' ? 'ativo' : ''}>Registro</span>
              </div>
            )}
            {!carregando && (
              <div className="checkin-modal-acoes">
                {estado === 'error' || estado === 'outside' ? (
                  <button type="button" className="checkin-modal-tentar" onClick={marcarPresenca}>Tentar novamente</button>
                ) : null}
                <button type="button" className="checkin-modal-concluir" onClick={() => setModalAberto(false)}>
                  {modalSucesso ? 'Concluir' : 'Fechar'}
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export default CheckinAluno;
