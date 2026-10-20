import React, { useState } from 'react';
import '../styles/ProgressaoFaixas.css';

const FONTE = `${process.env.PUBLIC_URL || ''}/guia-jiu-jitsu/originais/progressao-faixas-ibjjf-2026.pdf`;

// Hierarquia e idades mínimas extraídas do cartaz IBJJF de 2026.
const GRUPOS_KIDS = [
  {
    id: 'inicio', etapa: '01', titulo: 'O começo de tudo', grupo: 'Faixa branca', idade: 4,
    texto: 'A faixa branca é o ponto de partida. É nela que se constroem os fundamentos, a disciplina e o respeito.',
    faixas: [{ id: 'branca', nome: 'Branca', cor: '#f4f5f5', detalhe: 'Faixa inicial para a graduação infantil.', variante: 'solida' }],
  },
  {
    id: 'cinza', etapa: '02', titulo: 'Grupo cinza', grupo: '3 etapas', idade: 4,
    texto: 'Primeira família de faixas coloridas do sistema infantil. A graduação acompanha o desenvolvimento do praticante.',
    faixas: [
      { id: 'cinza-branca', nome: 'Cinza / Branca', cor: '#9a9da3', detalhe: 'Graduação infantil do grupo cinza com faixa branca central.', variante: 'branca' },
      { id: 'cinza', nome: 'Cinza', cor: '#91949a', detalhe: 'Graduação infantil intermediária do grupo cinza.', variante: 'solida' },
      { id: 'cinza-preta', nome: 'Cinza / Preta', cor: '#91949a', detalhe: 'Graduação infantil do grupo cinza com faixa preta central.', variante: 'preta' },
    ],
  },
  {
    id: 'amarelo', etapa: '03', titulo: 'Grupo amarelo', grupo: '3 etapas', idade: 7,
    texto: 'Conjunto de graduações disponível a partir do ano em que o praticante completa 7 anos.',
    faixas: [
      { id: 'amarela-branca', nome: 'Amarela / Branca', cor: '#f3cd23', detalhe: 'Graduação infantil do grupo amarelo com faixa branca central.', variante: 'branca' },
      { id: 'amarela', nome: 'Amarela', cor: '#f3cd23', detalhe: 'Graduação infantil intermediária do grupo amarelo.', variante: 'solida' },
      { id: 'amarela-preta', nome: 'Amarela / Preta', cor: '#f3cd23', detalhe: 'Graduação infantil do grupo amarelo com faixa preta central.', variante: 'preta' },
    ],
  },
  {
    id: 'laranja', etapa: '04', titulo: 'Grupo laranja', grupo: '3 etapas', idade: 10,
    texto: 'Conjunto de graduações disponível a partir do ano em que o praticante completa 10 anos.',
    faixas: [
      { id: 'laranja-branca', nome: 'Laranja / Branca', cor: '#f4752b', detalhe: 'Graduação infantil do grupo laranja com faixa branca central.', variante: 'branca' },
      { id: 'laranja', nome: 'Laranja', cor: '#f4752b', detalhe: 'Graduação infantil intermediária do grupo laranja.', variante: 'solida' },
      { id: 'laranja-preta', nome: 'Laranja / Preta', cor: '#f4752b', detalhe: 'Graduação infantil do grupo laranja com faixa preta central.', variante: 'preta' },
    ],
  },
  {
    id: 'verde', etapa: '05', titulo: 'Grupo verde', grupo: '3 etapas', idade: 13,
    texto: 'Última família de cores da graduação infantil exibida no cartaz. A partir dos 16 anos, aplica-se a progressão de faixas adultas.',
    faixas: [
      { id: 'verde-branca', nome: 'Verde / Branca', cor: '#14804a', detalhe: 'Graduação infantil do grupo verde com faixa branca central.', variante: 'branca' },
      { id: 'verde', nome: 'Verde', cor: '#14804a', detalhe: 'Graduação infantil intermediária do grupo verde.', variante: 'solida' },
      { id: 'verde-preta', nome: 'Verde / Preta', cor: '#14804a', detalhe: 'Graduação infantil do grupo verde com faixa preta central.', variante: 'preta' },
    ],
  },
];

