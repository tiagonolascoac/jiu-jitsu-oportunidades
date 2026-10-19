import React, { useEffect, useRef, useState } from 'react';
import '../styles/TimerLuta.css';

const formatar = n => String(n).padStart(2, '0');

export default function TimerLuta() {
  const [aberto, setAberto] = useState(false);
  const [minutos, setMinutos] = useState(4);
  const [segundos, setSegundos] = useState(240);
  const [rodando, setRodando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const fimRef = useRef(null);
  const audioRef = useRef(null);

  const tocarFim = () => {
    try {
      const ctx = audioRef.current;
      if (!ctx) return;
      const inicio = ctx.currentTime;
      [0, 0.38, 0.76].forEach((atraso) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(620, inicio + atraso);
        osc.frequency.setValueAtTime(440, inicio + atraso + 0.18);
        gain.gain.setValueAtTime(0.0001, inicio + atraso);
        gain.gain.exponentialRampToValueAtTime(0.22, inicio + atraso + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, inicio + atraso + 0.32);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(inicio + atraso); osc.stop(inicio + atraso + 0.34);
      });
    } catch (e) { console.warn('Áudio indisponível', e); }
  };

  const iniciar = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        if (!audioRef.current) audioRef.current = new AudioContextClass();
        audioRef.current.resume();
      }
    } catch (e) { console.warn(e); }
    const duracao = Math.max(1, Math.min(120, Number(minutos) || 4)) * 60;
    setSegundos(duracao);
    fimRef.current = Date.now() + duracao * 1000;
    setFinalizado(false);
    setRodando(true);
    setAberto(true);
  };

  useEffect(() => {
    if (!rodando) return undefined;
    const atualizar = () => {
      const restante = Math.max(0, Math.ceil((fimRef.current - Date.now()) / 1000));
      setSegundos(restante);
      if (restante === 0) {
        setRodando(false);
        setFinalizado(true);
        tocarFim();
      }
    };
    atualizar();
    const id = window.setInterval(atualizar, 150);
    return () => window.clearInterval(id);
  }, [rodando]);

  // Mantém a tela ativa enquanto a luta estiver rodando.
  // O navegador libera automaticamente o Wake Lock quando a aba sai do primeiro plano;
  // por isso solicitamos novamente ao voltar para o cronômetro.
  useEffect(() => {
    if (!rodando) return undefined;

    let cancelado = false;
    let solicitando = false;
    let wakeLock = null;

    const manterTelaAcesa = async () => {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      if (solicitando || (wakeLock && !wakeLock.released)) return;

      solicitando = true;
      try {
        const bloqueio = await navigator.wakeLock.request('screen');
        if (cancelado || document.visibilityState !== 'visible') {
          await bloqueio.release();
          return;
        }
        wakeLock = bloqueio;
      } catch (erro) {
        // Alguns navegadores/dispositivos recusam a solicitação, por exemplo
        // no modo de economia de energia. O timer continua funcionando normalmente.
        if (!cancelado) console.warn('Não foi possível manter a tela acesa:', erro);
      } finally {
        solicitando = false;
      }
    };

    const aoVoltarParaTela = () => {
      if (document.visibilityState === 'visible') manterTelaAcesa();
    };

    manterTelaAcesa();
    document.addEventListener('visibilitychange', aoVoltarParaTela);

    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', aoVoltarParaTela);
      if (wakeLock && !wakeLock.released) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [rodando]);

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = anterior; };
  }, [aberto]);

  const voltar = () => { setRodando(false); setFinalizado(false); setAberto(false); };
  return <>
    <button type="button" className="timer-abrir" onClick={() => setAberto(true)}>⏱ Timer de luta</button>
    {aberto && <div className={`timer-tela ${rodando ? 'timer-verde' : finalizado ? 'timer-vermelho' : 'timer-config'}`} role="dialog" aria-modal="true" aria-label="Timer de luta">
      {!rodando && !finalizado ? <div className="timer-painel">
        <h2>⏱ Timer de luta</h2>
        <p>Escolha a duração da luta</p>
        <div className="timer-opcoes">{[2,3,4,5,6,10].map(n => <button key={n} className={Number(minutos) === n ? 'selecionado' : ''} onClick={() => setMinutos(n)}>{n} min</button>)}</div>
        <label htmlFor="timer-minutos">Minutos</label>
        <input id="timer-minutos" type="number" min="1" max="120" value={minutos} onChange={e => setMinutos(e.target.value)} />
        <button className="timer-play" onClick={iniciar}>▶ Iniciar luta</button>
        <button className="timer-voltar" onClick={voltar}>Voltar ao painel</button>
      </div> : <>
        <div className="timer-contagem" aria-live="off">
          <div className="timer-minutos">{formatar(Math.floor(segundos / 60))}</div>
          <div className="timer-segundos">{formatar(segundos % 60)}</div>
        </div>
        {finalizado && <div className="timer-fim">FIM DE LUTA!</div>}
        <div className="timer-acoes">
          <button className="timer-play" onClick={iniciar}>▶ {finalizado ? 'Reiniciar' : 'Recomeçar'}</button>
          <button className="timer-voltar" onClick={voltar}>{finalizado ? 'Configurar tempo' : 'Voltar / Parar'}</button>
        </div>
      </>}
    </div>}
  </>;
}
