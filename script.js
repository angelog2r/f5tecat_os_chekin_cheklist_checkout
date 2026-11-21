// ================= ESTADO E CONSTANTES =================
const NUMERO_CLIENTE = "555197371944";
const SENHA_ABAS_PROTEGIDAS = "0101";
const URL_BASE_OFICIAL = "https://angelog2r.github.io/f5tecat_os_chekin_cheklist_checkout/";
const STORAGE_KEY = "f5tec_os_history_v1";

const STATUS_OS = [
  { key:"Em Diagnóstico", badge:"EmDiagnostico" }, { key:"Em Orçamento", badge:"EmOrcamento" },
  { key:"Aprovado", badge:"Aprovado" }, { key:"Negada", badge:"Negada" },
  { key:"Aguardando Peça", badge:"AguardandoPeca" }, { key:"Em Manutenção", badge:"EmManutencao" },
  { key:"Concluído", badge:"Concluido" }
];

const TERMOS_WHATSAPP = [
  "TERMOS DE SERVICO E GARANTIA - F5TEC",
  "",
  "2 CONDICOES GERAIS",
  "2.1 Pre-orcamento: valor estimado. Orcamento oficial so apos analise. Se nao aprovado, taxa de diagnostico.",
  "2.2 Prazos: retirada em ate 30 dias (10%/mes apos). 90 dias = abandono (Art. 1.263 CC).",
  "2.3 Dados e Senhas: nao nos responsabilizamos por perda de dados. Cliente deve desativar iCloud/Google.",
  "2.4 Placa Logica: pode causar morte subita.",
  "2.5 Estetica: descascamento possivel, F5TEC imune.",
  "2.6 Liquidos: falhas secundarias possiveis.",
  "2.7 Acessorios: nao cobrimos capas/peliculas/chips.",
  "2.8 Logistica: coleta isenta se aprovado. Deslocamento R$1/km se reprovado.",
  "2.9 Comodato: reserva deve ser devolvido em condicoes originais.",
  "",
  "3 GARANTIA",
  "3.1 90 dias (Art. 26 CDC). Cobre apenas a peca/servico descrito.",
  "3.2 Perda: quedas, trincados, umidade, violacao de lacre, terceiros, apps maliciosos.",
  "3.3 Abertura anula resistencia a agua. Nao cobre software/limpeza. Analise em 7 dias uteis.",
  "",
  "4 ACEITE LEGAL",
  "Pagamento/retirada = ACEITE DIGITAL irrevogavel de todas as condicoes."
].join("\n");

let modoAtual = "cliente", abasProtegidasDesbloqueadas = false, modoProtegidoPendente = null;
let ultimoFocoAntesDialog = null, sequenciaPadrao = [], validacaoIniciada = false;
let financeiroAprovado = false, osSessaoNumero = null, filtroHistoricoAtual = "Todos";
let osEmEdicaoPDF = null, debounceEnvioId = null, registrosOS = [], proximoRegistroId = 1;
let enviando = false;

const TAXAS_PARCELAMENTO = { 1:3.08,2:10.74,3:12.09,4:12.45,5:14.76,6:15.01,7:16.96,8:17.20,9:19.55,10:20.46,11:20.73,12:22.02,13:23.13,14:24.25,15:25.36,16:26.48,17:27.59,18:28.70 };
const itensTriagem = [
  { id:"caiu", label:"Caiu?", opcoes:["Sim","Não","Não sei"] },
  { id:"molhou", label:"Molhou?", opcoes:["Sim","Não","Não sei"] },
  { id:"liga", label:"Liga?", opcoes:["Sim","Não","Reiniciando"] },
  { id:"travado", label:"Travado?", opcoes:["Sim","Não"] },
  { id:"carrega", label:"Carrega?", opcoes:["Sim","Não"] },
  { id:"assistencia", label:"Já foi à assistência?", opcoes:["Sim","Não"] },
  { id:"backup", label:"Backup dos dados?", opcoes:["Sim","Não"] },
  { id:"comodato", label:"Precisa de Aparelho Reserva?", opcoes:["Sim (Sujeito a disponibilidade)","Não"] }
];
const itensHardware = ["Aro","Tampa","Lentes da câmera","Tela","Bateria","Carregamento","Auricular","Campainha Viva-voz","Microfone 1","Microfone 2","Conector Fone","Connector USB","Câmera frontal","Câmera traseira","Flash","Wifi Bluetooth GPS","Rede móvel","Chip e cartão de memória","Botão +","Botão -","Botão Power","Botão Biometria","Botão Assistente","Vibracall","Aproximação"];
const fotosEntradaIds = ["fotoEntrada1","fotoEntrada2","fotoEntrada3","fotoEntrada4","fotoEntrada5","fotoEntrada6"];
const fotosSaidaIds = ["fotoSaida1","fotoSaida2","fotoSaida3","fotoSaida4","fotoSaida5","fotoSaida6","fotoSaida7"];
let mesExibidoCalendarioRetirada = new Date(), dataRascunhoRetirada = "";

// ================= HELPERS =================
const fmtMoeda = v => Number(v || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const fmtPct = v => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits:2 });
const fmtData = iso => { try { return new Date(iso).toLocaleString("pt-BR"); } catch { return iso || ""; } };
const totalCat = cat => registrosOS.filter(r => r.categoria === cat).reduce((t,r) => t + (r.quantidade * r.valor), 0);
const radioValor = n => { const el = document.querySelector(`input[name="${n}"]:checked`); return el ? el.value : "Não informado"; };

function obterDiaSemanaLocal(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}$/.exec(valor);
  if (!m) return "";
  const ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return "";
  return data.toLocaleDateString("pt-BR", { weekday: "long" });
}

function formatarDataHoraLocal(valor) {
  if (!valor) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor);
  if (m) {
    const diaSemana = obterDiaSemanaLocal(valor);
    if (diaSemana) return `${diaSemana}, ${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}`;
  }
  return valor;
}

function mostrarOpcoesDialogo(mensagem, titulo, opcoes) {
  return new Promise(resolve => {
    const dlg = document.getElementById("dialogoModal");
    document.getElementById("dialogoTitulo").textContent = titulo;
    document.getElementById("dialogoMensagem").textContent = mensagem;
    const container = document.getElementById("dialogoBotoes"); container.replaceChildren();
    opcoes.forEach(op => {
      const btn = document.createElement("button");
      btn.type = "submit"; btn.value = op.valor; btn.textContent = op.label;
      if (op.primario) btn.classList.add("btn-primary");
      container.appendChild(btn);
    });
    dlg.returnValue = "";
    const h = () => { dlg.removeEventListener("close", h); resolve(dlg.returnValue); };
    dlg.addEventListener("close", h); dlg.showModal();
  });
}
const mostrarAlerta = (msg, titulo) => mostrarOpcoesDialogo(msg, titulo || "Aviso", [{ valor:"ok", label:"OK", primario:true }]);
async function confirmarAcao(msg, titulo, ok, cancel) {
  const r = await mostrarOpcoesDialogo(msg, titulo || "Confirmar", [{ valor:"cancel", label:cancel||"Cancelar" }, { valor:"ok", label:ok||"Confirmar", primario:true }]);
  return r === "ok";
}

// ================= LÓGICA DE NEGÓCIO =================
function atualizarCamposComodato() {
  const simCliente = radioValor("comodato").startsWith("Sim");
  const temDisp = radioValor("disponibilidadeComodato") === "Sim";
  document.getElementById("areaComodato").classList.toggle("hidden", !simCliente || modoAtual !== "tecnico");
  document.getElementById("avisoComodatoCliente").classList.toggle("hidden", !simCliente || modoAtual === "tecnico");
  if (simCliente && modoAtual === "tecnico") {
    document.getElementById("camposComodato").classList.toggle("hidden", !temDisp);
    ["comodatoMarca","comodatoModelo","comodatoCor","comodatoObservacao","comodatoFotoFrente","comodatoFotoVerso","comodatoFotoIMEI"].forEach(id => { const el = document.getElementById(id); if (el) el.required = temDisp; });
  }
}

function atualizarStatusReparo() {
  if (modoAtual !== "tecnico") return;
  const s = radioValor("statusReparo");
  document.getElementById("btnModoOS").disabled = (s !== "Aprovado" && s !== "Reprovado");
  const blocoTaxas = document.getElementById("blocoTaxasReprovado");
  if (s === "Reprovado") {
    document.getElementById("avisoReprovado").classList.remove("hidden");
    blocoTaxas.classList.remove("hidden");
    const chk = document.getElementById("chkTaxaDiagnostico");
    if (!chk.checked) { chk.checked = true; adicionarTaxaDiagnostico(); }
  } else {
    document.getElementById("avisoReprovado").classList.add("hidden");
    blocoTaxas.classList.add("hidden");
    const chk = document.getElementById("chkTaxaDiagnostico");
    if (chk.checked) { chk.checked = false; adicionarTaxaDiagnostico(); }
    const chkD = document.getElementById("chkTaxaDeslocamento");
    if (chkD.checked) { chkD.checked = false; toggleTaxaDeslocamento(); }
  }
  atualizarEstadoEnvio();
}

function atualizarCamposEntregaFinal() {
  const tipo = document.getElementById("tipoEntregaFinal").value;
  const mostra = tipo === "Tele-busca e Entrega";
  document.getElementById("camposEntregaFinal").classList.toggle("hidden", !mostra);
  const chk = document.getElementById("chkMesmoEndereco");
  document.getElementById("enderecoEntregaFinal").required = mostra && !chk.checked;
  document.getElementById("dataHoraAgendamento").required = mostra;
}
function copiarEnderecoColeta() {
  const chk = document.getElementById("chkMesmoEndereco"), campo = document.getElementById("enderecoEntregaFinal");
  const origem = document.getElementById("enderecoEntrega").value.trim();
  if (chk.checked) {
    if (!origem) { mostrarAlerta("Preencha o endereço na aba do cliente primeiro.", "Endereço vazio"); chk.checked = false; return; }
    campo.value = origem; campo.disabled = true; campo.required = false;
  } else { campo.disabled = false; campo.required = true; }
}

async function aprovarFinanceiro() {
  if (!formularioValidoVisivel() && modoAtual === "os") { await mostrarAlerta("Preencha todos os campos.", "Incompleto"); return; }
  const d = obterDadosPagamento();
  if (d.forma === "Cartão de Crédito" && !d.taxaValida) { await mostrarAlerta("Informe a taxa.", "Taxa ausente"); document.getElementById("taxaCartao").focus(); return; }
  if (!(d.total > 0 && d.forma)) { await mostrarAlerta("Adicione itens e forma de pagamento.", "Vazio"); return; }
  financeiroAprovado = true;
  document.getElementById("btnModoCheckout").disabled = false;
  const btn = document.getElementById("btnAprovarFinanceiro");
  btn.textContent = "✅ Aprovado (Checkout Liberado)"; btn.style.background = "#15803d";
  alternarModo("checkout", true);
}