const FAIXAS_ADULTAS = [
  { id: 'branca', titulo: 'Branca', cor: '#f4f5f5', variante: 'solida', idade: 'A partir dos 16 anos', tempo: 'Sem prazo específico no cartaz', resumo: 'A etapa inicial da jornada de aprendizado. O cartaz não define um período mínimo para passar da branca à azul.', tempoCurto: 'Inicial', maxGraus: 4 },
  { id: 'azul', titulo: 'Azul', cor: '#206acc', variante: 'solida', idade: 'A partir dos 16 anos', tempo: 'Mínimo de 2 anos na faixa azul', resumo: 'Para os praticantes a partir de 18 anos, a permanência mínima apresentada para passar da faixa azul à roxa é de 2 anos.', tempoCurto: '2 anos', maxGraus: 4 },
  { id: 'roxa', titulo: 'Roxa', cor: '#8635bc', variante: 'solida', idade: 'A partir dos 16 anos', tempo: 'Mínimo de 1 ano e 6 meses na faixa roxa', resumo: 'Para praticantes a partir de 18 anos, o mínimo indicado da roxa à marrom é de 1 ano e 6 meses. Para praticantes de 16 e 17 anos, o cartaz mostra o período especial de 2 anos.', tempoCurto: '1 ano e 6 meses', maxGraus: 4 },
  { id: 'marrom', titulo: 'Marrom', cor: '#74421f', variante: 'solida', idade: 'A partir dos 18 anos', tempo: 'Mínimo de 1 ano na faixa marrom', resumo: 'Para praticantes a partir de 18 anos, o cartaz indica pelo menos 1 ano na marrom antes da graduação à preta. Aos 18, essa graduação à preta é excepcional e restrita aos campeões mundiais adultos na marrom.', tempoCurto: '1 ano', maxGraus: 4 },
  { id: 'preta', titulo: 'Preta', cor: '#15171a', variante: 'preta-adulto', idade: 'Em regra, a partir dos 19 anos', tempo: 'Graus com períodos próprios', resumo: 'A faixa preta possui até 6 graus. Para obter o primeiro grau, o período mínimo mostrado no cartaz é de 3 anos. A progressão posterior segue intervalos próprios.', tempoCurto: '3 anos até o 1º grau', maxGraus: 6 },
];

const ALTAS_GRADUACOES = [
  { id: 'vp', titulo: 'Vermelha e preta', grau: '7º grau', cor: '#df1e2b', variante: 'vermelha-preta', idade: 'A partir dos 49 anos', tempo: '7 anos após o 6º grau', total: '31 anos desde a faixa preta' },
  { id: 'vb', titulo: 'Vermelha e branca', grau: '8º grau', cor: '#df1e2b', variante: 'vermelha-branca', idade: 'A partir dos 56 anos', tempo: '7 anos após o 7º grau', total: '38 anos desde a faixa preta' },
  { id: 'v', titulo: 'Vermelha', grau: '9º grau', cor: '#e0222b', variante: 'vermelha', idade: 'A partir dos 66 anos', tempo: '10 anos após o 8º grau', total: '48 anos desde a faixa preta' },
];

function Belt({ cor, variante = 'solida', graus = 0, compacta = false }) {
  const estilo = { '--pf-cor-faixa': cor };
  return (
    <span className={`pf-belt pf-belt--${variante} ${compacta ? 'pf-belt--mini' : ''}`} style={estilo} aria-hidden="true">
      <span className="pf-belt-corpo"><span className="pf-belt-centro" /><span className="pf-belt-ponta"><span className="pf-belt-riscos">{Array.from({ length: graus }, (_, i) => <i key={i} />)}</span></span></span>
      <span className="pf-belt-no" />
      <span className="pf-belt-cauda pf-belt-cauda--frente" />
      <span className="pf-belt-cauda pf-belt-cauda--tras" />
    </span>
  );
}

function FonteRodape() {
  return (
    <footer className="pf-fonte">
      <span>Fonte: Sistema de Graduação IBJJF · cartaz 2026.</span>
      <a href={FONTE} target="_blank" rel="noopener noreferrer">↗ Consultar cartaz original</a>
    </footer>
  );
}

