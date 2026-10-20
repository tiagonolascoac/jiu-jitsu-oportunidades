import React, { useEffect, useRef, useState } from 'react';
import '../styles/GuiaJiuJitsu.css';
import ProgressaoFaixas from './ProgressaoFaixas';

const BASE = `${process.env.PUBLIC_URL || ''}/guia-jiu-jitsu`;
const TOTAL_PAGINAS = 52;
const ZOOMS = [100, 150, 200, 250, 300];

const limitarPagina = (numero) => Math.min(TOTAL_PAGINAS, Math.max(1, Math.round(numero)));

function ControleZoom({ zoom, onChange }) {
  const indice = ZOOMS.indexOf(zoom);
  return (
    <div className="guia-zoom" role="group" aria-label="Zoom do documento">
      <button type="button" onClick={() => onChange(ZOOMS[Math.max(0, indice - 1)])} disabled={indice === 0} aria-label="Diminuir zoom">−</button>
      <span aria-live="polite">{zoom}%</span>
      <button type="button" onClick={() => onChange(ZOOMS[Math.min(ZOOMS.length - 1, indice + 1)])} disabled={indice === ZOOMS.length - 1} aria-label="Aumentar zoom">+</button>
    </div>
  );
}

export default function GuiaJiuJitsu({ secao = 'faixas', onNavegar }) {
  const [pagina, setPagina] = useState(1);
  const [paginaDigitada, setPaginaDigitada] = useState('1');
  const [zoomRegras, setZoomRegras] = useState(100);
  const [zoomFaixas, setZoomFaixas] = useState(100);
  const [imagemCarregando, setImagemCarregando] = useState(true);
  const visualizadorRef = useRef(null);
  const paginaAnteriorRef = useRef(pagina);

  const isRegras = secao === 'regras';
  const caminhoPdf = `${BASE}/originais/${isRegras ? 'regras-ibjjf-2024.pdf' : 'progressao-faixas-ibjjf-2026.pdf'}`;
  const urlImagem = isRegras
    ? `${BASE}/regras/pagina-${String(pagina).padStart(2, '0')}.webp`
    : `${BASE}/progressao-faixas.webp`;
  const zoom = isRegras ? zoomRegras : zoomFaixas;
  const alterarZoom = isRegras ? setZoomRegras : setZoomFaixas;

  useEffect(() => {
    setImagemCarregando(true);
    if (paginaAnteriorRef.current !== pagina) {
      if (visualizadorRef.current) {
        visualizadorRef.current.scrollTop = 0;
        visualizadorRef.current.scrollLeft = 0;
      }
      paginaAnteriorRef.current = pagina;
    }
  }, [pagina, secao]);

  const irParaPagina = (valor) => {
    const proxima = Number(valor);
    if (!Number.isFinite(proxima)) return;
    const paginaValida = limitarPagina(proxima);
    setPagina(paginaValida);
    setPaginaDigitada(String(paginaValida));
  };

  const irParaSecao = (proximaSecao) => {
    onNavegar?.(proximaSecao === 'regras' ? 'guia-regras' : 'guia-faixas');
  };

  // A progressão agora é uma página nativa e interativa. O leitor de regras permanece intacto.
  if (!isRegras) {
    return (
      <div className="guia-pagina">
        <header className="guia-cabecalho">
          <span className="guia-identificacao">BIBLIOTECA DE ESTUDO</span>
          <h1>📖 Guia do Jiu-Jitsu</h1>
          <p>Material de referência para alunos e professores, com leitura diretamente no sistema.</p>
          <div className="guia-abas" role="group" aria-label="Conteúdo do guia">
            <button type="button" className="selecionada" onClick={() => irParaSecao('faixas')} aria-pressed="true">🥋 Progressão de Faixa</button>
            <button type="button" onClick={() => irParaSecao('regras')} aria-pressed="false">📜 Regras</button>
          </div>
        </header>
        <ProgressaoFaixas />
      </div>
    );
  }

  return (
    <div className="guia-pagina">
      <header className="guia-cabecalho">
        <span className="guia-identificacao">BIBLIOTECA DE ESTUDO</span>
        <h1>📖 Guia do Jiu-Jitsu</h1>
        <p>Material de referência para alunos e professores, com leitura diretamente no sistema.</p>
        <div className="guia-abas" role="group" aria-label="Conteúdo do guia">
          <button type="button" className={!isRegras ? 'selecionada' : ''} onClick={() => irParaSecao('faixas')} aria-pressed={!isRegras}>
            🥋 Progressão de Faixa
          </button>
          <button type="button" className={isRegras ? 'selecionada' : ''} onClick={() => irParaSecao('regras')} aria-pressed={isRegras}>
            📜 Regras
          </button>
        </div>
      </header>

      <section className="guia-documento" aria-label={isRegras ? 'Regras de competição' : 'Progressão de faixas'}>
        <div className="guia-documento-cabecalho">
          <div>
            <span className="guia-tipo">DOCUMENTO OFICIAL • IBJJF</span>
            <h2>{isRegras ? 'Regras de Competição' : 'Sistema de Graduação e Faixas'}</h2>
            <p>{isRegras
              ? 'Livro de regras da IBJJF — edição de junho de 2024, versão 6.1. Consulte cada página sem sair do painel.'
              : 'Tabela de graduação IBJJF 2026 com faixas, idades, graus e períodos mínimos de permanência.'}</p>
          </div>
          <a className="guia-link-pdf" href={caminhoPdf} target="_blank" rel="noopener noreferrer" aria-label="Abrir PDF original em nova aba">
            ↗ Abrir PDF
          </a>
        </div>

        {isRegras && (
          <nav className="guia-sumario" aria-label="Ir para uma parte do livro de regras">
            <strong>Ir para:</strong>
            <button type="button" onClick={() => irParaPagina(4)}>Livro de Regras <span>p. 4</span></button>
            <button type="button" onClick={() => irParaPagina(40)}>Regulamento Geral <span>p. 40</span></button>
            <button type="button" onClick={() => irParaPagina(48)}>Manual de Competições <span>p. 48</span></button>
          </nav>
        )}

        <div className="guia-barra-leitura">
          <div className="guia-indicador-pagina">
            {isRegras ? `Página ${pagina} de ${TOTAL_PAGINAS}` : 'Cartaz de graduação • 2026'}
          </div>
          <ControleZoom zoom={zoom} onChange={alterarZoom} />
        </div>

        <div className="guia-visualizador" ref={visualizadorRef} role="region" aria-label="Leitor do documento" tabIndex={0}>
          {imagemCarregando && <div className="guia-carregando" role="status">Carregando documento...</div>}
          <img
            key={urlImagem}
            className={`guia-imagem ${isRegras ? 'guia-imagem-regras' : 'guia-imagem-faixas'}`}
            src={urlImagem}
            alt={isRegras
              ? `Página ${pagina} de ${TOTAL_PAGINAS} do Livro de Regras da IBJJF`
              : 'Cartaz oficial IBJJF: progressão das faixas de jiu-jitsu, idades, graus e períodos mínimos'}
            style={{ width: `${zoom}%` }}
            onLoad={() => setImagemCarregando(false)}
            onError={() => setImagemCarregando(false)}
            draggable="false"
          />
        </div>

        <p className="guia-dica">💡 {isRegras
          ? 'Use + para ampliar a leitura no celular. O documento será exibido página por página, sem carregar todas as 52 de uma vez.'
          : 'Toque em + para ampliar o cartaz e deslize para os lados para consultar os detalhes.'}</p>

        {isRegras && (
          <div className="guia-controle-paginas" aria-label="Navegação entre páginas">
            <button type="button" onClick={() => irParaPagina(pagina - 1)} disabled={pagina <= 1}>
              ← Anterior
            </button>
            <form onSubmit={(evento) => { evento.preventDefault(); irParaPagina(paginaDigitada); }}>
              <label htmlFor="guia-pagina-numero">Página</label>
              <input
                id="guia-pagina-numero"
                type="number"
                min="1"
                max={TOTAL_PAGINAS}
                value={paginaDigitada}
                onChange={(evento) => setPaginaDigitada(evento.target.value)}
                onBlur={() => setPaginaDigitada(String(pagina))}
              />
              <span>de {TOTAL_PAGINAS}</span>
              <button className="guia-ir" type="submit">Ir</button>
            </form>
            <button type="button" onClick={() => irParaPagina(pagina + 1)} disabled={pagina >= TOTAL_PAGINAS}>
              Próxima →
            </button>
          </div>
        )}

        <div className="guia-rodape">
          <span>Fonte: International Brazilian Jiu-Jitsu Federation (IBJJF).</span>
          <a href={caminhoPdf} download>{isRegras ? 'Baixar livro completo (PDF)' : 'Baixar cartaz original (PDF)'}</a>
        </div>
      </section>
    </div>
  );
}