async function encurtarUrl(url) {
  try {
    const ctrl = new AbortController();
    const req = fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`, { signal: ctrl.signal })
      .then(async r => r.ok ? (await r.json()).shorturl || null : null).catch(() => null);
    const t = new Promise(res => setTimeout(() => { try { ctrl.abort(); } catch {} res(null); }, 4000));
    return (await Promise.race([req, t])) || url;
  } catch { return url; }
}

// ================= PAGAMENTO =================
function popularParcelas() {
  const s = document.getElementById("parcelasCartao"); s.replaceChildren();
  for (let i = 1; i <= 18; i++) { const o = document.createElement("option"); o.value = String(i); o.textContent = i === 1 ? "1x (à vista)" : `${i}x`; s.appendChild(o); }
}
function atualizarTaxaCartao() {
  const p = document.getElementById("parcelasCartao").value;
  document.getElementById("taxaCartao").value = TAXAS_PARCELAMENTO[p] ? TAXAS_PARCELAMENTO[p].toFixed(2).replace(".",",") : "";
}
function obterDadosPagamento() {
  const forma = document.getElementById("formaPagamento").value;
  const total = totalCat("Peça") + totalCat("Serviço");
  const parcelas = Math.max(1, Number(document.getElementById("parcelasCartao").value) || 1);
  const tTxt = document.getElementById("taxaCartao").value.trim().replace(",",".");
  const taxa = Number(tTxt); const taxaValida = tTxt !== "" && Number.isFinite(taxa) && taxa >= 0;
  let totalFinal = total, acrescimo = 0;
  if (forma === "Cartão de Crédito") { const t = taxaValida ? taxa : 0; totalFinal = t > 0 ? total * (1 + t / 100) : total; acrescimo = totalFinal - total; }
  return { forma, total, parcelas, taxa: taxaValida ? taxa : 0, taxaValida, acrescimo, totalFinal, valorParcela: totalFinal / parcelas,
    precisaTroco: document.getElementById("precisaTroco").value === "Sim", valorTroco: document.getElementById("valorTroco").value };
}
function renderizarPagamento() {
  const d = obterDadosPagamento();
  document.getElementById("resumoFormaPagamento").textContent = d.forma || "Não informada";
  const cartao = d.forma === "Cartão de Crédito", dinheiro = d.forma === "Dinheiro";
  document.getElementById("linhaParcelas").classList.toggle("hidden", !cartao);
  document.getElementById("linhaAcrescimo").classList.toggle("hidden", !cartao);
  document.getElementById("linhaTroco").classList.toggle("hidden", !dinheiro || !d.precisaTroco);
  if (cartao) {
    document.getElementById("resumoParcelas").textContent = `${d.parcelas}x de ${fmtMoeda(d.valorParcela)}`;
    document.getElementById("resumoAcrescimo").textContent = d.taxaValida ? `${fmtPct(d.taxa)}% (${fmtMoeda(d.acrescimo)})` : "Informe a taxa";
  }
  if (dinheiro && d.precisaTroco) document.getElementById("resumoTroco").textContent = d.valorTroco ? `R$ ${d.valorTroco}` : "Informe";
  document.getElementById("totalComPagamento").textContent = fmtMoeda(d.totalFinal);
  document.getElementById("btnAprovarFinanceiro").disabled = !(d.total > 0 && d.forma);
}
function toggleTroco() {
  const p = document.getElementById("precisaTroco").value === "Sim";
  document.getElementById("campoValorTroco").classList.toggle("hidden", !p);
  document.getElementById("valorTroco").required = p; renderizarPagamento();
}
function atualizarCamposPagamento() {
  const ativo = modoAtual === "os", forma = document.getElementById("formaPagamento").value;
  const cartao = ativo && forma === "Cartão de Crédito", pix = ativo && forma === "PIX", dinheiro = ativo && forma === "Dinheiro";
  document.getElementById("formaPagamento").disabled = !ativo;
  document.getElementById("campoParcelas").classList.toggle("hidden", !cartao);
  document.getElementById("campoTaxaCartao").classList.toggle("hidden", !cartao);
  document.getElementById("avisoPix").classList.toggle("hidden", !pix);
  document.getElementById("campoDinheiro").classList.toggle("hidden", !dinheiro);
  document.getElementById("parcelasCartao").disabled = !cartao;
  document.getElementById("taxaCartao").disabled = !cartao;
  document.getElementById("parcelasCartao").required = cartao;
  document.getElementById("taxaCartao").required = cartao;
  if (cartao) atualizarTaxaCartao();
  renderizarPagamento();
}
function gerarResumoPagamento() {
  const d = obterDadosPagamento();
  let r = "*FORMA DE PAGAMENTO*\n";
  if (!d.forma) return r + "- Não informada";
  r += `- Forma: *${d.forma}*\n`;
  if (d.forma === "Cartão de Crédito") { r += `- Parcelas: *${d.parcelas}x de ${fmtMoeda(d.valorParcela)}*\n`; r += `- Taxa: *${fmtPct(d.taxa)}%* (acréscimo ${fmtMoeda(d.acrescimo)})\n`; }
  else if (d.forma === "PIX") r += "- PIX: *+55 51 99737 1944*\n";
  else if (d.forma === "Dinheiro") r += `- Troco: *${d.precisaTroco ? `Sim, para R$ ${d.valorTroco}` : "Não (exato)"}*\n`;
  r += `- *Total a pagar: ${fmtMoeda(d.totalFinal)}*`;
  return r;
}

// ================= REGISTROS =================
function criarItemRegistro(r) {
  const item = document.createElement("div"); item.className = "registro-item";
  const det = document.createElement("div");
  const desc = document.createElement("strong"); desc.textContent = r.descricao;
  const qtd = document.createElement("small"); qtd.textContent = `${r.quantidade} × ${fmtMoeda(r.valor)}`;
  det.append(desc, document.createElement("br"), qtd);
  const dir = document.createElement("div"); dir.style.textAlign = "right";
  const tot = document.createElement("div"); tot.className = "registro-valor"; tot.textContent = fmtMoeda(r.quantidade * r.valor);
  const rem = document.createElement("button"); rem.type = "button"; rem.className = "btn-remover"; rem.textContent = "Remover";
  rem.onclick = () => removerRegistroOS(r.id);
  dir.append(tot, rem); item.append(det, dir);
  return item;
}
function renderizarRegistrosOS() {
  ["Peça","Serviço"].forEach(cat => {
    const cont = document.getElementById(cat === "Peça" ? "listaPecas" : "listaServicos"); cont.replaceChildren();
    const regs = registrosOS.filter(r => r.categoria === cat);
    if (!regs.length) { const v = document.createElement("small"); v.className = "text-muted"; v.textContent = cat === "Peça" ? "Nenhuma peça." : "Nenhum serviço."; cont.appendChild(v); return; }
    regs.forEach(r => cont.appendChild(criarItemRegistro(r)));
  });
  document.getElementById("totalPecas").textContent = fmtMoeda(totalCat("Peça"));
  document.getElementById("totalServicos").textContent = fmtMoeda(totalCat("Serviço"));
  document.getElementById("totalGeral").textContent = fmtMoeda(totalCat("Peça") + totalCat("Serviço"));
  renderizarPagamento();
}
function adicionarRegistroOS() {
  const cat = document.getElementById("categoriaRegistro").value;
  const desc = document.getElementById("descricaoRegistro").value.trim();
  const qtd = Number(document.getElementById("quantidadeRegistro").value.trim());
  const val = Number(document.getElementById("valorRegistro").value.trim().replace(",","."));
  if (!desc) { document.getElementById("descricaoRegistro").focus(); mostrarAlerta("Informe a descrição."); return; }
  if (!Number.isInteger(qtd) || qtd < 1) { document.getElementById("quantidadeRegistro").focus(); mostrarAlerta("Quantidade inválida."); return; }
  if (!Number.isFinite(val) || val < 0) { document.getElementById("valorRegistro").focus(); mostrarAlerta("Valor inválido."); return; }
  registrosOS.push({ id: proximoRegistroId++, categoria: cat, descricao: desc, quantidade: qtd, valor: val });
  document.getElementById("descricaoRegistro").value = ""; document.getElementById("quantidadeRegistro").value = "1"; document.getElementById("valorRegistro").value = "";
  document.getElementById("descricaoRegistro").focus(); renderizarRegistrosOS();
}
function removerRegistroOS(id) {
  registrosOS = registrosOS.filter(r => r.id !== id);
  if (id === "taxa_Taxa de Deslocamento") document.getElementById("chkTaxaDeslocamento").checked = false;
  if (id === "taxa_Taxa de Diagnóstico") document.getElementById("chkTaxaDiagnostico").checked = false;
  renderizarRegistrosOS();
}
function toggleTaxaDeslocamento() {
  const chk = document.getElementById("chkTaxaDeslocamento");
  document.getElementById("campoDistanciaDeslocamento").classList.toggle("hidden", !chk.checked);
  atualizarTaxaDeslocamento();
}
function atualizarTaxaDeslocamento() {
  const chk = document.getElementById("chkTaxaDeslocamento"), raw = document.getElementById("inputDistancia").value;
  const dist = Number(raw), id = "taxa_Taxa de Deslocamento";
  if (!chk.checked || raw === "" || !Number.isFinite(dist) || dist <= 0) { registrosOS = registrosOS.filter(r => r.id !== id); renderizarRegistrosOS(); return; }
  const exist = registrosOS.find(r => r.id === id);
  if (exist) { exist.valor = dist; exist.descricao = `Taxa de Deslocamento (${dist} km)`; }
  else registrosOS.push({ id, categoria: "Serviço", descricao: `Taxa de Deslocamento (${dist} km)`, quantidade: 1, valor: dist });
  renderizarRegistrosOS();
}
function adicionarTaxaDiagnostico() {
  const id = "taxa_Taxa de Diagnóstico";
  if (document.getElementById("chkTaxaDiagnostico").checked) { if (!registrosOS.some(r => r.id === id)) registrosOS.push({ id, categoria:"Serviço", descricao:"Taxa de Diagnóstico", quantidade:1, valor:50 }); }
  else registrosOS = registrosOS.filter(r => r.id !== id);
  renderizarRegistrosOS();
}
function gerarResumoRegistrosOS() {
  if (!registrosOS.length) return "*PEÇAS E SERVIÇOS*\n- Nenhum registro.";
  let r = "*PEÇAS E SERVIÇOS*\n";
  ["Peça","Serviço"].forEach(cat => {
    const regs = registrosOS.filter(x => x.categoria === cat);
    r += `\n*${cat === "Peça" ? "Peças" : "Serviços"}*\n`;
    if (!regs.length) r += "- Nenhum\n";
    else regs.forEach(x => r += `- ${x.descricao}: ${x.quantidade} × ${fmtMoeda(x.valor)} = ${fmtMoeda(x.quantidade * x.valor)}\n`);
  });
  r += `\n- Total peças: ${fmtMoeda(totalCat("Peça"))}\n- Total serviços: ${fmtMoeda(totalCat("Serviço"))}\n- *TOTAL: ${fmtMoeda(totalCat("Peça") + totalCat("Serviço"))}*`;
  return r;
}

// ================= FORMULÁRIO E CHECKLISTS =================
function criarGrupoOpcoes(contId, lista, opcoesPadrao, prefixo) {
  const cont = document.getElementById(contId); if (!cont) return; cont.replaceChildren();
  lista.forEach((item, idx) => {
    const nome = typeof item === "string" ? item : item.label;
    const chave = typeof item === "string" ? prefixo + idx : item.id;
    const ops = typeof item === "string" ? opcoesPadrao : item.opcoes;
    const fs = document.createElement("fieldset"); fs.className = "field";
    const lg = document.createElement("legend"); lg.textContent = nome; fs.appendChild(lg);
    const grp = document.createElement("div"); grp.className = "radio-group"; grp.id = "grp_" + chave; fs.appendChild(grp);
    cont.appendChild(fs);
    ops.forEach(op => {
      const pill = document.createElement("label"); pill.className = "radio-pill";
      if (op === "Sim" || op.startsWith("Sim ") || op === "OK") pill.classList.add("option-positive");
      else if (op === "Não" || op === "Defeito") pill.classList.add("option-negative");
      else if (["Não sei","Não precisa","Não Testado","Reiniciando"].includes(op)) pill.classList.add("option-indecisive");
      const inp = document.createElement("input"); inp.type = "radio"; inp.name = chave; inp.value = op;
      if (chave === "comodato") inp.addEventListener("change", atualizarCamposComodato);
      pill.appendChild(inp); pill.appendChild(document.createTextNode(op)); grp.appendChild(pill);
    });
  });
}
criarGrupoOpcoes("perguntasTriagem", itensTriagem, [], "");
criarGrupoOpcoes("listaHardware", itensHardware, ["OK","Defeito","Não Testado"], "hw_");
criarGrupoOpcoes("listaHardwareSaida", itensHardware, ["OK","Defeito","Não Testado"], "out_");

function atualizarCampoAcessorios() {
  const sim = document.getElementById("possuiAcessorios").value === "Sim";
  document.getElementById("campoListaAcessorios").classList.toggle("hidden", !sim);
  document.getElementById("acessorios").required = sim;
  if (!sim) document.getElementById("acessorios").value = "";
}
function atualizarCamposEntrega() {
  const sim = document.getElementById("servicoEntrega").value === "Sim";
  document.getElementById("camposEntrega").classList.toggle("hidden", !sim);
  document.getElementById("enderecoEntrega").required = sim;
  if (!sim) {
    ["enderecoEntrega","pontoReferencia","linkLocalizacao","dataHoraRetirada","dataHoraColetaTecnico"].forEach(id => document.getElementById(id).value = "");
    document.querySelectorAll('input[name="confirmacaoAgendamento"]').forEach(r => r.checked = false);
  }
  atualizarDiaSemanaRetirada();
  atualizarResumoAgendamento(); atualizarCamposAgendamento();
}
function atualizarDiaSemanaRetirada() {
  const campo = document.getElementById("dataHoraRetirada");
  const diaSemana = obterDiaSemanaLocal(campo.value);
  const valor = document.getElementById("valorDataHoraRetirada");
  const confirmacao = document.getElementById("confirmacaoDataHoraRetirada");
  valor.textContent = campo.value ? formatarDataHoraLocal(campo.value) : "Selecione data e horário";
  confirmacao.textContent = diaSemana ? "Data e horário confirmados." : "";
  confirmacao.classList.toggle("hidden", !diaSemana);
}
function atualizarPreviewCalendarioRetirada() {
  const horario = document.getElementById("horarioRetiradaRascunho").value;
  const diaSemana = dataRascunhoRetirada ? obterDiaSemanaLocal(`${dataRascunhoRetirada}T00:00`) : "";
  const preview = document.getElementById("diaSemanaRetiradaRascunho");
  const minimo = document.getElementById("dataHoraRetirada").min;
  const inputHorario = document.getElementById("horarioRetiradaRascunho");
  inputHorario.min = minimo && dataRascunhoRetirada === minimo.slice(0, 10) ? minimo.slice(11, 16) : "";
  preview.textContent = diaSemana ? `Dia selecionado: ${diaSemana}${horario ? ` às ${horario}` : ""}` : "Selecione um dia";
  atualizarConfirmacaoCalendarioRetirada();
}
function atualizarConfirmacaoCalendarioRetirada() {
  const horario = document.getElementById("horarioRetiradaRascunho").value;
  const minimo = document.getElementById("dataHoraRetirada").min;
  const valor = dataRascunhoRetirada && horario ? `${dataRascunhoRetirada}T${horario}` : "";
  const erro = document.getElementById("erroCalendarioRetirada");
  const botao = document.getElementById("confirmarDataHoraRetirada");
  const invalido = Boolean(valor && minimo && valor < minimo);
  erro.textContent = invalido ? "Escolha um horário futuro." : "";
  erro.classList.toggle("hidden", !invalido);
  botao.disabled = !valor || invalido;
}
function renderizarCalendarioRetirada() {
  const ano = mesExibidoCalendarioRetirada.getFullYear();
  const mes = mesExibidoCalendarioRetirada.getMonth();
  const inicioMes = new Date(ano, mes, 1);
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const offset = (inicioMes.getDay() + 6) % 7;
  const grade = document.getElementById("calendarioRetirada");
  const minimo = document.getElementById("dataHoraRetirada").min;
  const menorData = minimo ? minimo.slice(0, 10) : "";
  document.getElementById("mesAnoCalendarioRetirada").textContent =
    inicioMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  grade.replaceChildren();
  for (let i = 0; i < offset; i++) {
    const vazio = document.createElement("span");
    vazio.className = "calendar-empty";
    vazio.setAttribute("aria-hidden", "true");
    grade.appendChild(vazio);
  }
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const data = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "calendar-day";
    botao.textContent = String(dia);
    botao.setAttribute("aria-label", new Date(ano, mes, dia).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    botao.setAttribute("aria-pressed", String(data === dataRascunhoRetirada));
    if (data === dataRascunhoRetirada) botao.classList.add("selected");
    botao.disabled = Boolean(menorData && data < menorData);
    botao.addEventListener("click", () => {
      dataRascunhoRetirada = data;
      renderizarCalendarioRetirada();
      atualizarPreviewCalendarioRetirada();
    });
    grade.appendChild(botao);
  }
  atualizarPreviewCalendarioRetirada();
}
function abrirCalendarioRetirada() {
  const valor = document.getElementById("dataHoraRetirada").value;
  dataRascunhoRetirada = valor ? valor.slice(0, 10) : "";
  document.getElementById("horarioRetiradaRascunho").value = valor ? valor.slice(11, 16) : "";
  const base = dataRascunhoRetirada
    ? new Date(Number(dataRascunhoRetirada.slice(0, 4)), Number(dataRascunhoRetirada.slice(5, 7)) - 1, Number(dataRascunhoRetirada.slice(8, 10)))
    : new Date();
  mesExibidoCalendarioRetirada = new Date(base.getFullYear(), base.getMonth(), 1);
  document.getElementById("erroCalendarioRetirada").textContent = "";
  document.getElementById("erroCalendarioRetirada").classList.add("hidden");
  renderizarCalendarioRetirada();
  const dialogo = document.getElementById("dialogoDataHoraRetirada");
  document.getElementById("abrirCalendarioRetirada").setAttribute("aria-expanded", "true");
  dialogo.showModal();
}
function confirmarDataHoraRetirada() {
  const horario = document.getElementById("horarioRetiradaRascunho").value;
  if (!dataRascunhoRetirada || !horario) {
    atualizarConfirmacaoCalendarioRetirada();
    document.getElementById("horarioRetiradaRascunho").focus();
    return;
  }
  const valor = `${dataRascunhoRetirada}T${horario}`;
  const minimo = document.getElementById("dataHoraRetirada").min;
  if (minimo && valor < minimo) {
    atualizarConfirmacaoCalendarioRetirada();
    document.getElementById("horarioRetiradaRascunho").focus();
    return;
  }
  const campo = document.getElementById("dataHoraRetirada");
  campo.value = valor;
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  campo.dispatchEvent(new Event("change", { bubbles: true }));
  document.getElementById("dialogoDataHoraRetirada").close();
}
function limparDataHoraRetirada() {
  const campo = document.getElementById("dataHoraRetirada");
  campo.value = "";
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  campo.dispatchEvent(new Event("change", { bubbles: true }));
  document.getElementById("dialogoDataHoraRetirada").close();
}
function atualizarResumoAgendamento() {
  document.getElementById("clienteAgendamento").textContent = document.getElementById("cliente").value.trim() || "—";
  document.getElementById("telefoneAgendamento").textContent = document.getElementById("telefone").value.trim() || "—";
  document.getElementById("enderecoAgendamento").textContent = document.getElementById("enderecoEntrega").value.trim() || "—";
  document.getElementById("referenciaAgendamento").textContent = document.getElementById("pontoReferencia").value.trim() || "—";
  document.getElementById("preferenciaAgendamento").textContent = formatarDataHoraLocal(document.getElementById("dataHoraRetirada").value.trim()) || "—";
  const link = document.getElementById("linkLocalizacao").value.trim();
  const linkEl = document.getElementById("linkAgendamento"), txtEl = document.getElementById("linkAgendamentoTexto");
  linkEl.classList.add("hidden"); txtEl.classList.toggle("hidden", !link); txtEl.textContent = link || "—";
  if (!link) return;
  let url = link; if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try { const u = new URL(url); if (u.protocol === "http:" || u.protocol === "https:") { linkEl.href = u.href; linkEl.classList.remove("hidden"); txtEl.classList.add("hidden"); } } catch {}
}
function atualizarCamposAgendamento() {
  const sol = document.getElementById("servicoEntrega").value === "Sim", res = radioValor("confirmacaoAgendamento");
  const prop = sol && res === "Não";
  document.getElementById("campoNovoAgendamento").classList.toggle("hidden", !prop);
  const campo = document.getElementById("dataHoraColetaTecnico"); campo.required = prop;
  if (res === "Sim") campo.value = "";
  atualizarEstadoEnvio();
}
function atualizarIndicadoresPendencia(mostrar) {
  const pend = [];
  const sel = modoAtual === "os" ? "#blocoDadosOS .field, #blocoOS .field"
    : modoAtual === "checkout" ? "#blocoCheckout .field, #blocoCheckout .checkbox-row"
    : "#formOS .field, #formOS .checkbox-row";
  document.querySelectorAll(sel).forEach(c => {
    const vis = c.getClientRects().length > 0;
    if (!vis) { c.classList.remove("has-pending"); c.querySelectorAll("[aria-invalid]").forEach(e => e.removeAttribute("aria-invalid")); return; }
    let p = false;
    const rd = c.querySelectorAll('input[type="radio"]');
    if (rd.length) {
      const sem = !c.querySelector('input[type="radio"]:checked');
      if (sem && c.id !== "statusReparoField" && c.id !== "disponibilidadeComodato") p = true;
      rd.forEach(r => mostrar && sem ? r.setAttribute("aria-invalid","true") : r.removeAttribute("aria-invalid"));
    }
    c.querySelectorAll('input:not([type="radio"]), select, textarea').forEach(ctrl => {
      if (ctrl.willValidate) { const inv = !ctrl.checkValidity(); if (inv) p = true; if (mostrar && inv) ctrl.setAttribute("aria-invalid","true"); else ctrl.removeAttribute("aria-invalid"); }
    });
    if (c.id === "camposEntrega") {
      const semDataRetirada = document.getElementById("servicoEntrega").value === "Sim"
        && !document.getElementById("dataHoraRetirada").value;
      const abrirCalendario = document.getElementById("abrirCalendarioRetirada");
      if (mostrar && semDataRetirada) abrirCalendario.setAttribute("aria-invalid", "true");
      else abrirCalendario.removeAttribute("aria-invalid");
      if (semDataRetirada) p = true;
    }
    c.classList.toggle("has-pending", mostrar && p);
    if (p) {
      const l = c.querySelector("label, legend");
      const nome = c.id === "camposEntrega"
        && document.getElementById("servicoEntrega").value === "Sim"
        && !document.getElementById("dataHoraRetirada").value
        ? "Dia e Horário de Retirada *"
        : l ? l.textContent.trim().replace(/\s+/g," ") : "Campo";
      pend.push({ campo: c, nome });
    }
  });
  const res = document.getElementById("validationSummary");
  res.classList.toggle("hidden", !mostrar || pend.length === 0);
  if (mostrar && pend.length > 0) document.getElementById("validationMessage").textContent = `⚠ Faltam ${pend.length} item(ns). Próximo: ${pend[0].nome}`;
  return pend;
}
const formularioValidoVisivel = () => Array.from(document.getElementById("formOS").elements).every(c => !c.willValidate || c.getClientRects().length === 0 || c.checkValidity())
  && (document.getElementById("servicoEntrega").value !== "Sim" || Boolean(document.getElementById("dataHoraRetirada").value));
function irParaPrimeiraPendencia() {
  const p = Array.from(document.querySelectorAll("#formOS .has-pending")).find(c => c.getClientRects().length > 0);
  if (p) {
    p.scrollIntoView({ behavior: "smooth", block: "center" });
    if (p.id === "camposEntrega") {
      const semDataRetirada = document.getElementById("servicoEntrega").value === "Sim"
        && !document.getElementById("dataHoraRetirada").value;
      if (semDataRetirada) document.getElementById("abrirCalendarioRetirada").focus();
      else p.querySelector("input:invalid, select:invalid, textarea:invalid")?.focus();
    }
  }
}

function gerarRelatorioDiagnostico(prefixo) {
  const def = [], nt = [], ok = [];
  itensHardware.forEach((n, i) => {
    const v = radioValor(prefixo + i);
    if (v === "Defeito") def.push(n);
    else if (v === "Não Testado") nt.push(n);
    else if (v === "OK") ok.push(n);
  });
  return { defeitos: def, naoTestados: nt, ok };
}

function renderizarDiagnostico() {
  const area = document.getElementById("areaDiagnostico"), cont = document.getElementById("conteudoDiagnostico");
  if (!area || !cont) return;
  if (modoAtual !== "tecnico") { area.classList.add("hidden"); return; }
  area.classList.remove("hidden");

  const d = gerarRelatorioDiagnostico("hw_");
  if (!d.defeitos.length && !d.naoTestados.length && !d.ok.length) {
    cont.innerHTML = `<div style="background:#1f2937;border:1px dashed #374151;border-radius:6px;padding:16px;font-size:0.85rem;color:#9ca3af;text-align:center;">Marque os itens do checklist acima para visualizar o Laudo Técnico.</div>`;
    return;
  }

  const marca = document.getElementById("marca").value.trim() || "—";
  const modelo = document.getElementById("modelo").value.trim() || "—";
  const cor = document.getElementById("cor").value.trim();
  const defeito = document.getElementById("defeito").value.trim() || "—";
  const numOS = osSessaoNumero || "(gerado no envio)";
  const total = d.ok.length + d.defeitos.length + d.naoTestados.length;
  const arrumar = registrosOS.filter(r => r.categoria === "Serviço").map(r => r.descricao).join(", ");

  let html = `<div style="background:#1f2937;border-left:4px solid #3b82f6;border-radius:4px;padding:14px;margin-bottom:10px;">
    <div style="font-size:0.95rem;font-weight:700;color:#fff;margin-bottom:10px;">LAUDO TÉCNICO DE DIAGNÓSTICO — F5TEC</div>
    <div style="font-size:0.85rem;color:#d1d5db;line-height:1.7;">
      <div><strong style="color:#93c5fd;">Aparelho:</strong> ${marca} ${modelo}${cor ? ` (${cor})` : ""}</div>
      <div><strong style="color:#93c5fd;">OS / Protocolo:</strong> ${numOS}</div>
      <div><strong style="color:#93c5fd;">Reclamação:</strong> ${defeito}</div>
    </div>
    <div style="font-size:0.82rem;color:#9ca3af;margin-top:10px;padding-top:10px;border-top:1px solid #374151;font-style:italic;">
      Após abertura técnica e testes de bancada, identificamos o seguinte quadro:
    </div>
  </div>`;

  html += `<div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:8px;padding:12px;margin-bottom:10px;">
    <strong style="color:#fca5a5;font-size:0.9rem;">DIAGNÓSTICO CONSTATADO:</strong>
    <ul style="margin:6px 0 0;padding-left:20px;color:#f87171;font-size:0.85rem;line-height:1.6;">${d.defeitos.length ? d.defeitos.map(x => `<li>${x}</li>`).join("") : '<li>Nenhum defeito funcional identificado nos itens testados.</li>'}</ul>
  </div>`;

  if (d.naoTestados.length) {
    html += `<div style="background:#451a03;border:1px solid #78350f;border-radius:8px;padding:12px;margin-bottom:10px;">
      <strong style="color:#fcd34d;font-size:0.9rem;">ITENS NÃO TESTADOS:</strong>
      <ul style="margin:6px 0 0;padding-left:20px;color:#fbbf24;font-size:0.85rem;line-height:1.6;">${d.naoTestados.map(x => `<li>${x}</li>`).join("")}</ul>
    </div>`;
  }

  html += `<div style="background:#064e3b;border:1px solid #047857;border-radius:8px;padding:12px;margin-bottom:10px;">
    <strong style="color:#6ee7b7;font-size:0.9rem;">SOLUÇÃO RECOMENDADA:</strong>
    <div style="margin-top:6px;color:#a7f3d0;font-size:0.85rem;line-height:1.6;">${arrumar || "A definir conforme aprovação do orçamento."}</div>
  </div>`;

  html += `<div style="background:#1f2937;border-radius:6px;padding:12px;font-size:0.85rem;color:#d1d5db;line-height:1.7;">
    <strong style="color:#fff;">RESUMO DO CHECKLIST</strong><br>
    Itens avaliados: <strong>${total}</strong> · Aprovados: <strong style="color:#6ee7b7;">${d.ok.length}</strong> · Defeitos: <strong style="color:#f87171;">${d.defeitos.length}</strong> · Não testados: <strong style="color:#fbbf24;">${d.naoTestados.length}</strong>
  </div>`;

  cont.innerHTML = html;
}

function atualizarEstadoEnvio() {
  const btn = document.querySelector(".btn-submit"), txt = document.getElementById("textoBotaoEnvio");
  if (enviando) { btn.disabled = true; return false; }
  if (modoAtual === "cliente") {
    const triagemOk = itensTriagem.every(i => document.querySelector(`input[name="${i.id}"]:checked`));
    const pronto = formularioValidoVisivel() && triagemOk;
    atualizarIndicadoresPendencia(validacaoIniciada);
    btn.classList.toggle("awaiting-completion", !pronto);
    btn.setAttribute("aria-disabled", String(!pronto));
    txt.textContent = pronto ? "Enviar Cadastro para a Assistência" : "Verificar Preenchimento";
    return pronto;
  }
  if (modoAtual === "tecnico") {
    const fotosOk = fotosEntradaIds.every(id => document.getElementById(id).files.length > 0);
    const bancadaOk = itensHardware.every((_, i) => document.querySelector(`input[name="hw_${i}"]:checked`));
    const status = radioValor("statusReparo");
    const respAg = radioValor("confirmacaoAgendamento");
    const horario = document.getElementById("dataHoraRetirada").value.trim();
    const agOk = document.getElementById("servicoEntrega").value !== "Sim" || (horario !== "" && (respAg === "Sim" || (respAg === "Não" && document.getElementById("dataHoraColetaTecnico").value.trim() !== "")));
    document.getElementById("btnModoOS").disabled = (status !== "Aprovado" && status !== "Reprovado");
    atualizarIndicadoresPendencia(validacaoIniciada);
    renderizarDiagnostico();
    const pronto = fotosOk && bancadaOk && status !== "Não informado" && agOk;
    btn.classList.toggle("awaiting-completion", !pronto);
    btn.setAttribute("aria-disabled", String(!pronto));
    txt.textContent = pronto ? "Enviar Laudo para o Cliente" : "Verificar Checklist";
    return pronto;
  }
  if (modoAtual === "os") {
    const pend = atualizarIndicadoresPendencia(validacaoIniciada);
    const pronto = pend.length === 0;
    btn.classList.toggle("awaiting-completion", !pronto);
    btn.setAttribute("aria-disabled", String(!pronto));
    txt.textContent = pronto ? "Enviar Orçamento para o Cliente" : "Verificar Dados Financeiros";
    return pronto;
  }
  if (modoAtual === "checkout") {
    const fotosOk = fotosSaidaIds.every(id => document.getElementById(id).files.length > 0);
    const bancadaOk = itensHardware.every((_, i) => document.querySelector(`input[name="out_${i}"]:checked`));
    const pend = atualizarIndicadoresPendencia(validacaoIniciada);
    const pronto = fotosOk && bancadaOk && pend.length === 0 && financeiroAprovado;
    btn.classList.toggle("awaiting-completion", !pronto);
    btn.setAttribute("aria-disabled", String(!pronto));
    txt.textContent = pronto ? "Finalizar OS e Escolher PDF" : "Verificar Checklist de Saída";
    return pronto;
  }
  if (modoAtual === "historico") {
    btn.classList.add("awaiting-completion");
    btn.disabled = true;
    btn.setAttribute("aria-disabled", "true");
    txt.textContent = "Histórico de Ordens";
    return false;
  }
  return false;
}

// ================= EVENT LISTENERS =================
const formularioOS = document.getElementById("formOS");
formularioOS.addEventListener("input", () => { clearTimeout(debounceEnvioId); debounceEnvioId = setTimeout(atualizarEstadoEnvio, 150); });
formularioOS.addEventListener("change", atualizarEstadoEnvio);
document.getElementById("dataHoraRetirada").addEventListener("input", () => {
  atualizarDiaSemanaRetirada();
  atualizarResumoAgendamento();
});
document.getElementById("dataHoraRetirada").addEventListener("change", () => {
  atualizarDiaSemanaRetirada();
  atualizarResumoAgendamento();
});
document.getElementById("abrirCalendarioRetirada").addEventListener("click", abrirCalendarioRetirada);
document.getElementById("mesAnteriorRetirada").addEventListener("click", () => {
  mesExibidoCalendarioRetirada = new Date(mesExibidoCalendarioRetirada.getFullYear(), mesExibidoCalendarioRetirada.getMonth() - 1, 1);
  renderizarCalendarioRetirada();
});
document.getElementById("mesSeguinteRetirada").addEventListener("click", () => {
  mesExibidoCalendarioRetirada = new Date(mesExibidoCalendarioRetirada.getFullYear(), mesExibidoCalendarioRetirada.getMonth() + 1, 1);
  renderizarCalendarioRetirada();
});
document.getElementById("horarioRetiradaRascunho").addEventListener("input", atualizarPreviewCalendarioRetirada);
document.getElementById("dialogoDataHoraRetirada").addEventListener("close", () => {
  document.getElementById("abrirCalendarioRetirada").setAttribute("aria-expanded", "false");
});
document.getElementById("limparDataHoraRetirada").addEventListener("click", limparDataHoraRetirada);
document.getElementById("cancelarDataHoraRetirada").addEventListener("click", () => {
  document.getElementById("dialogoDataHoraRetirada").close();
});
document.getElementById("confirmarDataHoraRetirada").addEventListener("click", confirmarDataHoraRetirada);
document.getElementById("irParaPendencia").addEventListener("click", irParaPrimeiraPendencia);
document.getElementById("possuiAcessorios").addEventListener("change", atualizarCampoAcessorios);
document.getElementById("formaPagamento").addEventListener("change", atualizarCamposPagamento);
document.getElementById("parcelasCartao").addEventListener("change", () => { atualizarTaxaCartao(); renderizarPagamento(); });
document.getElementById("taxaCartao").addEventListener("input", renderizarPagamento);
document.getElementById("blocoOS").addEventListener("input", () => {
  if (financeiroAprovado) {
    financeiroAprovado = false;
    document.getElementById("btnModoCheckout").disabled = true;
    const btn = document.getElementById("btnAprovarFinanceiro"); btn.textContent = "✅ Aprovar Orçamento e Liberar Checkout"; btn.style.background = "";
    atualizarEstadoEnvio();
  }
});

document.querySelectorAll('input[name="statusReparo"]').forEach(r => {
  r.addEventListener("change", () => {
    if (modoAtual === "tecnico" && r.checked && (r.value === "Aprovado" || r.value === "Reprovado")) {
      setTimeout(() => { if (modoAtual === "tecnico") alternarModo("os", true); }, 500);
    }
  });
});

const formAcesso = document.getElementById("formAcessoProtegido");
formAcesso.addEventListener("submit", e => {
  e.preventDefault();
  const senha = document.getElementById("senhaAbas"), erro = document.getElementById("erroSenhaAbas");
  if (senha.value !== SENHA_ABAS_PROTEGIDAS) { erro.classList.remove("hidden"); senha.select(); return; }
  const m = modoProtegidoPendente;
  modoProtegidoPendente = null; formAcesso.reset();
  document.getElementById("dialogAcessoProtegido").close(); erro.classList.add("hidden");
  if (m) alternarModo(m, true);
  if (ultimoFocoAntesDialog?.focus) try { ultimoFocoAntesDialog.focus(); } catch {}
  ultimoFocoAntesDialog = null;
});
document.getElementById("cancelarSenha").addEventListener("click", () => {
  modoProtegidoPendente = null; formAcesso.reset();
  document.getElementById("dialogAcessoProtegido").close(); document.getElementById("erroSenhaAbas").classList.add("hidden");
  if (ultimoFocoAntesDialog?.focus) try { ultimoFocoAntesDialog.focus(); } catch {}
  ultimoFocoAntesDialog = null;
});

function alternarModo(modo, senhaOk) {
  if (["tecnico","os","checkout","historico"].includes(modo) && !abasProtegidasDesbloqueadas && !senhaOk) {
    ultimoFocoAntesDialog = document.activeElement; modoProtegidoPendente = modo;
    document.getElementById("senhaAbas").value = ""; document.getElementById("erroSenhaAbas").classList.add("hidden");
    document.getElementById("dialogAcessoProtegido").showModal(); document.getElementById("senhaAbas").focus();
    return;
  }
  if (senhaOk) abasProtegidasDesbloqueadas = true;
  if (modo === "cliente") abasProtegidasDesbloqueadas = false;
  modoAtual = modo;
  const botoes = { cliente:document.getElementById("btnModoCliente"), tecnico:document.getElementById("btnModoTecnico"), os:document.getElementById("btnModoOS"), checkout:document.getElementById("btnModoCheckout"), historico:document.getElementById("btnModoHistorico") };
  Object.values(botoes).forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected","false"); });
  if (botoes[modo]) { botoes[modo].classList.add("active"); botoes[modo].setAttribute("aria-selected","true"); }
  ["blocoDadosOS","blocoTriagem","blocoTermos"].forEach(id => document.getElementById(id).classList.toggle("hidden", modo !== "cliente"));
  document.getElementById("blocoTecnico").classList.toggle("hidden", modo !== "tecnico");
  document.getElementById("blocoOS").classList.toggle("hidden", modo !== "os");
  document.getElementById("blocoCheckout").classList.toggle("hidden", modo !== "checkout");
  document.getElementById("blocoHistorico").classList.toggle("hidden", modo !== "historico");
  const sE = document.getElementById("servicoEntrega").value === "Sim";
  document.getElementById("areaAgendamentoColeta").classList.toggle("hidden", !sE || modo !== "tecnico");
  atualizarResumoAgendamento(); atualizarCamposAgendamento();
  if (modo === "tecnico") {
    const m = document.getElementById("marca").value.trim() || "—";
    const mo = document.getElementById("modelo").value.trim() || "—";
    const cor = document.getElementById("cor").value.trim();
    const def = document.getElementById("defeito").value.trim() || "—";
    const cont = document.getElementById("tituloAparelhoConteudo"); cont.replaceChildren();
    const l1 = document.createElement("div"); l1.style.cssText = "margin-top:4px;color:#fff;font-weight:700;"; l1.textContent = `${m} ${mo}${cor ? ` (${cor})` : ""}`;
    const l2 = document.createElement("div"); l2.style.cssText = "margin-top:6px;font-size:0.82rem;color:#d1d5db;";
    const s = document.createElement("strong"); s.textContent = "Defeito: "; l2.appendChild(s); l2.appendChild(document.createTextNode(def)); cont.append(l1, l2);
  }
  if (modo === "historico") renderizarHistorico();
  atualizarCamposPagamento(); atualizarStatusReparo(); atualizarCamposComodato(); atualizarEstadoEnvio();
  if (modo !== "cliente" && modo !== "historico") irParaPrimeiraPendencia();
}

function addPonto(num, btn) {
  if (!sequenciaPadrao.includes(num)) {
    sequenciaPadrao.push(num);
    btn.classList.add("selected");
    document.getElementById("senha").value = "Padrão: " + sequenciaPadrao.join(" -> ");
  }
}
function limparPadrao() {
  sequenciaPadrao = [];
  document.querySelectorAll(".dot-btn").forEach(b => b.classList.remove("selected"));
  document.getElementById("senha").value = "";
}
function marcarTodosOK(prefixo) {
  itensHardware.forEach((item, idx) => {
    const grp = document.getElementById("grp_" + prefixo + "_" + idx);
    if (!grp) return;
    const val = item === "Botão Assistente" ? "Não Testado" : "OK";
    const alvo = grp.querySelector(`input[value="${val}"]`);
    if (alvo) alvo.checked = true;
  });
  renderizarDiagnostico();
}
function marcarTodosNaoTestados(prefixo) {
  itensHardware.forEach((item, idx) => {
    if (["Aro","Tampa","Lentes da câmera"].includes(item)) return;
    const grp = document.getElementById("grp_" + prefixo + "_" + idx); if (!grp) return;
    const alvo = grp.querySelector('input[value="Não Testado"]'); if (alvo) alvo.checked = true;
  });
  renderizarDiagnostico();
}
function abrirWhatsApp(url) {
  const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.style.display = "none";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function obterFotosEtapaAtual() {
  const ids = modoAtual === "tecnico" ? fotosEntradaIds : fotosSaidaIds;
  const arr = [];
  ids.forEach(id => { const inp = document.getElementById(id); if (inp?.files) Array.from(inp.files).forEach(f => arr.push(f)); });
  if (modoAtual === "tecnico" && radioValor("comodato").startsWith("Sim") && radioValor("disponibilidadeComodato") === "Sim") {
    ["comodatoFotoFrente","comodatoFotoVerso","comodatoFotoIMEI"].forEach(id => {
      const inp = document.getElementById(id);
      if (inp?.files) Array.from(inp.files).forEach(f => arr.push(f));
    });
  }
  return arr;
}

// ================= COMPRESSÃO DE URL =================
const utf8ToB64Url = str => {
  const b = new TextEncoder().encode(str); let bin = "";
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const b64UrlToUtf8 = b => {
  let s = b.replace(/-/g,"+").replace(/_/g,"/"); while (s.length % 4) s += "=";
  const bin = atob(s), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(arr);
};
function comprimirPayload(json) {
  if (typeof LZString !== "undefined" && LZString.compressToEncodedURIComponent) {
    try { return "L" + LZString.compressToEncodedURIComponent(json); } catch {}
  }
  return "B" + utf8ToB64Url(json);
}
function descomprimirPayload(enc) {
  if (!enc) throw new Error("vazio");
  const flag = enc[0], corpo = enc.slice(1);
  if (flag === "L") {
    if (typeof LZString === "undefined") throw new Error("LZString");
    const r = LZString.decompressFromEncodedURIComponent(corpo); if (!r) throw new Error("vazio"); return r;
  }
  return b64UrlToUtf8(corpo);
}
function gerarLinkCheckin(modo) {
  const dados = {
    cliente: document.getElementById("cliente").value, cpf: document.getElementById("cpf").value,
    telefone: document.getElementById("telefone").value, telefoneAdicional: document.getElementById("telefoneAdicional").value,
    marca: document.getElementById("marca").value, modelo: document.getElementById("modelo").value,
    cor: document.getElementById("cor").value, tipo: document.getElementById("tipo").value,
    possuiAcessorios: document.getElementById("possuiAcessorios").value, acessorios: document.getElementById("acessorios").value,
    servicoEntrega: document.getElementById("servicoEntrega").value, enderecoEntrega: document.getElementById("enderecoEntrega").value,
    pontoReferencia: document.getElementById("pontoReferencia").value, linkLocalizacao: document.getElementById("linkLocalizacao").value,
    dataHoraRetirada: document.getElementById("dataHoraRetirada").value, defeito: document.getElementById("defeito").value,
    observacao: document.getElementById("observacao").value, triagem: {}
  };
  itensTriagem.forEach(i => dados.triagem[i.id] = radioValor(i.id));
  const enc = comprimirPayload(JSON.stringify(dados));
  const m = modo ? `&m=${modo}` : ""; return `${URL_BASE_OFICIAL}?d=${encodeURIComponent(enc)}${m}`;
}
function carregarDadosDaURL() {
  const p = new URLSearchParams(window.location.search);
  const d = p.get("d"), m = p.get("m"); if (!d) return false;
  try {
    const dados = JSON.parse(descomprimirPayload(d));
    ["cliente","cpf","telefone","telefoneAdicional","marca","modelo","cor","tipo","senha","defeito","observacao","enderecoEntrega","pontoReferencia","linkLocalizacao","dataHoraRetirada"].forEach(id => {
      if (dados[id] != null) { const el = document.getElementById(id); if (el) el.value = dados[id]; }
    });
    if (dados.possuiAcessorios) { document.getElementById("possuiAcessorios").value = dados.possuiAcessorios; atualizarCampoAcessorios(); if (dados.acessorios) document.getElementById("acessorios").value = dados.acessorios; }
    if (dados.servicoEntrega) { document.getElementById("servicoEntrega").value = dados.servicoEntrega; atualizarCamposEntrega(); }
    if (dados.triagem) itensTriagem.forEach(item => {
      const v = dados.triagem[item.id]; if (!v || v === "Não informado") return;
      const inp = document.querySelector(`input[name="${item.id}"][value="${CSS.escape(v)}"]`); if (inp) inp.checked = true;
    });
    abasProtegidasDesbloqueadas = true;
    setTimeout(() => { alternarModo(m === "os" ? "os" : "tecnico", true); setTimeout(irParaPrimeiraPendencia, 100); }, 80);
    return true;
  } catch (e) { console.error(e); setTimeout(() => mostrarAlerta("Link inválido.", "Erro"), 200); return false; }
}
// ================= FOTOS E UPLOAD =================
function configurarPreviewsFotos() {
  document.querySelectorAll('input[type="file"][accept*="image"]').forEach(inp => {
    if (inp.dataset.previewReady) return;
    inp.dataset.previewReady = "1";
    inp.addEventListener("change", () => {
      const cont = inp.parentElement;
      let prev = cont.querySelector(".foto-preview");
      if (!prev) { prev = document.createElement("div"); prev.className = "foto-preview"; cont.appendChild(prev); }
      prev.replaceChildren();
      if (inp.files?.[0]) {
        const u = URL.createObjectURL(inp.files[0]);
        const img = document.createElement("img"); img.src = u;
        img.onload = () => URL.revokeObjectURL(u); img.onerror = () => URL.revokeObjectURL(u);
        prev.appendChild(img);
      }
    });
  });
}
function comprimirImagem(file, maxDim = 1600, q = 0.82) {
  return new Promise(resolve => {
    try {
      const r = new FileReader();
      r.onload = ev => {
        const img = new Image();
        img.onload = () => {
          try {
            let w = img.naturalWidth, h = img.naturalHeight;
            if (w > maxDim || h > maxDim) { const ratio = Math.min(maxDim / w, maxDim / h); w = Math.round(w * ratio); h = Math.round(h * ratio); }
            const c = document.createElement("canvas"); c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            c.toBlob(blob => blob ? resolve(new File([blob], (file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" })) : resolve(file), "image/jpeg", q);
          } catch { resolve(file); }
        };
        img.onerror = () => resolve(file); img.src = ev.target.result;
      };
      r.onerror = () => resolve(file); r.readAsDataURL(file);
    } catch { resolve(file); }
  });
}
async function uploadFotoTemporaria(file) {
  try { const fd = new FormData(); fd.append("reqtype","fileupload"); fd.append("fileToUpload",file); const r = await fetch("https://catbox.moe/user/api.php",{method:"POST",body:fd}); if (r.ok) { const t = (await r.text()).trim(); if (t.startsWith("http")) return t; } } catch {}
  try { const fd = new FormData(); fd.append("file",file); const r = await fetch("https://tmpfiles.org/api/v1/upload",{method:"POST",body:fd}); if (r.ok) { const j = await r.json(); const u = j?.data?.url; if (u) return u.replace("tmpfiles.org/","tmpfiles.org/dl/"); } } catch {}
  try { const fd = new FormData(); fd.append("file",file); const r = await fetch("https://0x0.st",{method:"POST",body:fd}); if (r.ok) { const t = (await r.text()).trim(); if (t.startsWith("http")) return t; } } catch {}
  return null;
}
function mostrarFotosParaDownload(arquivos, waUrl) {
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;";
  const box = document.createElement("div");
  box.style.cssText = "background:#1e1e1e;border:1px solid #374151;color:#e5e7eb;padding:20px;border-radius:12px;max-width:500px;width:100%;max-height:90vh;overflow:auto;";
  const urls = [];
  let html = `<h2 style="margin-top:0;font-size:1.1rem;color:#fff;">Fotos prontas</h2><p style="font-size:0.88rem;color:#9ca3af;">Baixe e anexe no WhatsApp.</p>`;
  arquivos.forEach((f, i) => {
    const u = URL.createObjectURL(f); urls.push(u);
    html += `<div style="margin-bottom:12px;"><img src="${u}" style="max-width:100%;border-radius:6px;display:block;margin-bottom:6px;"><a href="${u}" download="f5tec_foto_${i+1}.jpg" style="display:inline-block;padding:8px 14px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">Baixar Foto ${i+1}</a></div>`;
  });
  html += `<a href="${waUrl}" target="_blank" rel="noopener" style="display:block;margin-top:12px;padding:12px;background:#22c55e;color:#fff;text-align:center;text-decoration:none;border-radius:6px;font-weight:700;">Abrir WhatsApp</a><button type="button" id="fecharModalFotos" style="display:block;margin-top:8px;width:100%;padding:10px;background:#374151;color:#e5e7eb;border:none;border-radius:6px;cursor:pointer;font-weight:600;">Fechar</button>`;
  box.innerHTML = html; modal.appendChild(box); document.body.appendChild(modal);
  document.getElementById("fecharModalFotos").onclick = () => { document.body.removeChild(modal); urls.forEach(u => URL.revokeObjectURL(u)); };
}
async function enviarMensagemComFotos(numero, textoBase, arquivos) {
  const waUrl = `https://wa.me/${numero}?text=${encodeURIComponent(textoBase)}`;
  if (!arquivos.length) { abrirWhatsApp(waUrl); return; }
  const comps = []; for (const f of arquivos) comps.push(await comprimirImagem(f));
  if (navigator.share) { try { await navigator.share({ files: comps, text: textoBase }); return; } catch (e) { if (e?.name === "AbortError") return; } }
  let urls = [];
  try {
    const r = await Promise.all(comps.map(f => Promise.race([uploadFotoTemporaria(f), new Promise(res => setTimeout(() => res(null), 7000))])));
    urls = r.filter(u => u);
  } catch {}
  let final = textoBase;
  if (urls.length) { final += "\n\nFotos da inspeção:"; urls.forEach((u, i) => final += `\nFoto ${i+1}:${u}`); }
  abrirWhatsApp(`https://wa.me/${numero}?text=${encodeURIComponent(final)}`);
  if (!urls.length) setTimeout(() => mostrarFotosParaDownload(comps, waUrl), 400);
}

// ================= HISTÓRICO =================
const getHistorico = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } };
const setHistorico = h => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)); } catch { mostrarAlerta("Não foi possível salvar.", "Erro"); } };
function gerarNumeroOS() {
  const h = getHistorico(), ano = new Date().getFullYear();
  const nums = h.filter(o => o.numero?.startsWith(ano + "-")).map(o => parseInt(o.numero.split("-")[1]) || 0);
  return `${ano}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0")}`;
}
function coletarDadosOS() {
  const d = obterDadosPagamento(), diag = gerarRelatorioDiagnostico("hw_"), diagOut = gerarRelatorioDiagnostico("out_");
  return {
    cliente: { nome: document.getElementById("cliente").value.trim(), cpf: document.getElementById("cpf").value.trim(), telefone: document.getElementById("telefone").value.trim(), telefoneAdicional: document.getElementById("telefoneAdicional").value.trim() },
    aparelho: {
      marca: document.getElementById("marca").value.trim(), modelo: document.getElementById("modelo").value.trim(),
      cor: document.getElementById("cor").value.trim(), tipo: document.getElementById("tipo").value,
      senha: document.getElementById("senha").value, defeito: document.getElementById("defeito").value.trim(),
      observacao: document.getElementById("observacao").value.trim(),
      possuiAcessorios: document.getElementById("possuiAcessorios").value, acessorios: document.getElementById("acessorios").value.trim()
    },
    entrega: {
      servico: document.getElementById("servicoEntrega").value, endereco: document.getElementById("enderecoEntrega").value.trim(),
      referencia: document.getElementById("pontoReferencia").value.trim(), link: document.getElementById("linkLocalizacao").value.trim(),
      dataHora: document.getElementById("dataHoraRetirada").value.trim(),
      agendamentoConfirmado: radioValor("confirmacaoAgendamento"),
      dataHoraColetaTecnico: document.getElementById("dataHoraColetaTecnico").value.trim()
    },
    triagem: itensTriagem.reduce((a, i) => { a[i.id] = radioValor(i.id); return a; }, {}),
    diagnostico: { statusReparo: radioValor("statusReparo"), defeitos: diag.defeitos, naoTestados: diag.naoTestados, ok: diag.ok.length },
    diagnosticoSaida: { defeitos: diagOut.defeitos, naoTestados: diagOut.naoTestados, ok: diagOut.ok.length },
    comodato: {
      solicitado: radioValor("comodato").startsWith("Sim"),
      disponivel: radioValor("disponibilidadeComodato") === "Sim",
      marca: document.getElementById("comodatoMarca").value.trim(),
      modelo: document.getElementById("comodatoModelo").value.trim(),
      cor: document.getElementById("comodatoCor").value.trim(),
      observacao: document.getElementById("comodatoObservacao").value.trim(),
      recolhido: document.getElementById("chkComodatoRecolhido").checked
    },
    registros: registrosOS.map(r => ({ ...r })),
    pagamento: { forma: d.forma, parcelas: d.parcelas, taxa: d.taxa, acrescimo: d.acrescimo, total: d.totalFinal, precisaTroco: d.precisaTroco, valorTroco: d.valorTroco },
    checkout: { tipoEntregaFinal: document.getElementById("tipoEntregaFinal").value, enderecoEntregaFinal: document.getElementById("enderecoEntregaFinal").value.trim(), dataHoraAgendamento: document.getElementById("dataHoraAgendamento").value.trim() }
  };
}
function salvarOS(status) {
  const h = getHistorico(), dados = coletarDadosOS();
  dados.atualizadoEm = new Date().toISOString(); dados.status = status;
  if (osSessaoNumero) {
    const idx = h.findIndex(o => o.numero === osSessaoNumero);
    if (idx >= 0) { dados.numero = osSessaoNumero; dados.criadoEm = h[idx].criadoEm; h[idx] = dados; setHistorico(h); return osSessaoNumero; }
  }
  dados.numero = gerarNumeroOS(); dados.criadoEm = new Date().toISOString(); osSessaoNumero = dados.numero;
  h.push(dados); setHistorico(h); return dados.numero;
}
function renderizarFiltroStatus() {
  const cont = document.getElementById("filtroStatus"); cont.replaceChildren();
  ["Todos", ...STATUS_OS.map(s => s.key)].forEach(op => {
    const b = document.createElement("button"); b.type = "button";
    b.className = "filtro-btn" + (filtroHistoricoAtual === op ? " active" : "");
    b.textContent = op; b.onclick = () => { filtroHistoricoAtual = op; renderizarHistorico(); };
    cont.appendChild(b);
  });
}
function renderizarHistorico() {
  renderizarFiltroStatus();
  const cont = document.getElementById("listaHistorico"); cont.replaceChildren();
  const h = getHistorico().sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  const fs = filtroHistoricoAtual === "Todos" ? h : h.filter(o => o.status === filtroHistoricoAtual);
  if (!fs.length) { const d = document.createElement("div"); d.className = "historico-vazio"; d.textContent = "Nenhuma OS neste filtro."; cont.appendChild(d); return; }
  fs.forEach(os => cont.appendChild(criarCardOS(os)));
}
function criarCardOS(os) {
  const c = os.cliente || {}, a = os.aparelho || {}, p = os.pagamento || {}, d = os.diagnostico || {}, co = os.comodato || {}, regs = os.registros || [];
  const card = document.createElement("div"); card.className = "os-card";
  const header = document.createElement("div"); header.className = "os-card-header";
  const nb = document.createElement("div");
  nb.innerHTML = `<div class="os-card-numero">OS ${os.numero || "—"}</div><div class="os-card-data">Criada em ${fmtData(os.criadoEm)}</div>`;
  const st = STATUS_OS.find(s => s.key === os.status) || STATUS_OS[0];
  const badge = document.createElement("span"); badge.className = `os-status-badge status-${st.badge}`; badge.textContent = os.status || st.key;
  header.append(nb, badge); card.appendChild(header);
  const body = document.createElement("div"); body.className = "os-card-body";
  const total = p.total || regs.reduce((t, r) => t + r.quantidade * r.valor, 0);
  body.innerHTML = `<strong>${c.nome || "—"}</strong><br>${a.marca || ""} ${a.modelo || ""}<br>${regs.length ? `<span style="color:#d1d5db;">Total: ${fmtMoeda(total)}</span>` : ""}`;
  card.appendChild(body);
  const detBtn = document.createElement("button"); detBtn.type = "button"; detBtn.className = "btn-detalhes"; detBtn.textContent = "▼ Ver detalhes";
  const det = document.createElement("div"); det.className = "detalhes-os";
  det.innerHTML = `
    <div><strong>CPF:</strong> ${c.cpf || "—"}</div>
    <div><strong>Telefone:</strong> ${c.telefone || "—"}</div>
    <div><strong>Defeito:</strong> ${a.defeito || "—"}</div>
    <div><strong>Diagnóstico:</strong> ${d.statusReparo || "—"} · Defeitos: ${(d.defeitos || []).length} · Não testados: ${(d.naoTestados || []).length}</div>
    <div><strong>Pagamento:</strong> ${p.forma || "—"} · Total: ${fmtMoeda(total)}</div>${co.solicitado ? `<div><strong>Comodato:</strong> ${co.disponivel ? "Sim" : "Sem disp."}${co.recolhido ? " (recolhido)" : ""}</div>` : ""}
  `;
  detBtn.onclick = () => { det.classList.toggle("aberto"); detBtn.textContent = det.classList.contains("aberto") ? "▲ Ocultar" : "▼ Ver detalhes"; };
  card.append(detBtn, det);
  const sel = document.createElement("select"); sel.className = "status-select";
  STATUS_OS.forEach(s => { const o = document.createElement("option"); o.value = s.key; o.textContent = s.key; if (s.key === os.status) o.selected = true; sel.appendChild(o); });
  sel.onchange = () => alterarStatusOS(os.numero, sel.value); card.appendChild(sel);
  const actions = document.createElement("div"); actions.className = "os-card-actions";
  const be = document.createElement("button"); be.className = "btn-os-edit"; be.textContent = "✏️ Editar"; be.onclick = () => carregarOSNoFormulario(os.numero); actions.appendChild(be);
  const bp = document.createElement("button"); bp.className = "btn-os-pdf"; bp.textContent = "📄 PDF"; bp.disabled = os.status !== "Concluído"; bp.title = bp.disabled ? "Apenas OS concluídas" : "Gerar PDF"; bp.onclick = () => abrirMenuPDF(os.numero); actions.appendChild(bp);
  const bd = document.createElement("button"); bd.className = "btn-os-delete"; bd.textContent = "🗑️ Excluir"; bd.onclick = () => excluirOS(os.numero); actions.appendChild(bd);
  card.appendChild(actions);
  return card;
}