function Kids() {
  const [faixaAberta, setFaixaAberta] = useState('cinza-branca');
  return (
    <div className="pf-content" role="tabpanel" id="pf-painel-kids" aria-labelledby="pf-aba-kids">
      <div className="pf-intro">
        <div className="pf-intro-icon" aria-hidden="true">🌱</div>
        <div><span className="pf-overline">DOS PRIMEIROS PASSOS À FAIXA VERDE</span><h3>Pequenos passos, grandes conquistas.</h3><p>Conheça as faixas infantis e a idade mínima para cada grupo. Toque em uma faixa para conhecer a etapa.</p></div>
        <span className="pf-intro-etaria">4 a 15 anos</span>
      </div>

      <div className="pf-etapas">
        {GRUPOS_KIDS.map((grupo) => {
          const escolhida = grupo.faixas.find((faixa) => faixa.id === faixaAberta);
          return (
            <section className="pf-etapa" key={grupo.id} aria-label={grupo.titulo}>
              <div className="pf-etapa-trilho" aria-hidden="true"><span>{grupo.etapa}</span></div>
              <div className="pf-etapa-conteudo">
                <div className="pf-etapa-cabecalho"><div><div className="pf-etapa-kicker">ETAPA {grupo.etapa} · {grupo.grupo}</div><h4>{grupo.titulo}</h4></div><span className="pf-idade">A partir dos <strong>{grupo.idade} anos</strong></span></div>
                <div className={`pf-kids-lista ${grupo.faixas.length === 1 ? 'pf-kids-lista--unica' : ''}`}>
                  {grupo.faixas.map((faixa) => {
                    const ativo = faixaAberta === faixa.id;
                    return (
                      <button className={`pf-kids-botao ${ativo ? 'pf-kids-botao--ativo' : ''}`} type="button" key={faixa.id}
                        onClick={() => setFaixaAberta(ativo ? '' : faixa.id)} aria-expanded={ativo}>
                        <Belt cor={faixa.cor} variante={faixa.variante} compacta />
                        <span>{faixa.nome}</span><span className="pf-botao-chevron" aria-hidden="true">⌄</span>
                      </button>
                    );
                  })}
                </div>
                {escolhida && <div className="pf-etapa-detalhe" role="region" aria-label={`Detalhes da faixa ${escolhida.nome}`}><span className="pf-detalhe-icone">✦</span><p><strong>{escolhida.nome}.</strong> {escolhida.detalhe} {grupo.texto}</p></div>}
              </div>
            </section>
          );
        })}
      </div>
      <div className="pf-notas-kids">
        <div className="pf-nota-ilustracao"><span aria-hidden="true">✧</span><strong>Como a idade é calculada?</strong><p>Ano corrente − ano de nascimento = idade do atleta.</p></div>
        <div className="pf-nota-ilustracao"><span aria-hidden="true">✦</span><strong>Quem define a graduação?</strong><p>A evolução considera o aprendizado e a avaliação do professor, respeitando as idades mínimas.</p></div>
      </div>
      <div className="pf-alerta"><strong>Sobre os graus infantis</strong><p>O cartaz da IBJJF apresenta a configuração de faixas infantis e sua área de graduação. A quantidade e as condições de cada grau não são detalhadas nesse cartaz; por isso não atribuímos prazos ou graus automáticos aqui.</p></div>
      <FonteRodape />
    </div>
  );
}