// ================= MENSAGENS WHATSAPP =================
function secaoCliente() {
  return `*1. CLIENTE*\n- Nome: *${document.getElementById("cliente").value || "—"}*\n- CPF: *${document.getElementById("cpf").value || "—"}*\n- Telefone: *${document.getElementById("telefone").value || "—"}*${document.getElementById("telefoneAdicional").value ? `\n- Tel. adicional: *${document.getElementById("telefoneAdicional").value}*` : ""}`;
}
function secaoAparelho() {
  const acc = document.getElementById("possuiAcessorios").value;
  const accessories = acc === "Sim" && document.getElementById("acessorios").value
    ? " - " + document.getElementById("acessorios").value
    : "";
  const observation = document.getElementById("observacao").value;
  return `*2. APARELHO*\n- Modelo: *${document.getElementById("marca").value} ${document.getElementById("modelo").value} (${document.getElementById("cor").value})*\n- Tipo: *${document.getElementById("tipo").value}*\n- Acessórios: *${acc}*${accessories}\n- Defeito: *${document.getElementById("defeito").value || "—"}*${observation ? `\n- Obs: *${observation}*` : ""}`;
}
function secaoTriagem() {
  return "*3. TRIAGEM INICIAL*\n" + itensTriagem.map(i => `- ${i.label} *${radioValor(i.id)}*`).join("\n");
}
function secaoColetaCliente() {
  if (document.getElementById("servicoEntrega").value !== "Sim") return "";
  const linhas = [
    "*4. COLETA / ENTREGA*",
    `- Endereço: *${document.getElementById("enderecoEntrega").value || "—"}*`
  ];
  const referencia = document.getElementById("pontoReferencia").value.trim();
  const mapa = document.getElementById("linkLocalizacao").value.trim();
  const dataHora = formatarDataHoraLocal(document.getElementById("dataHoraRetirada").value.trim());
  if (referencia) linhas.push(`- Referência: *${referencia}*`);
  if (mapa) linhas.push(`- Link do Maps: ${mapa}`);
  linhas.push(`- Preferência de data/hora: *${dataHora || "—"}*`);
  return linhas.join("\n");
}
function secaoLaudoCompleto(prefixo, tipo, numeroOS) {
  const d = gerarRelatorioDiagnostico(prefixo);
  const marca = document.getElementById("marca").value.trim();
  const modelo = document.getElementById("modelo").value.trim();
  const cor = document.getElementById("cor").value.trim();
  const defeito = document.getElementById("defeito").value.trim();
  const arrumar = document.getElementById("solucaoCustom")?.value?.trim() ||
    (registrosOS.filter(r => r.categoria === "Serviço").map(r => r.descricao).join(", ")) || "";
  const total = d.ok.length + d.defeitos.length + d.naoTestados.length;

  let r = tipo === "saida" ? "*LAUDO TÉCNICO DE ENTREGA — F5TEC*\n" : "*LAUDO TÉCNICO DE DIAGNÓSTICO — F5TEC*\n";
  r += "─────────────────────────────\n\n";
  r += `*Aparelho:* *${marca} ${modelo}${cor ? ` (${cor})` : ""}*\n`;
  r += `*OS / Protocolo:* *${numeroOS || "—"}*\n`;
  r += `*Reclamação:* *${defeito || "—"}*\n\n`;
  r += `Após abertura técnica e testes de bancada, identificamos o seguinte quadro no seu aparelho:\n\n`;

  if (tipo === "saida" && arrumar) {
    r += `*SERVIÇOS REALIZADOS*\n`;
    registrosOS.filter(x => x.categoria === "Serviço").forEach(x => r += `• *${x.descricao}*\n`);
    r += "\n";
    if (d.defeitos.length) {
      r += `*DIAGNÓSTICO CONSTATADO*\n`;
      d.defeitos.forEach(x => r += `• *${x}*\n`);
      r += "\n";
    }
  } else {
    r += `*DIAGNÓSTICO CONSTATADO*\n`;
    if (d.defeitos.length) {
      d.defeitos.forEach(x => r += `• *${x}*\n`);
    } else {
      r += `• *Nenhum defeito funcional identificado nos itens testados.*\n`;
    }
    if (d.naoTestados.length) {
      r += `\n*ITENS NÃO TESTADOS*\n`;
      d.naoTestados.forEach(x => r += `• *${x}*\n`);
    }
    r += `\n*SOLUÇÃO RECOMENDADA*\n`;
    r += `• *${arrumar || "A definir conforme aprovação do orçamento."}*\n`;
  }

  r += `\n*RESUMO DO CHECKLIST*\n`;
  r += `- Itens avaliados: *${total}*\n`;
  r += `- Aprovados: *${d.ok.length}*\n`;
  r += `- Defeitos: *${d.defeitos.length}*\n`;
  r += `- Não testados: *${d.naoTestados.length}*\n\n`;

  if (tipo === "diagnostico") {
    r += "*PRÓXIMOS PASSOS*\n";
    r += "1️⃣ Quais itens você deseja *arrumar*? (apenas os com defeito, ou algum outro serviço?)\n";
    r += "2️⃣ Qual sua *forma de pagamento*? (Dinheiro, PIX ou Cartão de Crédito)\n\n";
    r += "Assim que responder, montamos o orçamento completo para sua aprovação.\n";
    r += "_Ao aprovar o orçamento você concorda com os Termos de Serviço e Garantia da F5TEC._";
  } else {
    r += "Aparelho liberado para entrega após conferência dos itens acima.";
  }
  return r;
}
function secaoAgendamento() {
  if (document.getElementById("servicoEntrega").value !== "Sim") return "";
  const conf = radioValor("confirmacaoAgendamento"), novo = document.getElementById("dataHoraColetaTecnico").value.trim();
  let r = "*COLETA / ENTREGA*\n";
  r += `- Endereço: *${document.getElementById("enderecoEntrega").value || "—"}*\n`;
  if (document.getElementById("pontoReferencia").value) r += `- Referência: *${document.getElementById("pontoReferencia").value}*\n`;
  if (document.getElementById("linkLocalizacao").value) r += `- Localização: ${document.getElementById("linkLocalizacao").value}\n`;
  r += `- Preferência do cliente: *${formatarDataHoraLocal(document.getElementById("dataHoraRetirada").value.trim()) || "—"}*\n`;
  r += `- Confirmação: *${conf}*`;
  if (conf === "Não" && novo) r += ` (sugerido: *${novo}*)`;
  return r;
}
function secaoComodato() {
  if (!radioValor("comodato").startsWith("Sim")) return "";
  const disp = radioValor("disponibilidadeComodato");
  let r = "*APARELHO RESERVA (COMODATO)*\n- Disponibilidade: *" + (disp || "—") + "*";
  if (disp === "Sim") {
    const cor = document.getElementById("comodatoCor").value;
    r += `\n- Aparelho: *${document.getElementById("comodatoMarca").value} ${document.getElementById("comodatoModelo").value}${cor ? ` (${cor})` : ""}*`;
    if (document.getElementById("comodatoObservacao").value) r += `\n- Estado: *${document.getElementById("comodatoObservacao").value}*`;
    r += `\n- Fotos do comodato anexadas acima.`;
  }
  return r;
}
function gerarMensagemCheckin(link) {
  const partes = ["*F5TEC — CHECK-IN*", secaoCliente(), secaoAparelho(), secaoTriagem(), secaoColetaCliente()];
  if (document.getElementById("aceiteTermos").checked) partes.push("*Termos de serviço:* Aceitos");
  if (link) partes.push(`*LINK PARA O TÉCNICO CONTINUAR:*\n${link}`);
  return partes.filter(Boolean).join("\n\n");
}
function gerarMensagemTecnico(numeroOS) {
  const partes = ["*F5TEC — DIAGNÓSTICO TÉCNICO*", secaoAparelho(), secaoLaudoCompleto("hw_", "diagnostico", numeroOS)];
  const ag = secaoAgendamento(); if (ag) partes.push(ag);
  const co = secaoComodato(); if (co) partes.push(co);
  return partes.filter(Boolean).join("\n\n");
}
function gerarMensagemOrcamento(numeroOS) {
  const partes = ["*F5TEC — ORÇAMENTO*", secaoCliente(), secaoAparelho(), secaoLaudoCompleto("hw_", "diagnostico", numeroOS), gerarResumoRegistrosOS(), gerarResumoPagamento(), TERMOS_WHATSAPP];
  const ag = secaoAgendamento(); if (ag) partes.push(ag);
  return partes.filter(Boolean).join("\n\n");
}
function gerarMensagemCheckout(numeroOS) {
  const partes = ["*F5TEC — CHECKOUT*", secaoCliente(), secaoAparelho(), secaoLaudoCompleto("out_", "saida", numeroOS), gerarResumoRegistrosOS(), gerarResumoPagamento()];
  const tipo = document.getElementById("tipoEntregaFinal").value;
  if (tipo) {
    let e = `*ENTREGA FINAL*\n- Modalidade: *${tipo}*`;
    if (tipo === "Tele-busca e Entrega") {
      e += `\n- Endereço: *${document.getElementById("enderecoEntregaFinal").value || "—"}*`;
      e += `\n- Data/hora: *${document.getElementById("dataHoraAgendamento").value || "—"}*`;
    }
    partes.push(e);
  }
  if (radioValor("comodato").startsWith("Sim") && radioValor("disponibilidadeComodato") === "Sim") {
    partes.push(`Aparelho reserva recolhido: *${document.getElementById("chkComodatoRecolhido").checked ? "Sim" : "Não"}*`);
  }
  return partes.filter(Boolean).join("\n\n");
}

// ================= GERAÇÃO DE PDF =================
async function gerarPDFA4(numero, dadosCustom) {
  const os = dadosCustom || getHistorico().find(o => o.numero === numero);
  if (!os) { await mostrarAlerta("OS não encontrada.", "Erro"); return; }
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { await mostrarAlerta("PDF não carregado.", "Erro"); return; }
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - 28;
  let y = 15;
  doc.setFontSize(14); doc.setFont("helvetica","bold");
  doc.text("F5Tec Assistência Técnica", pageW / 2, y, { align: "center" }); y += 6;
  doc.setFontSize(9); doc.setFont("helvetica","normal");
  doc.text("CPF/CNPJ: 023.349.620-31 · Contato: (51) 9737-1944", pageW / 2, y, { align: "center" }); y += 4;
  doc.text("Arroio Seco - CEP 95585-000 - Arroio do Sal", pageW / 2, y, { align: "center" }); y += 6;
  doc.setDrawColor(0,0,0); doc.line(14, y, pageW - 14, y); y += 6;
  doc.setFontSize(16); doc.setFont("helvetica","bold");
  doc.text("Ordem de Serviço", pageW / 2, y, { align: "center" }); y += 8;
  doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.text(`O.S. Nº: ${os.numero}`, 14, y);
  const dtStr = new Date(os.criadoEm).toLocaleDateString("pt-BR");
  doc.text(`Abertura: ${dtStr}`, pageW - 14, y, { align: "right" }); y += 5;
  const prev = new Date(new Date(os.criadoEm).getTime() + 90*24*60*60*1000);
  doc.text(`Garantia: ${prev.toLocaleDateString("pt-BR")}`, pageW - 14, y, { align: "right" }); y += 8;
  const secao = t => { doc.setFillColor(235,235,235); doc.rect(14, y - 4, maxW, 7, "F"); doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.text(t, 16, y + 1); y += 8; };
  const campo = (label, valor) => {
    doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.text(label + ":", 16, y);
    doc.setFont("helvetica","normal");
    const lines = doc.splitTextToSize(String(valor || "—"), maxW - 35);
    doc.text(lines, 45, y); y += Math.max(1, lines.length) * 5;
  };
  secao("DADOS DO CLIENTE");
  campo("Nome", os.cliente.nome);
  campo("Endereço", os.entrega.endereco || "Não informado");
  campo("Telefone", os.cliente.telefone);
  y += 3;
  secao("INFORMAÇÕES DO PRODUTO");
  campo("Tipo", os.aparelho.tipo);
  campo("Marca", os.aparelho.marca);
  campo("Modelo", os.aparelho.modelo);
  campo("Cor", os.aparelho.cor);
  y += 3;
  secao("DIAGNÓSTICO E SERVIÇO");
  campo("Reclamação", os.aparelho.defeito);
  const solucao = os.diagnostico?.solucaoCustom || (os.registros || []).filter(r => r.categoria === "Serviço").map(r => r.descricao).join(", ") || "A definir";
  campo("Itens arrumados", solucao);
  y += 3;
  secao("GARANTIA");
  campo("Garantia até", prev.toLocaleDateString("pt-BR") + " (90 dias)");
  y += 3;
  secao("VALORES");
  const servicos = (os.registros || []).filter(r => r.categoria === "Serviço");
  const pecas = (os.registros || []).filter(r => r.categoria === "Peça");
  doc.setFont("helvetica","bold"); doc.text("Serviços:", 16, y); y += 5;
  doc.setFont("helvetica","normal");
  servicos.forEach(s => campo("-", `${s.descricao} - ${fmtMoeda(s.quantidade * s.valor)}`));
  const totServ = servicos.reduce((t, s) => t + s.quantidade * s.valor, 0);
  doc.setFont("helvetica","bold"); doc.text(`Valor serviços: ${fmtMoeda(totServ)}`, 16, y); y += 7;
  doc.text("Peças/Produtos:", 16, y); y += 5;
  doc.setFont("helvetica","normal");
  pecas.forEach(p => campo("-", `${p.quantidade} - ${p.descricao} - ${fmtMoeda(p.valor)}`));
  const totPec = pecas.reduce((t, p) => t + p.quantidade * p.valor, 0);
  doc.setFont("helvetica","bold"); doc.text(`Valor peças/produtos: ${fmtMoeda(totPec)}`, 16, y); y += 7;
  doc.setFontSize(12); doc.text(`Valor Final: ${fmtMoeda(os.pagamento.total || (totServ + totPec))}`, 16, y); y += 6;
  doc.setFontSize(10); doc.setFont("helvetica","normal");
  doc.text(`Condição de pagamento: ${os.pagamento.forma || "Não informada"}`, 16, y); y += 8;
  if (os.observacaoPDF) {
    doc.setFont("helvetica","italic");
    const lines = doc.splitTextToSize("Obs: " + os.observacaoPDF, maxW);
    doc.text(lines, 16, y); y += Math.max(1, lines.length) * 5;
  }
  y += 10;
  doc.line(14, y, 80, y); doc.line(pageW - 80, y, pageW - 14, y); y += 5;
  doc.setFont("helvetica","normal"); doc.setFontSize(9);
  doc.text("Assinatura do Cliente", 14, y);
  doc.text("F5Tec Assistência Técnica", pageW - 80, y);
  doc.save(`F5TEC_OS_${os.numero}_A4.pdf`);
}
async function gerarPDFTermico(numero, largura, dadosCustom) {
  const os = dadosCustom || getHistorico().find(o => o.numero === numero);
  if (!os) { await mostrarAlerta("OS não encontrada.", "Erro"); return; }
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) { await mostrarAlerta("PDF não carregado.", "Erro"); return; }
  const doc = new jsPDF({ unit:"mm", format:[largura, 300] });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 3, maxW = pageW - margin * 2;
  let y = 8;
  const txt = (text, size = 8, style = "normal", align) => {
    doc.setFontSize(size); doc.setFont("helvetica", style);
    doc.splitTextToSize(String(text || "—"), maxW).forEach(line => {
      doc.text(line, align === "center" ? pageW / 2 : margin, y, { align: align === "center" ? "center" : "left" });
      y += 4;
    });
  };
  txt("F5Tec Assistência Técnica", 10, "bold", "center");
  txt("CPF/CNPJ: 023.349.620-31", 7, "normal", "center");
  txt("Contato: (51) 9737-1944", 7, "normal", "center");
  y += 1; doc.line(margin, y, pageW - margin, y); y += 3;
  txt(`O.S. Nº: ${os.numero}`, 9, "bold");
  txt(`Data: ${new Date(os.criadoEm).toLocaleDateString("pt-BR")}`, 7);
  const prev = new Date(new Date(os.criadoEm).getTime() + 90*24*60*60*1000);
  txt(`Garantia: ${prev.toLocaleDateString("pt-BR")}`, 7);
  y += 1; doc.line(margin, y, pageW - margin, y); y += 3;
  txt("DADOS DO CLIENTE", 9, "bold");
  txt(`Nome: ${os.cliente.nome || "—"}`, 7);
  txt(`Tel: ${os.cliente.telefone || "—"}`, 7);
  if (os.entrega.endereco) txt(`End: ${os.entrega.endereco}`, 7);
  y += 1; doc.line(margin, y, pageW - margin, y); y += 3;
  txt("PRODUTO", 9, "bold");
  txt(`${os.aparelho.marca || "—"} ${os.aparelho.modelo || ""}`, 7);
  txt(`Cor: ${os.aparelho.cor || "—"}`, 7);
  y += 1; doc.line(margin, y, pageW - margin, y); y += 3;
  txt("DIAGNOSTICO", 9, "bold");
  txt(`Reclamacao: ${os.aparelho.defeito || "—"}`, 7);
  const defeitos = os.diagnostico?.defeitos || [];
  txt(`Defeitos encontrados: ${defeitos.length ? "" : "Nenhum"}`, 7);
  if (defeitos.length) defeitos.forEach(x => txt(`- ${x}`, 7));
  const arrumados = os.diagnostico?.solucaoCustom || (os.registros || []).filter(r => r.categoria === "Serviço").map(r => r.descricao).join(", ") || "A definir";
  txt(`Itens arrumados: ${arrumados}`, 7);
  y += 1; doc.line(margin, y, pageW - margin, y); y += 3;
  txt("VALORES", 9, "bold");
  (os.registros || []).forEach(r => txt(`- ${r.descricao}: ${fmtMoeda(r.quantidade * r.valor)}`, 7));
  txt(`TOTAL: ${fmtMoeda(os.pagamento.total || 0)}`, 10, "bold");
  txt(`Pgto: ${os.pagamento.forma || "—"}`, 7);
  if (os.observacaoPDF) { y += 1; doc.line(margin, y, pageW - margin, y); y += 3; txt("OBS: " + os.observacaoPDF, 7); }
  y += 3; doc.line(margin, y, pageW - margin, y); y += 3;
  txt("TERMOS", 9, "bold");
  txt("Garantia 90 dias (Art. 26 CDC) cobrindo peça/serviço. Perda em quedas, umidade, violação de lacre ou conserto por terceiros.", 6);
  y += 4;
  doc.line(margin, y, margin + 25, y); doc.line(pageW - margin - 25, y, pageW - margin, y); y += 3;
  txt("Cliente", 7); txt("F5Tec", 7);
  doc.save(`F5TEC_OS_${os.numero}_${largura}mm.pdf`);
}