function Adultos() {
  const [faixaAberta, setFaixaAberta] = useState('azul');
  const [grauDemonstrado, setGrauDemonstrado] = useState(2);
  const [altaAberta, setAltaAberta] = useState('');
  return (
    <div className="pf-content" role="tabpanel" id="pf-painel-adultos" aria-labelledby="pf-aba-adultos">
      <div className="pf-intro pf-intro--adultos"><div className="pf-intro-icon" aria-hidden="true">🥋</div><div><span className="pf-overline">UM CAMINHO DE EVOLUÇÃO CONTÍNUA</span><h3>Do primeiro treino a uma vida no tatame.</h3><p>Toque em uma faixa para explorar a graduação, os graus e os períodos mínimos da IBJJF.</p></div><span className="pf-intro-etaria">16 anos +</span></div>
      <div className="pf-mini-explicacao"><strong>Períodos mínimos ≠ graduação automática.</strong><span>Os prazos abaixo indicam permanência na faixa atual antes de avançar, e valem para a tabela de praticantes a partir de 18 anos, salvo as exceções destacadas.</span></div>
      <div className="pf-adultos-lista">
        {FAIXAS_ADULTAS.map((faixa, i) => {
          const ativo = faixa.id === faixaAberta;
          return (
            <section className={`pf-adulto-item ${ativo ? 'pf-adulto-item--ativo' : ''}`} key={faixa.id}>
              <button className="pf-adulto-cabecalho" type="button" onClick={() => {setFaixaAberta(ativo ? '' : faixa.id); setGrauDemonstrado(0);}} aria-expanded={ativo}>
                <span className="pf-adulto-numero">{String(i + 1).padStart(2, '0')}</span>
                <span className="pf-adulto-desenho"><Belt cor={faixa.cor} variante={faixa.variante} compacta /></span>
                <span className="pf-adulto-titulos"><strong>Faixa {faixa.titulo}</strong><small>{faixa.idade}</small></span>
                <span className="pf-tempo-selo">{faixa.tempoCurto}</span><span className="pf-adulto-chevron" aria-hidden="true">⌄</span>
              </button>
              {ativo && <div className="pf-adulto-expandido">
                <p className="pf-tempo-linha"><span aria-hidden="true">◷</span> {faixa.tempo}</p>
                <p>{faixa.resumo}</p>
                <div className="pf-graus-caixa">
                  <div className="pf-graus-topo"><div><strong>Visualize os graus</strong><small>Exemplo ilustrativo · não altera o cadastro do aluno</small></div><span className="pf-grau-atual">{grauDemonstrado === 0 ? 'Sem graus' : `${grauDemonstrado} ${grauDemonstrado === 1 ? 'grau' : 'graus'}`}</span></div>
                  <Belt cor={faixa.cor} variante={faixa.variante} graus={grauDemonstrado} />
                  <div className="pf-graus-botoes" role="group" aria-label={`Selecionar grau para ilustrar a faixa ${faixa.titulo}`}>
                    {Array.from({ length: faixa.maxGraus + 1 }, (_, grau) => <button type="button" className={grauDemonstrado === grau ? 'ativo' : ''} aria-pressed={grauDemonstrado === grau} key={grau} onClick={() => setGrauDemonstrado(grau)}>{grau}º</button>)}
                  </div>
                </div>
              </div>}
            </section>
          );
        })}
      </div>
      <section className="pf-altas" aria-label="Altas graduações após a faixa preta">
        <div className="pf-altas-topo"><span className="pf-overline">A JORNADA CONTINUA</span><h3>Graduações após a faixa preta</h3><p>As graduações superiores seguem intervalos mínimos específicos, contados desde a faixa preta.</p></div>
        <div className="pf-altas-grid">{ALTAS_GRADUACOES.map((faixa) => {
          const ativo = altaAberta === faixa.id;
          return (<button key={faixa.id} type="button" className={`pf-alta-card ${ativo ? 'pf-alta-card--ativo' : ''}`} onClick={() => setAltaAberta(ativo ? '' : faixa.id)} aria-expanded={ativo}>
            <span className="pf-alta-topo"><strong>{faixa.grau}</strong><span aria-hidden="true">↗</span></span>
            <Belt cor={faixa.cor} variante={faixa.variante} compacta />
            <span className="pf-alta-nome">{faixa.titulo}</span><span className="pf-alta-idade">{faixa.idade}</span>
            {ativo && <span className="pf-alta-detalhe">{faixa.tempo}<span>{faixa.total}</span></span>}
          </button>);
        })}</div>
      </section>
      <div className="pf-notas-kids">
        <div className="pf-nota-ilustracao"><span aria-hidden="true">◷</span><strong>Preta: graus e intervalos</strong><p>Do 1º ao 3º grau: intervalos de 3 anos. Do 4º ao 6º: intervalos de 5 anos. Depois: 7, 7 e 10 anos.</p></div>
        <div className="pf-nota-ilustracao"><span aria-hidden="true">★</span><strong>Exceção aos 18 anos</strong><p>Segundo o cartaz, apenas campeões mundiais adultos na faixa marrom podem receber a faixa preta aos 18 anos.</p></div>
      </div>
      <div className="pf-alerta"><strong>Importante</strong><p>O cartaz apresenta períodos mínimos, não prazos fixos. A graduação depende da avaliação do professor e do atendimento às condições da IBJJF. O material é informativo e não altera automaticamente faixas ou graus no sistema.</p></div>
      <FonteRodape />
    </div>
  );
}

export default function ProgressaoFaixas() {
  const [aba, setAba] = useState('kids');
  return (
    <section className="pf-pagina" aria-label="Sistema de graduação de jiu-jitsu">
      <div className="pf-topo"><div className="pf-topo-fio" aria-hidden="true" /><div className="pf-topo-conteudo"><span className="pf-topo-overline"><span className="pf-topo-ponto" /> PROGRESSÃO DE FAIXAS · IBJJF 2026</span><h2>Cada faixa conta<br /><em>uma história.</em></h2><p>Conheça as etapas da sua jornada no Jiu-Jitsu — da primeira faixa às graduações mais altas.</p></div><div className="pf-topo-simbolo" aria-hidden="true">🥋</div></div>
      <div className="pf-controles"><div className="pf-abas" role="tablist" aria-label="Faixas por faixa etária"><button id="pf-aba-kids" role="tab" aria-controls="pf-painel-kids" aria-selected={aba === 'kids'} className={aba === 'kids' ? 'ativo' : ''} type="button" onClick={() => setAba('kids')}><span aria-hidden="true">🌱</span><span><strong>Kids</strong><small>De 4 a 15 anos</small></span></button><button id="pf-aba-adultos" role="tab" aria-controls="pf-painel-adultos" aria-selected={aba === 'adultos'} className={aba === 'adultos' ? 'ativo' : ''} type="button" onClick={() => setAba('adultos')}><span aria-hidden="true">🥋</span><span><strong>Adultos</strong><small>A partir dos 16 anos</small></span></button></div><span className="pf-abas-legenda">Escolha uma categoria para explorar <span aria-hidden="true">↗</span></span></div>
      {aba === 'kids' ? <Kids /> : <Adultos />}
    </section>
  );
}