async function abrirMenuPDF(numero) {
  const escolha = await mostrarOpcoesDialogo(
    `OS ${numero} concluída.\nComo deseja gerar o arquivo?`,
    "Imprimir OS",
    [
      { valor:"editar", label:"✏️ Editar antes", primario:true },
      { valor:"a4", label:"PDF A4" },
      { valor:"58mm", label:"Térmica 58mm" },
      { valor:"60mm", label:"Térmica 60mm" },
      { valor:"cancel", label:"Cancelar" }
    ]
  );
  if (escolha === "editar") abrirEditorPDF(numero);
  else if (escolha === "a4") await gerarPDFA4(numero);
  else if (escolha === "58mm") await gerarPDFTermico(numero, 58);
  else if (escolha === "60mm") await gerarPDFTermico(numero, 60);
}

function abrirEditorPDF(numero) {
  const os = getHistorico().find(o => o.numero === numero);
  if (!os) { mostrarAlerta("OS não encontrada."); return; }
  osEmEdicaoPDF = numero;
  document.getElementById("editTitulo").textContent = `Editar OS ${numero}`;
  document.getElementById("editCliente").value = os.cliente?.nome || "";
  document.getElementById("editCpf").value = os.cliente?.cpf || "";
  document.getElementById("editTelefone").value = os.cliente?.telefone || "";
  document.getElementById("editEndereco").value = os.entrega?.endereco || "";
  document.getElementById("editMarca").value = os.aparelho?.marca || "";
  document.getElementById("editModelo").value = os.aparelho?.modelo || "";
  document.getElementById("editCor").value = os.aparelho?.cor || "";
  document.getElementById("editTipo").value = os.aparelho?.tipo || "";
  document.getElementById("editDefeito").value = os.aparelho?.defeito || "";
  const solucao = os.diagnostico?.solucaoCustom || (os.registros || []).filter(r => r.categoria === "Serviço").map(r => r.descricao).join(", ");
  document.getElementById("editSolucao").value = solucao;
  document.getElementById("editObsPDF").value = os.observacaoPDF || "";
  document.getElementById("editFormaPagamento").value = os.pagamento?.forma || "";
  document.querySelectorAll('input[name="formatoPDF"]').forEach(r => r.checked = r.value === "a4");
  document.getElementById("dialogoEditarPDF").showModal();
}
function fecharEditorPDF() { document.getElementById("dialogoEditarPDF").close(); osEmEdicaoPDF = null; }
async function aplicarEdicaoPDF() {
  if (!osEmEdicaoPDF) return;
  const h = getHistorico(), idx = h.findIndex(o => o.numero === osEmEdicaoPDF);
  if (idx < 0) { await mostrarAlerta("OS não encontrada."); return; }
  const os = h[idx];
  os.cliente = os.cliente || {};
  os.cliente.nome = document.getElementById("editCliente").value.trim();
  os.cliente.cpf = document.getElementById("editCpf").value.trim();
  os.cliente.telefone = document.getElementById("editTelefone").value.trim();
  os.entrega = os.entrega || {};
  os.entrega.endereco = document.getElementById("editEndereco").value.trim();
  os.aparelho = os.aparelho || {};
  os.aparelho.marca = document.getElementById("editMarca").value.trim();
  os.aparelho.modelo = document.getElementById("editModelo").value.trim();
  os.aparelho.cor = document.getElementById("editCor").value.trim();
  os.aparelho.tipo = document.getElementById("editTipo").value.trim();
  os.aparelho.defeito = document.getElementById("editDefeito").value.trim();
  os.diagnostico = os.diagnostico || {};
  os.diagnostico.solucaoCustom = document.getElementById("editSolucao").value.trim();
  os.observacaoPDF = document.getElementById("editObsPDF").value.trim();
  os.pagamento = os.pagamento || {};
  os.pagamento.forma = document.getElementById("editFormaPagamento").value;
  os.atualizadoEm = new Date().toISOString();
  h[idx] = os; setHistorico(h);
  const fmt = document.querySelector('input[name="formatoPDF"]:checked')?.value || "a4";
  document.getElementById("dialogoEditarPDF").close(); osEmEdicaoPDF = null;
  renderizarHistorico();
  if (fmt === "a4") await gerarPDFA4(os.numero);
  else if (fmt === "58mm") await gerarPDFTermico(os.numero, 58);
  else if (fmt === "60mm") await gerarPDFTermico(os.numero, 60);
}

async function enviarWhatsApp(event) {
  event.preventDefault();
  if (enviando) return;
  validacaoIniciada = true;
  const pronto = atualizarEstadoEnvio();
  if (!pronto) {
    await mostrarAlerta("Preencha todos os campos obrigatórios.", "Incompleto");
    irParaPrimeiraPendencia();
    return;
  }
  const criticos = ["cliente","telefone","marca","modelo","cor","defeito"];
  if (criticos.some(id => !document.getElementById(id)?.value.trim())) {
    await mostrarAlerta("Dados do cliente/aparelho incompletos (aba 1).", "Incompleto");
    alternarModo("cliente", true); return;
  }
  enviando = true;
  const btn = document.querySelector(".btn-submit"); btn.disabled = true;
  try {
    let status = "Em Diagnóstico";
    let numero = osSessaoNumero || salvarOS(status);
    let msg = "";
    if (modoAtual === "cliente") {
      status = "Em Diagnóstico";
      numero = salvarOS(status);
      const link = await encurtarUrl(gerarLinkCheckin("tecnico"));
      msg = gerarMensagemCheckin(link);
    }
    else if (modoAtual === "tecnico") {
      const st = radioValor("statusReparo");
      status = st === "Reprovado" ? "Negada" : "Em Orçamento";
      numero = salvarOS(status);
      msg = gerarMensagemTecnico(numero);
    }
    else if (modoAtual === "os") {
      const st = radioValor("statusReparo");
      status = st === "Reprovado" ? "Negada" : "Aprovado";
      numero = salvarOS(status);
      msg = gerarMensagemOrcamento(numero);
    }
    else if (modoAtual === "checkout") {
      status = "Concluído";
      numero = salvarOS(status);
      msg = gerarMensagemCheckout(numero);
    }
    if (!msg) { await mostrarAlerta("Não foi possível montar a mensagem."); return; }
    if (modoAtual === "checkout") {
      const esc = await mostrarOpcoesDialogo(
        `OS ${numero} concluída.\nDeseja gerar o PDF agora?`,
        "OS Concluída",
        [
          { valor:"a4", label:"PDF A4", primario:true },
          { valor:"58mm", label:"Térmica 58mm" },
          { valor:"60mm", label:"Térmica 60mm" },
          { valor:"cancel", label:"Só WhatsApp" }
        ]
      );
      if (esc === "a4") await gerarPDFA4(numero);
      else if (esc === "58mm") await gerarPDFTermico(numero, 58);
      else if (esc === "60mm") await gerarPDFTermico(numero, 60);
    }
    const fotos = obterFotosEtapaAtual();
    await enviarMensagemComFotos(NUMERO_CLIENTE, msg, fotos);
  } finally {
    enviando = false;
    btn.disabled = false;
    atualizarEstadoEnvio();
  }
}

function carregarOSNoFormulario(numero) {
  const os = getHistorico().find(o => o.numero === numero);
  if (!os) { mostrarAlerta("OS não encontrada."); return; }
  osSessaoNumero = numero; abasProtegidasDesbloqueadas = true;
  const c = os.cliente || {}, a = os.aparelho || {}, e = os.entrega || {}, co = os.comodato || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
  set("cliente", c.nome); set("cpf", c.cpf); set("telefone", c.telefone); set("telefoneAdicional", c.telefoneAdicional);
  set("marca", a.marca); set("modelo", a.modelo); set("cor", a.cor); set("tipo", a.tipo);
  set("senha", a.senha); set("defeito", a.defeito); set("observacao", a.observacao);
  set("possuiAcessorios", a.possuiAcessorios); atualizarCampoAcessorios(); set("acessorios", a.acessorios);
  set("servicoEntrega", e.servico); atualizarCamposEntrega();
  set("enderecoEntrega", e.endereco); set("pontoReferencia", e.referencia); set("linkLocalizacao", e.link); set("dataHoraRetirada", e.dataHora);
  atualizarDiaSemanaRetirada();
  if (co.solicitado) {
    const inpSol = document.querySelector('input[name="comodato"][value="Sim (Sujeito a disponibilidade)"]');
    if (inpSol) inpSol.checked = true;
    if (co.disponivel) { const inpD = document.querySelector('input[name="disponibilidadeComodato"][value="Sim"]'); if (inpD) inpD.checked = true; }
    atualizarCamposComodato();
    set("comodatoMarca", co.marca); set("comodatoModelo", co.modelo); set("comodatoCor", co.cor); set("comodatoObservacao", co.observacao);
  }
  itensTriagem.forEach(i => { const v = os.triagem?.[i.id]; if (!v || v === "Não informado") return; const inp = document.querySelector(`input[name="${i.id}"][value="${CSS.escape(v)}"]`); if (inp) inp.checked = true; });
  registrosOS = (os.registros || []).map(r => ({ ...r }));
  proximoRegistroId = registrosOS.reduce((m, r) => typeof r.id === "number" ? Math.max(m, r.id) : m, 0) + 1;
  renderizarRegistrosOS();
  const p = os.pagamento || {};
  if (p.forma) { document.getElementById("formaPagamento").value = p.forma; atualizarCamposPagamento(); }
  if (p.parcelas) document.getElementById("parcelasCartao").value = String(p.parcelas);
  if (p.taxa) document.getElementById("taxaCartao").value = String(p.taxa).replace(".",",");
  if (p.precisaTroco !== undefined) { document.getElementById("precisaTroco").value = p.precisaTroco ? "Sim" : "Não"; toggleTroco(); if (p.valorTroco) document.getElementById("valorTroco").value = p.valorTroco; }
  alternarModo("cliente", true); atualizarEstadoEnvio();
  mostrarAlerta(`OS ${numero} carregada.`, "Sucesso");
}
function alterarStatusOS(numero, novo) {
  const h = getHistorico(), idx = h.findIndex(o => o.numero === numero);
  if (idx < 0) return;
  h[idx].status = novo; h[idx].atualizadoEm = new Date().toISOString();
  setHistorico(h); renderizarHistorico();
}
async function excluirOS(numero) {
  if (!(await confirmarAcao(`Excluir OS ${numero}?`, "Excluir", "Excluir", "Cancelar"))) return;
  setHistorico(getHistorico().filter(o => o.numero !== numero));
  if (osSessaoNumero === numero) osSessaoNumero = null;
  renderizarHistorico();
}
function exportarBackup() {
  const blob = new Blob([JSON.stringify(getHistorico(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `f5tec_backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importarBackup(file) {
  if (!file) return;
  if (!(await confirmarAcao("Isso vai SUBSTITUIR o histórico. Continuar?", "Importar", "Importar", "Cancelar"))) return;
  try {
    const dados = JSON.parse(await file.text());
    if (!Array.isArray(dados)) throw new Error("Formato inválido");
    setHistorico(dados); renderizarHistorico();
    await mostrarAlerta("Backup importado!", "Sucesso");
  } catch (e) { await mostrarAlerta("Arquivo inválido: " + e.message, "Erro"); }
}
async function limparHistorico() {
  if (!(await confirmarAcao("Apagar TODAS as OS?", "Limpar", "Apagar Tudo", "Cancelar"))) return;
  setHistorico([]); osSessaoNumero = null; renderizarHistorico();
}
async function resetarAtendimento() {
  if (!(await confirmarAcao("Limpar todos os campos e começar novo atendimento?", "Novo Atendimento", "Limpar", "Cancelar"))) return;
  document.getElementById("formOS").reset();
  atualizarDiaSemanaRetirada();
  osSessaoNumero = null; financeiroAprovado = false; abasProtegidasDesbloqueadas = false;
  sequenciaPadrao = []; registrosOS = []; proximoRegistroId = 1; validacaoIniciada = false; filtroHistoricoAtual = "Todos";
  itensTriagem.forEach(i => document.querySelectorAll(`input[name="${i.id}"]`).forEach(r => r.checked = false));
  itensHardware.forEach((_, i) => { document.querySelectorAll(`input[name="hw_${i}"]`).forEach(r => r.checked = false); document.querySelectorAll(`input[name="out_${i}"]`).forEach(r => r.checked = false); });
  document.querySelectorAll('input[name="confirmacaoAgendamento"], input[name="disponibilidadeComodato"], input[name="statusReparo"]').forEach(r => r.checked = false);
  document.querySelectorAll(".foto-preview").forEach(p => p.replaceChildren());
  ["campoListaAcessorios","camposEntrega","areaAgendamentoColeta","areaComodato","camposComodato","avisoReprovado","blocoTaxasReprovado"].forEach(id => document.getElementById(id).classList.add("hidden"));
  document.getElementById("btnAprovarFinanceiro").disabled = true;
  document.getElementById("btnAprovarFinanceiro").textContent = "✅ Aprovar Orçamento e Liberar Checkout";
  document.getElementById("btnAprovarFinanceiro").style.background = "";
  document.getElementById("btnModoOS").disabled = true;
  document.getElementById("btnModoCheckout").disabled = true;
  document.getElementById("validationSummary").classList.add("hidden");
  document.querySelectorAll(".dot-btn").forEach(b => b.classList.remove("selected"));
  renderizarRegistrosOS();
  if (window.history.replaceState) window.history.replaceState({}, "", window.location.pathname);
  alternarModo("cliente", false); atualizarEstadoEnvio();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function configurarMensagensValidacao() {
  const regras = { cpf: "Informe 11 dígitos do CPF.", telefone: "Informe DDD + número (10 a 13 dígitos).", telefoneAdicional: "Informe DDD + número." };
  Object.entries(regras).forEach(([id, msg]) => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener("invalid", () => el.setCustomValidity(msg));
    el.addEventListener("input", () => el.setCustomValidity(""));
    el.addEventListener("change", () => el.setCustomValidity(""));
  });
}

function init() {
  popularParcelas(); atualizarTaxaCartao(); atualizarCamposPagamento();
  configurarPreviewsFotos(); configurarMensagensValidacao(); renderizarRegistrosOS();
  const campoData = document.getElementById("dataHoraRetirada");
  if (campoData) {
    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    campoData.min = agora.toISOString().slice(0,16);
  }
  alternarModo("cliente", false); carregarDadosDaURL(); atualizarDiaSemanaRetirada(); atualizarEstadoEnvio();
}

document.addEventListener("DOMContentLoaded", init);