// --- SUPABASE SETUP ---
const supabaseUrl = 'https://hmgvbzaybsfnrjhhgpdl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZ3ZiemF5YnNmbnJqaGhncGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDI4ODUsImV4cCI6MjEwMzU3ODg4NX0.BDKUq3-O9CImiu1tpxD-QTtbeTAt6MlOjo7MUt9hkBY';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- ESTADO LOCAL SINCRONIZADO ---
let clientes = [];
let servicos = [];
let precosSalvos = {};
let itensCustomizados = [];

const listaItensOficiais = [
    { id: 'alicate-cuticula', nome: 'Alicate Cutícula', tipo: 'numero' },
    { id: 'alicate-unha', nome: 'Alicate Unha', tipo: 'numero' },
    { id: 'molas-parafuso', nome: 'Molas / Parafuso', tipo: 'numero' },
    { id: 'espatula-raspador', nome: 'Espátula / Palito', tipo: 'numero' },
    { id: 'bisturi', nome: 'Bisturi', tipo: 'numero' },
    { id: 'tesoura', nome: 'Tesoura', tipo: 'numero' },
    { id: 'lamina-maq', nome: 'Lâmina Máquina', tipo: 'numero' },
    { id: 'faca', nome: 'Faca', tipo: 'numero' },
    { id: 'frete', nome: 'Taxa de Entrega', tipo: 'numero' },
    { id: 'outros', nome: 'Outros Serviços', tipo: 'numero' }
];
let listaItensAtiva = [];

// --- INICIALIZAÇÃO ASSÍNCRONA ---
window.onload = async () => {
    await carregarDadosDoSupabase();
    
    renderizarFormularioItens();
    atualizarSelectClientes();
    popularSelectCidades();
    atualizarSinoNotificacoes();
    setDatasIniciais();
    popularSelectMesesFaturamento(); 
};

async function carregarDadosDoSupabase() {
    const { data: dbClientes } = await supabaseClient.from('clientes').select('*');
    if (dbClientes) {
        clientes = dbClientes.map(c => ({
            id: c.id, nome: c.nome, telefone: c.telefone, endereco: c.endereco, cidade: c.cidade, retornoDias: c.retorno_dias, oculto: c.oculto
        }));
    }

    const { data: dbServicos } = await supabaseClient.from('servicos').select('*');
    if (dbServicos) {
        servicos = dbServicos.map(s => {
            const data = new Date(s.created_at);
            return {
                id: s.id, osNumero: s.os_numero, clienteId: s.cliente_id, itens: s.itens, 
                total: parseFloat(s.total), dataColeta: s.data_coleta, dataEntrega: s.data_entrega, 
                concluido: s.concluido, dataStr: data.toLocaleDateString('pt-BR'), 
                horaStr: data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                timestamp: data.getTime()
            };
        });
    }

    const { data: dbItens } = await supabaseClient.from('itens').select('*');
    if (dbItens) {
        itensCustomizados = [];
        dbItens.forEach(i => {
            precosSalvos[i.id] = parseFloat(i.preco);
            if (i.is_custom) { itensCustomizados.push({ id: i.id, nome: i.nome, tipo: 'numero' }); }
        });
    }
    listaItensAtiva = [...listaItensOficiais, ...itensCustomizados];
}

async function adicionarNovoItem() {
    const inputNome = document.getElementById('novo-item-nome');
    const nome = inputNome.value.trim();
    if (!nome) return;

    const idUnico = 'custom_' + Date.now();
    await supabaseClient.from('itens').insert([{ id: idUnico, nome: nome, preco: 0, is_custom: true }]);

    const novoItem = { id: idUnico, nome: nome, tipo: 'numero' };
    itensCustomizados.push(novoItem);
    listaItensAtiva.push(novoItem);
    renderizarFormularioItens();
    
    inputNome.value = '';
}

// --- UTILITÁRIOS ---
const formatarMoeda = (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const formatarDataBR = (dataString) => {
    if(!dataString) return '--/--/----';
    const partes = dataString.split('-');
    if(partes.length !== 3) return dataString;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const maskPhone = (input) => {
    let val = input.value.replace(/\D/g, '');
    if(val.length > 11) val = val.slice(0, 11);
    if(val.length > 2) val = `(${val.slice(0,2)}) ${val.slice(2)}`;
    if(val.length > 10) val = `${val.slice(0,10)}-${val.slice(10)}`;
    input.value = val;
};

function popularSelectCidades() {
    const select = document.getElementById('filtro-cidade');
    if(!select) return;
    const cidadeAtual = select.value;
    let cidades = new Set();
    clientes.forEach(c => { if (c.cidade && c.cidade.trim() !== '') cidades.add(c.cidade.trim()); });
    let html = '<option value="" style="background: #111;">Todas as cidades</option>';
    Array.from(cidades).sort().forEach(cid => { html += `<option value="${cid}" style="background: #111;">${cid}</option>`; });
    select.innerHTML = html;
    select.value = cidadeAtual; 
}

function toggleAccordion(id, element) {
    const content = document.getElementById(id);
    const icon = element.querySelector('.accordion-icon');
    if (content.classList.contains('open')) {
        content.classList.remove('open'); icon.classList.remove('open');
    } else {
        content.classList.add('open'); icon.classList.add('open');
    }
}

function toggleBackgroundScale(ativar) {
    const elementos = [document.querySelector('main'), document.querySelector('header'), document.querySelector('nav')];
    elementos.forEach(el => {
        if(el) { ativar ? el.classList.add('bg-scale-down') : el.classList.remove('bg-scale-down'); }
    });
}

let confirmCallback = null;
function customConfirm(titulo, descricao, callback) {
    document.getElementById('confirm-msg').innerText = titulo;
    document.getElementById('confirm-desc').innerText = descricao;
    confirmCallback = callback;
    
    const modal = document.getElementById('modal-confirm');
    modal.classList.add('active'); 
    toggleBackgroundScale(true);
    
    setTimeout(() => {
        document.getElementById('modal-confirm-content').style.transform = 'scale(1)';
        document.getElementById('modal-confirm-content').style.opacity = '1';
    }, 10);
}

document.getElementById('btn-confirm-cancel').addEventListener('click', fecharConfirm);
document.getElementById('btn-confirm-ok').addEventListener('click', () => { if(confirmCallback) confirmCallback(); fecharConfirm(); });

function fecharConfirm() {
    document.getElementById('modal-confirm-content').style.transform = 'scale(0.9)';
    document.getElementById('modal-confirm-content').style.opacity = '0';
    setTimeout(() => {
        const modal = document.getElementById('modal-confirm');
        modal.classList.remove('active');
        if(!document.querySelector('.modal-overlay.active:not(#modal-confirm)')) { toggleBackgroundScale(false); }
    }, 300);
}

function setDatasIniciais() {
    const hoje = new Date();
    document.getElementById('os-data-coleta').value = hoje.toISOString().split('T')[0];
    const entrega = new Date(hoje);
    entrega.setDate(entrega.getDate() + 1);
    document.getElementById('os-data-entrega').value = entrega.toISOString().split('T')[0];
}

function mudarAba(idAba, elementoBotao) {
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.getElementById(idAba).classList.add('active');
    
    if(elementoBotao) elementoBotao.classList.add('active');
    
    if(idAba === 'sec-historico') renderizarHistorico();
    if(idAba === 'sec-clientes') renderizarListaClientes();
    if(idAba === 'sec-agendamento') renderizarAgendamentos();
    if(idAba === 'sec-faturamento') renderizarFaturamento();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function atualizarPrecoFixo(id, valor) {
    const valorNumerico = parseFloat(valor) || 0;
    precosSalvos[id] = valorNumerico;
    await supabaseClient.from('itens').update({ preco: valorNumerico }).eq('id', id);
    calcularTotal();
}

function renderizarFormularioItens() {
    const container = document.getElementById('os-itens-container');
    container.innerHTML = `<div class="os-row os-header"><div>QTD</div><div>Item / Especificação</div><div>VAL UN (R$)</div></div>`;

    listaItensAtiva.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'os-row';
        row.style.animation = `fadeSlideUp 0.4s ease forwards ${index * 0.05}s`;
        row.style.opacity = '0';
        
        let precoAtual = precosSalvos[item.id] !== undefined ? precosSalvos[item.id] : '';
        row.innerHTML = `
            <div><input type="number" id="qtd_${item.id}" min="0" placeholder="0" oninput="calcularTotal()"></div>
            <div class="item-name">${item.nome}</div>
            <div><input type="number" id="val_${item.id}" min="0" step="0.01" value="${precoAtual}" placeholder="0,00" oninput="atualizarPrecoFixo('${item.id}', this.value)"></div>
        `;
        container.appendChild(row);
    });
}

function animarNumero(id, valorFinal) {
    const elemento = document.getElementById(id);
    elemento.innerText = formatarMoeda(valorFinal);
    elemento.style.transform = 'scale(1.1)'; elemento.style.color = '#FFF';
    setTimeout(() => { elemento.style.transform = 'scale(1)'; elemento.style.color = 'var(--gold)'; }, 150);
}

function calcularTotal() {
    let totalGeral = 0;
    listaItensAtiva.forEach(item => {
        const inputQtd = document.getElementById(`qtd_${item.id}`);
        const inputVal = document.getElementById(`val_${item.id}`);
        let quantidade = parseInt(inputQtd.value) || 0;
        let precoUnitario = parseFloat(inputVal.value) || 0;
        totalGeral += (quantidade * precoUnitario);
    });
    animarNumero('os-total', totalGeral);
}

async function salvarServico() {
    const clienteId = document.getElementById('os-cliente').value;
    const dataColeta = document.getElementById('os-data-coleta').value;
    const dataEntrega = document.getElementById('os-data-entrega').value;
    
    if (!clienteId) { alert("⚠️ Selecione um cliente."); return; }
    if (!dataColeta || !dataEntrega) { alert("⚠️ Preencha as datas de coleta e entrega."); return; }

    let itensAdicionados = [];
    let totalServico = 0;

    listaItensAtiva.forEach(item => {
        const inputQtd = document.getElementById(`qtd_${item.id}`);
        const inputVal = document.getElementById(`val_${item.id}`);
        let quantidade = parseInt(inputQtd.value) || 0;
        let precoUnitario = parseFloat(inputVal.value) || 0;
        
        if (quantidade > 0) {
            let totalItem = quantidade * precoUnitario;
            itensAdicionados.push({ nome: item.nome, qtdValor: quantidade, valorUnitario: precoUnitario, valorTotal: totalItem });
            totalServico += totalItem;
        }
    });

    if (itensAdicionados.length === 0) { alert("⚠️ Insira a quantidade de pelo menos um item."); return; }

    const novoNumOS = String(servicos.length + 1).padStart(3, '0');

    const { data: novoServico } = await supabaseClient.from('servicos').insert([{
        os_numero: novoNumOS, cliente_id: clienteId, itens: itensAdicionados,
        total: totalServico, data_coleta: dataColeta, data_entrega: dataEntrega, concluido: false
    }]).select();

    if(novoServico) {
        await supabaseClient.from('clientes').update({ oculto: false }).eq('id', clienteId);
        await carregarDadosDoSupabase();
        
        listaItensAtiva.forEach(item => { const field = document.getElementById(`qtd_${item.id}`); if(field) field.value = ''; });
        document.getElementById('os-cliente').value = '';
        document.getElementById('os-total').innerText = 'R$ 0,00';
        setDatasIniciais();

        atualizarSinoNotificacoes(); popularSelectMesesFaturamento(); 
        abrirModalSucesso(servicos.find(s => s.id === novoServico[0].id));
    }
}

function abrirModalSucesso(servico) {
    const cli = clientes.find(c => c.id === servico.clienteId);
    document.getElementById('sucesso-cliente-nome').innerText = `Serviço agendado para ${cli.nome}`;
    document.getElementById('sucesso-os-numero').innerText = `OS #${servico.osNumero}`;
    
    document.getElementById('btn-baixar-pdf').onclick = () => gerarReciboPDF(servico, cli);
    document.getElementById('btn-share-wa').onclick = () => compartilharReciboWA(servico, cli);

    const modal = document.getElementById('modal-sucesso-os');
    modal.classList.add('active'); toggleBackgroundScale(true);
    
    setTimeout(() => {
        document.getElementById('modal-sucesso-content').style.transform = 'scale(1)';
        document.getElementById('modal-sucesso-content').style.opacity = '1';
    }, 10);
    dispararConfetes();
}

function fecharModalSucesso() {
    document.getElementById('modal-sucesso-content').style.transform = 'scale(0.9)';
    document.getElementById('modal-sucesso-content').style.opacity = '0';
    setTimeout(() => {
        const modal = document.getElementById('modal-sucesso-os');
        modal.classList.remove('active'); toggleBackgroundScale(false);
    }, 300);
}

function dispararConfetes() {
    var duration = 3 * 1000; var end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#D4AF37', '#FFFFFF', '#997A00'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#D4AF37', '#FFFFFF', '#997A00'] });
        if (Date.now() < end) { requestAnimationFrame(frame); }
    }());
}

// ==========================================
// --- FUNÇÕES PDF CORRIGIDAS DEFINITIVAS ---
// ==========================================

function gerarReciboPDFPorId(id) {
    const serv = servicos.find(s => s.id === id);
    if (!serv) return;
    const cli = clientes.find(c => c.id === serv.clienteId) || { nome: 'Desconhecido', telefone: '-' };
    gerarReciboPDF(serv, cli);
}

function compartilharReciboWAPorId(id) {
    const serv = servicos.find(s => s.id === id);
    if (!serv) return;
    const cli = clientes.find(c => c.id === serv.clienteId) || { nome: 'Desconhecido', telefone: '-' };
    compartilharReciboWA(serv, cli);
}

function montarLayoutRecibo(serv, cli) {
    let itensHtml = '';
    serv.itens.forEach(item => {
        itensHtml += `
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 15px;">
                <span style="width: 40px; font-weight: 600; color: #FFFFFF;">${item.qtdValor}</span>
                <span style="flex-grow: 1; text-align: left; color: #A1A1AA;">${item.nome}</span>
                <span style="font-weight: 700; color: #FFFFFF;">${formatarMoeda(item.valorTotal)}</span>
            </div>
        `;
    });
    
    const telefoneCli = cli.telefone ? cli.telefone : '-';
    
    return `
        <div id="pdf-content-wrapper" style="position: relative; font-family: 'Plus Jakarta Sans', Arial, sans-serif; padding: 40px; background-color: #050505; color: #FFFFFF; width: 100%; min-height: 296.8mm; max-height: 298mm; overflow: hidden; box-sizing: border-box;">
            
            <!-- Cabeçalho -->
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px dashed rgba(255,255,255,0.1);">
                <h1 style="color: #D4AF37; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: 1px; text-transform: uppercase;">Gold AFIAÇÕES</h1>
                <p style="color: #D4AF37; font-size: 18px; font-weight: 800; margin: 10px 0 5px 0;">OS #${serv.osNumero}</p>
                <p style="color: #A1A1AA; font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 2px;">Recibo de Serviço</p>
            </div>
            
            <!-- Info do Cliente e Datas -->
            <div style="background-color: #141414; border: 1px solid rgba(212, 175, 55, 0.2); padding: 20px; border-radius: 16px; margin-bottom: 30px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                    <strong style="color: #A1A1AA;">Cliente:</strong>
                    <span style="color: #FFFFFF;">${cli.nome}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px;">
                    <strong style="color: #A1A1AA;">Telefone:</strong>
                    <span style="color: #FFFFFF;">${telefoneCli}</span>
                </div>
                
                <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 12px 0;"></div>
                
                <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px;">
                    <strong style="color: #A1A1AA;">Coleta:</strong>
                    <span style="color: #FFFFFF;">${formatarDataBR(serv.dataColeta)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px;">
                    <strong style="color: #D4AF37;">Entrega:</strong>
                    <span style="font-weight: bold; color: #D4AF37;">${formatarDataBR(serv.dataEntrega)}</span>
                </div>
            </div>
            
            <!-- Itens -->
            <div style="background-color: #141414; padding: 20px; border-radius: 16px; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 15px; color: #D4AF37; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; font-size: 12px; text-transform: uppercase;">
                    <span style="width: 40px;">Qtd</span>
                    <span style="flex-grow: 1; text-align: left;">Descrição</span>
                    <span>Total</span>
                </div>
                ${itensHtml}
            </div>
            
            <!-- Total -->
            <div style="text-align: right; font-size: 24px; font-weight: 800; margin-top: 30px; color: #FFFFFF;">
                TOTAL: <span style="color: #D4AF37;">${formatarMoeda(serv.total)}</span>
            </div>

            <!-- Barra preta adicionada para ocultar a linha branca residual no final da página -->
            <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 25px; background-color: #050505; z-index: 9999;"></div>
        </div>
    `;
}

function prepararEObterElemento(serv, cli) {
    const container = document.getElementById('pdf-container');
    container.innerHTML = montarLayoutRecibo(serv, cli);
    
    container.style.display = 'block';
    container.style.position = 'absolute'; 
    container.style.top = '0';
    container.style.left = '0';
    container.style.zIndex = '-9999';
    container.style.backgroundColor = '#050505'; // Fundo ajustado para a renderização
    
    return document.getElementById('pdf-content-wrapper');
}

function limparContainerPDF() {
    const container = document.getElementById('pdf-container');
    container.style.display = 'none';
    container.innerHTML = '';
}

function obterOpcoesPDF(serv, cli) {
    return {
        margin:       0, // Margem zerada para o fundo cobrir a página inteira
        filename:     `Recibo_OS${serv.osNumero}_${cli.nome.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#050505', scrollY: 0 }, // Cor de fundo sincronizada
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
}

function gerarReciboPDF(serv, cli) {
    const element = prepararEObterElemento(serv, cli);
    const opt = obterOpcoesPDF(serv, cli);
    
    html2pdf().set(opt).from(element).save().then(() => {
        limparContainerPDF();
    }).catch(err => {
        console.error("Erro no PDF:", err);
        limparContainerPDF();
    });
}

function compartilharReciboWA(serv, cli) {
    const element = prepararEObterElemento(serv, cli);
    const opt = obterOpcoesPDF(serv, cli);

    html2pdf().set(opt).from(element).toPdf().get('pdf').then(function(pdf) {
        const pdfBlob = pdf.output('blob');
        const file = new File([pdfBlob], opt.filename, { type: 'application/pdf' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
                files: [file],
                title: `Recibo OS #${serv.osNumero}`,
                text: `Olá ${cli.nome}, segue em anexo o recibo do seu serviço na Gold Afiações (OS #${serv.osNumero}).`
            }).then(() => {
                limparContainerPDF();
            }).catch(err => {
                console.log('Compartilhamento cancelado:', err);
                limparContainerPDF();
            });
        } else {
            alert("Seu dispositivo não suporta o envio automático de arquivos pelo WhatsApp.\\nO arquivo será baixado e abriremos a conversa para você anexá-lo manualmente.");
            
            pdf.save(opt.filename);
            limparContainerPDF();
            
            let numeroLimpo = cli.telefone ? cli.telefone.replace(/\D/g, '') : '';
            if (numeroLimpo.length === 10 || numeroLimpo.length === 11) { numeroLimpo = '55' + numeroLimpo; }
            const texto = encodeURIComponent(`*GOLD AFIAÇÕES* ✂️✨\\nOlá *${cli.nome}*, estou lhe enviando o arquivo PDF do recibo do seu serviço (*OS #${serv.osNumero}*).`);
            
            setTimeout(() => {
                if (numeroLimpo) { 
                    window.open(`https://wa.me/${numeroLimpo}?text=${texto}`, '_blank');
                } else { 
                    window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank'); 
                }
            }, 1000);
        }
    });
}
// ==========================================


// --- AGENDAMENTOS ---
function renderizarAgendamentos(termoBusca = '') {
    const container = document.getElementById('lista-agendamentos');
    container.innerHTML = '';
    const termo = termoBusca.toLowerCase().trim();
    let agendados = servicos.filter(s => s.dataEntrega && !s.concluido);
    if (termo) { agendados = agendados.filter(s => { const cli = clientes.find(c => c.id === s.clienteId); return cli && cli.nome.toLowerCase().includes(termo); }); }
    agendados.sort((a, b) => new Date(a.dataEntrega) - new Date(b.dataEntrega));

    if (agendados.length === 0) return container.innerHTML = '<p style="color: var(--text-muted); text-align:center; padding: 20px;">Nenhum agendamento pendente encontrado.</p>';

    agendados.forEach((serv, index) => {
        const cliente = clientes.find(c => c.id === serv.clienteId) || { nome: 'Cliente Excluído' };
        container.innerHTML += `
            <div class="swipe-container" style="animation: fadeSlideUp 0.4s ease forwards ${index * 0.05}s; opacity:0;">
                <div class="cliente-card swipe-card" style="padding: 0; margin-bottom: 0;">
                    <div style="padding: 20px; cursor:pointer;" onclick="abrirModalOS('${serv.id}')">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="cliente-nome">${cliente.nome}</span>
                            <span style="color: var(--gold); font-size: 0.8rem; background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); padding: 4px 10px; border-radius: 12px; font-weight: 700;">Entrega: ${formatarDataBR(serv.dataEntrega)}</span>
                        </div>
                        <div class="cliente-info" style="margin-top: 10px;">
                            <span><strong style="color: var(--text-main);">OS #${serv.osNumero}</strong> &nbsp; | &nbsp; <i class="ph ph-calendar-plus"></i> Coleta: ${formatarDataBR(serv.dataColeta)}</span>
                            <span><i class="ph ph-money"></i> ${formatarMoeda(serv.total)}</span>
                        </div>
                    </div>
                </div>
                <div class="swipe-actions" style="width: 170px;">
                    <button class="swipe-btn" style="background: var(--success);" onclick="confirmarAgendamento('${serv.id}')"><i class="ph-bold ph-check-circle" style="font-size: 1.4rem;"></i> Entregue</button>
                    <button class="swipe-btn" style="background: var(--danger);" onclick="excluirAgendamento('${serv.id}')"><i class="ph-bold ph-trash" style="font-size: 1.4rem;"></i> Excluir</button>
                </div>
            </div>`;
    });
}

function filtrarAgendamentos() { renderizarAgendamentos(document.getElementById('busca-agendamento').value); }

function confirmarAgendamento(id) {
    customConfirm("Confirmar Entrega?", "O serviço será marcado como concluído e sairá da agenda.", async () => {
        const servico = servicos.find(s => s.id === id);
        
        await supabaseClient.from('servicos').update({ concluido: true }).eq('id', id);
        await supabaseClient.from('clientes').update({ oculto: true }).eq('id', servico.clienteId);
        
        await carregarDadosDoSupabase();
        renderizarAgendamentos(document.getElementById('busca-agendamento').value);
        atualizarSinoNotificacoes(); popularSelectMesesFaturamento();
    });
}

function excluirAgendamento(id) {
    customConfirm("Excluir OS da Agenda?", "A ordem de serviço será apagada do histórico.", async () => {
        const servico = servicos.find(s => s.id === id);
        
        await supabaseClient.from('servicos').delete().eq('id', id);
        await supabaseClient.from('clientes').update({ oculto: true }).eq('id', servico.clienteId);
        
        await carregarDadosDoSupabase();
        renderizarAgendamentos(document.getElementById('busca-agendamento').value);
        renderizarHistorico(); atualizarSinoNotificacoes(); popularSelectMesesFaturamento();
    });
}

// --- CLIENTES CRUD ---
async function salvarNovoCliente() {
    const nome = document.getElementById('cli-nome').value.trim();
    const telefone = document.getElementById('cli-telefone').value.trim();
    const endereco = document.getElementById('cli-endereco').value.trim();
    const cidade = document.getElementById('cli-cidade').value.trim();
    const retorno = parseInt(document.getElementById('cli-retorno').value) || 30;

    if (!nome) { alert("⚠️ O nome do cliente é obrigatório."); return; }

    await supabaseClient.from('clientes').insert([{ nome, telefone, endereco, cidade, retorno_dias: retorno, oculto: false }]);
    
    document.getElementById('cli-nome').value = ''; document.getElementById('cli-telefone').value = '';
    document.getElementById('cli-endereco').value = ''; document.getElementById('cli-cidade').value = ''; document.getElementById('cli-retorno').value = '30';
    
    const accordionContent = document.getElementById('acc-novo-cliente');
    const icon = accordionContent.previousElementSibling.querySelector('.accordion-icon');
    accordionContent.classList.remove('open'); icon.classList.remove('open');
    
    await carregarDadosDoSupabase();
    atualizarSelectClientes(); popularSelectCidades(); renderizarListaClientes(); atualizarSinoNotificacoes();
}

function editarCliente(id) {
    const cli = clientes.find(c => c.id === id);
    if (!cli) return;
    
    document.getElementById('edit-cli-id').value = cli.id;
    document.getElementById('edit-cli-nome').value = cli.nome;
    document.getElementById('edit-cli-telefone').value = cli.telefone || '';
    document.getElementById('edit-cli-endereco').value = cli.endereco || '';
    document.getElementById('edit-cli-cidade').value = cli.cidade || '';
    document.getElementById('edit-cli-retorno').value = cli.retornoDias;
    
    const modal = document.getElementById('modal-editar');
    modal.classList.add('active'); document.body.style.overflow = 'hidden'; toggleBackgroundScale(true);
}

async function salvarEdicaoCliente() {
    const id = document.getElementById('edit-cli-id').value;
    const nome = document.getElementById('edit-cli-nome').value.trim();
    const telefone = document.getElementById('edit-cli-telefone').value.trim();
    const endereco = document.getElementById('edit-cli-endereco').value.trim();
    const cidade = document.getElementById('edit-cli-cidade').value.trim();
    const retorno = parseInt(document.getElementById('edit-cli-retorno').value) || 30;

    if (!nome) { alert("⚠️ O nome do cliente é obrigatório."); return; }

    await supabaseClient.from('clientes').update({ nome, telefone, endereco, cidade, retorno_dias: retorno }).eq('id', id);
    
    await carregarDadosDoSupabase();
    atualizarSelectClientes(); popularSelectCidades(); renderizarListaClientes(); atualizarSinoNotificacoes();
    fecharModal('modal-editar');
}

function excluirCliente(id) {
    customConfirm("Excluir Cliente?", "O cadastro deste cliente será removido. Tem certeza?", async () => {
        await supabaseClient.from('clientes').delete().eq('id', id);
        await carregarDadosDoSupabase();
        atualizarSelectClientes(); popularSelectCidades(); renderizarListaClientes(); atualizarSinoNotificacoes();
    });
}

function atualizarSelectClientes() {
    const select = document.getElementById('os-cliente');
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    clientes.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(cli => { select.innerHTML += `<option value="${cli.id}">${cli.nome}</option>`; });
}

function renderizarListaClientes(termoBusca = '') {
    const container = document.getElementById('lista-clientes-container');
    container.innerHTML = '';
    const termo = termoBusca.toLowerCase().trim();
    const filtrados = clientes.filter(cli => cli.nome.toLowerCase().includes(termo) || (cli.telefone && cli.telefone.toLowerCase().includes(termo)));

    if (filtrados.length === 0) return container.innerHTML = '<p style="color: var(--text-muted); text-align:center; padding: 20px;">Nenhum cliente encontrado.</p>';

    filtrados.sort((a, b) => a.nome.localeCompare(b.nome)).forEach(cli => {
        container.innerHTML += `
            <div class="swipe-container">
                <div class="cliente-card swipe-card" onclick="abrirModalCliente('${cli.id}')">
                    <div class="cliente-nome">${cli.nome}</div>
                    <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 5px 0;"></div>
                    <div class="cliente-info"><span><i class="ph ph-whatsapp-logo"></i> ${cli.telefone || '-'}</span> <span><i class="ph ph-arrows-clockwise"></i> <strong style="color:var(--gold)">${cli.retornoDias} dias</strong></span></div>
                    <div class="cliente-info" style="margin-top: 5px;"><span><i class="ph ph-map-pin"></i> ${cli.endereco || 'Endereço não informado'}${cli.cidade ? ' - ' + cli.cidade : ''}</span></div>
                </div>
                <div class="swipe-actions" style="width: 140px;">
                    <button class="swipe-btn" style="background: var(--warning);" onclick="editarCliente('${cli.id}')"><i class="ph-bold ph-pencil" style="font-size: 1.4rem;"></i> Editar</button>
                    <button class="swipe-btn" style="background: var(--danger);" onclick="excluirCliente('${cli.id}')"><i class="ph-bold ph-trash" style="font-size: 1.4rem;"></i> Excluir</button>
                </div>
            </div>`;
    });
}
function filtrarClientes() { renderizarListaClientes(document.getElementById('busca-cliente').value); }

// --- HISTÓRICO ---
function renderizarHistorico() {
    const container = document.getElementById('lista-historico');
    container.innerHTML = '';
    if (servicos.length === 0) return container.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 20px;">Nenhuma OS registrada.</p>';

    const clientesComOS = [...new Set(servicos.map(s => s.clienteId))];
    clientesComOS.forEach((clienteId, index) => {
        const cliente = clientes.find(c => c.id === clienteId) || { nome: 'Cliente Excluído', id: clienteId };
        const qtdeOS = servicos.filter(s => s.clienteId === clienteId).length;

        container.innerHTML += `
            <div class="cliente-card" onclick="abrirModalCliente('${cliente.id}')" style="cursor:pointer; animation: fadeSlideUp 0.4s ease forwards ${index * 0.05}s; opacity:0;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="cliente-nome">${cliente.nome}</span>
                    <span style="color: var(--gold); font-weight: 700; font-size: 0.9rem; background: rgba(212, 175, 55, 0.1); padding: 4px 10px; border-radius: 12px; border: 1px solid rgba(212, 175, 55, 0.3);">${qtdeOS} OS(s)</span>
                </div>
            </div>`;
    });
}

// --- FATURAMENTO MENSAL ---
let graficoFaturamento = null;
const nomesMesesLista = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function popularSelectMesesFaturamento() {
    const select = document.getElementById('filtro-mes-faturamento');
    let periodos = new Set();
    const hoje = new Date(); const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0'); const anoAtual = hoje.getFullYear();
    periodos.add(`${anoAtual}-${mesAtual}`);
    servicos.forEach(s => { if(s.dataEntrega) { const partes = s.dataEntrega.split('-'); if(partes.length >= 2) { periodos.add(`${partes[0]}-${partes[1]}`); } } });
    const periodosOrdenados = Array.from(periodos).sort((a, b) => b.localeCompare(a));
    let html = '';
    periodosOrdenados.forEach(p => { const [ano, mes] = p.split('-'); const nomeMes = nomesMesesLista[parseInt(mes) - 1]; html += `<option value="${p}" style="background: #111;">${nomeMes}/${ano}</option>`; });
    select.innerHTML = html; select.value = `${anoAtual}-${mesAtual}`;
}

function renderizarFaturamento() {
    const inputMes = document.getElementById('filtro-mes-faturamento').value;
    if (!inputMes) return;
    const servicosMes = servicos.filter(s => s.dataEntrega && s.dataEntrega.startsWith(inputMes));
    const totalMes = servicosMes.reduce((acc, s) => acc + s.total, 0);
    document.getElementById('total-faturamento-mes').innerText = formatarMoeda(totalMes);

    const faturamentoPorDia = {};
    servicosMes.forEach(s => { const dia = s.dataEntrega.split('-')[2]; faturamentoPorDia[dia] = (faturamentoPorDia[dia] || 0) + s.total; });
    const diasOrdenados = Object.keys(faturamentoPorDia).sort((a, b) => parseInt(a) - parseInt(b));
    const labels = diasOrdenados.map(dia => `${dia}/${inputMes.split('-')[1]}`);
    const dataValores = diasOrdenados.map(dia => faturamentoPorDia[dia]);
    desenharGrafico(labels, dataValores);
}

function desenharGrafico(labels, data) {
    const ctx = document.getElementById('chart-faturamento').getContext('2d');
    if (graficoFaturamento) graficoFaturamento.destroy();
    Chart.defaults.color = '#A1A1AA';
    graficoFaturamento = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Faturamento Diário', data: data, backgroundColor: '#D4AF37', borderRadius: 6, borderWidth: 0, hoverBackgroundColor: '#F3E5AB' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } }, x: { grid: { display: false } } } } });
}

// --- EXIBIÇÃO DE MODAIS ---
function abrirModalOS(id) {
    const serv = servicos.find(s => s.id === id);
    const cli = clientes.find(c => c.id === serv.clienteId) || { nome: 'Desconhecido', telefone: '-' };
    
    let html = `
        <div class="os-detalhe-header">
            <h3>Gold AFIAÇÕES</h3>
            <p style="color: var(--gold); font-size: 1.1rem; font-weight: 800; margin-top: 5px;">OS #${serv.osNumero}</p>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 5px; text-transform: uppercase; letter-spacing: 2px;">Recibo de Serviço</p>
        </div>
        <div style="margin-bottom:24px;font-size:0.95rem; background: rgba(212, 175, 55, 0.05); border: 1px solid rgba(212, 175, 55, 0.2); padding: 16px; border-radius: 16px;">
            <p style="margin-bottom:8px; display:flex; justify-content:space-between;"><strong>Cliente:</strong> <span>${cli.nome}</span></p>
            <p style="display:flex; justify-content:space-between; color: var(--text-muted); margin-bottom:8px;"><strong>Emissão:</strong> <span>${serv.dataStr} às ${serv.horaStr}</span></p>
            <div style="height: 1px; background: rgba(255,255,255,0.1); margin: 8px 0;"></div>
            <p style="display:flex; justify-content:space-between; color: var(--text-main); margin-top:8px;"><strong>Coleta:</strong> <span>${formatarDataBR(serv.dataColeta)}</span></p>
            <p style="display:flex; justify-content:space-between; color: var(--gold); margin-top:8px;"><strong>Entrega:</strong> <span style="font-weight: bold;">${formatarDataBR(serv.dataEntrega)}</span></p>
        </div>
        <div class="os-detalhe-box">
            <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:15px; color:var(--gold); border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; font-size:0.8rem; text-transform:uppercase;">
                <span style="width:40px;">Qtd</span><span style="flex-grow:1;">Descrição</span><span>Total</span>
            </div>`;
    serv.itens.forEach(item => { html += `<div class="os-detalhe-item"><span style="width:40px; font-weight:600;">${item.qtdValor}</span><span style="flex-grow:1; color: var(--text-muted);">${item.nome}</span><span style="font-weight:700;">${formatarMoeda(item.valorTotal)}</span></div>`; });
    html += `</div>
    <div style="text-align:right;font-size:1.6rem;font-weight:800; margin-top:24px; margin-bottom: 30px;">TOTAL: <span style="color:var(--gold);">${formatarMoeda(serv.total)}</span></div>
    <div style="display: flex; flex-direction: column; gap: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
        <button class="btn-whatsapp" onclick="compartilharReciboWAPorId('${serv.id}')"><i class="ph-fill ph-whatsapp-logo" style="font-size: 1.4rem;"></i> Enviar no WhatsApp</button>
        <button class="btn" style="background: rgba(212, 175, 55, 0.1); border: 1px solid var(--gold); color: var(--gold); box-shadow: none;" onclick="gerarReciboPDFPorId('${serv.id}')"><i class="ph-bold ph-download-simple" style="font-size: 1.4rem;"></i> Baixar PDF</button>
    </div>`;
    
    document.getElementById('detalhes-os-conteudo').innerHTML = html;
    
    document.getElementById('modal-os').classList.add('active');
    document.body.style.overflow = 'hidden';
    toggleBackgroundScale(true);
}

function abrirModalCliente(id) {
    const cli = clientes.find(c => c.id === id);
    if(!cli) return;

    const historicoCli = servicos.filter(s => s.clienteId === id).sort((a, b) => b.timestamp - a.timestamp);
    let numeroLimpo = cli.telefone ? cli.telefone.replace(/\D/g, '') : '';
    if (numeroLimpo.length === 10 || numeroLimpo.length === 11) { numeroLimpo = '55' + numeroLimpo; }
    
    let btnWa = numeroLimpo ? `<a href="https://wa.me/${numeroLimpo}" target="_blank" class="btn-whatsapp"><i class="ph-fill ph-whatsapp-logo" style="font-size: 1.6rem;"></i> Chamar no WhatsApp</a>` : `<button class="btn" style="background: var(--bg-surface); color: var(--text-muted); margin-bottom: 12px;" disabled>Telefone não cadastrado</button>`;
    
    let enderecoCompleto = cli.endereco ? cli.endereco : '';
    if(cli.cidade) enderecoCompleto += enderecoCompleto ? ` - ${cli.cidade}` : cli.cidade;
    
    let btnLocation = enderecoCompleto ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}" target="_blank" class="btn-localizacao"><i class="ph-fill ph-map-pin" style="font-size: 1.4rem;"></i> Ver no Mapa</a>` : `<button class="btn-localizacao" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); cursor: not-allowed;" disabled>Endereço não cadastrado</button>`;

    let htmlHistorico = '<h4 style="color: var(--gold); margin-bottom: 16px; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;"><i class="ph-duotone ph-clock-counter-clockwise"></i> Histórico do Cliente</h4>';
    if (historicoCli.length === 0) { htmlHistorico += '<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 20px; background: rgba(255,255,255,0.02); border-radius: 16px;">Nenhum serviço registrado.</p>'; } else {
        htmlHistorico += '<div style="display: flex; flex-direction: column; gap: 12px;">';
        historicoCli.forEach(serv => {
            htmlHistorico += `
                <div class="cliente-card" onclick="abrirModalOS('${serv.id}')" style="margin-bottom: 0; background: rgba(255,255,255,0.02);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight: 800; color: var(--gold); font-size: 1.1rem;">OS #${serv.osNumero}</span>
                        <span style="font-weight: 600; color: var(--text-main);">${serv.dataStr}</span>
                    </div>
                    <div style="height: 1px; background: rgba(255,255,255,0.05); margin: 8px 0;"></div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                        <span>Coleta: ${formatarDataBR(serv.dataColeta)}</span>
                        <span style="color:var(--text-main); font-weight: 800; font-size: 1.05rem;">${formatarMoeda(serv.total)}</span>
                    </div>
                </div>`;
        });
        htmlHistorico += '</div>';
    }

    let html = `
        <div style="margin-bottom:24px; text-align:center;">
            <h2 style="justify-content: center; margin-bottom: 8px; font-size: 1.8rem; color: var(--text-main);">${cli.nome}</h2>
            <p style="color: var(--text-muted); font-size: 0.95rem;">${enderecoCompleto || 'Endereço não informado'}</p>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 5px;"><i class="ph-fill ph-arrows-clockwise" style="color: var(--gold);"></i> Ciclo: ${cli.retornoDias} dias</p>
        </div>
        ${btnWa}${btnLocation}${htmlHistorico}
    `;

    document.getElementById('detalhes-cliente-conteudo').innerHTML = html;
    
    document.getElementById('modal-cliente').classList.add('active');
    document.body.style.overflow = 'hidden';
    toggleBackgroundScale(true); 
}

function obterStatusClientes() {
    const agora = new Date().getTime(); 
    let listaStatus = [];
    clientes.forEach(cliente => { 
        const servsCli = servicos.filter(s => s.clienteId === cliente.id); 
        if (servsCli.length > 0) { 
            const dataBase = Math.max(...servsCli.map(s => s.timestamp)); 
            const vencimento = dataBase + (cliente.retornoDias * 24 * 60 * 60 * 1000); 
            const diasRestantes = Math.ceil((vencimento - agora) / (1000 * 60 * 60 * 24)); 
            listaStatus.push({ cliente, diasRestantes, vencimento }); 
        } 
    });
    return listaStatus;
}

function atualizarSinoNotificacoes() {
    const status = obterStatusClientes();
    const atrasados = status.filter(s => s.diasRestantes <= 5 && !s.cliente.oculto).length;
    const badge = document.getElementById('notificacao-badge');
    badge.innerText = atrasados; badge.style.display = atrasados > 0 ? 'flex' : 'none';
}

function abrirTelaNotificacoes() {
    if(document.getElementById('sec-notificacoes').style.display !== 'block' && document.getElementById('sec-notificacoes').className.indexOf('active') === -1) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active')); mudarAba('sec-notificacoes', null);
    }
    
    const listaHtml = document.getElementById('lista-tela-notificacoes'); listaHtml.innerHTML = '';
    let statusClientes = obterStatusClientes().sort((a, b) => a.diasRestantes - b.diasRestantes);
    
    if (statusClientes.length === 0) { return listaHtml.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 30px;">Nenhum histórico de afiação.</p>'; }

    const termoCidade = document.getElementById('filtro-cidade')?.value || ''; 
    const termoStatus = document.getElementById('filtro-status')?.value || 'todos';
    
    let contagemVisivel = 0;

    statusClientes.forEach((item, index) => {
        if (item.cliente.oculto) return; 
        
        const cidadeCli = item.cliente.cidade ? item.cliente.cidade.trim() : ''; 
        if (termoCidade && cidadeCli !== termoCidade) return;
        
        let corClasse, corTexto, icon, textoDias;

        if (item.diasRestantes >= 16) { corClasse = 'status-longe'; corTexto = 'var(--success)'; icon = 'ph-check-circle'; textoDias = `Faltam ${item.diasRestantes} dias`; } 
        else if (item.diasRestantes >= 6 && item.diasRestantes <= 15) { corClasse = 'status-perto'; corTexto = 'var(--warning)'; icon = 'ph-warning'; textoDias = `Faltam ${item.diasRestantes} dias`; } 
        else { corClasse = 'status-atrasado'; corTexto = 'var(--danger)'; icon = 'ph-warning-circle'; textoDias = item.diasRestantes <= 0 ? 'ATRASADO/HOJE' : `Faltam ${item.diasRestantes} dias`; }

        if(termoStatus === 'longe' && item.diasRestantes < 16) return; 
        if(termoStatus === 'perto' && (item.diasRestantes < 6 || item.diasRestantes > 15)) return; 
        if(termoStatus === 'atrasado' && item.diasRestantes > 5) return;
        
        contagemVisivel++;
        listaHtml.innerHTML += `
            <div class="swipe-container" style="animation: fadeSlideUp 0.4s ease forwards ${index * 0.05}s; opacity:0;">
                <div class="cliente-card swipe-card ${corClasse}" style="margin-bottom: 0; display:flex; flex-direction:column; justify-content:center;">
                    <div style="display:flex; justify-content: space-between; align-items: center; width: 100%;">
                        <div style="flex: 1;">
                            <div class="cliente-info" style="margin-bottom: 8px;"><span class="cliente-nome" style="color: var(--text-main); font-size:1.1rem;">${item.cliente.nome}</span></div>
                            <div class="cliente-info" style="font-size:0.85rem; flex-direction: column; align-items: flex-start; gap: 4px;">
                                <strong style="color: ${corTexto}; background: rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 12px; display:flex; gap:5px;"><i class="ph-fill ${icon}"></i> ${textoDias}</strong>
                                <span><i class="ph ph-map-pin"></i> ${cidadeCli || 'Sem Endereço'}</span>
                                <span><i class="ph ph-calendar-blank"></i> Est.: <strong style="color:var(--text-main); margin-left: 5px;">${new Date(item.vencimento).toLocaleDateString('pt-BR')}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="swipe-actions" style="width: 85px;">
                    <button class="swipe-btn" style="background: var(--danger);" onclick="excluirNotificacao('${item.cliente.id}')"><i class="ph-bold ph-trash" style="font-size: 1.4rem;"></i> Excluir</button>
                </div>
            </div>`;
    });
    if(contagemVisivel === 0) { listaHtml.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 30px;">Nenhuma notificação encontrada com os filtros atuais.</p>'; }
}

function excluirNotificacao(id) {
    customConfirm("Excluir Notificação?", "Aviso removido do painel até o próximo serviço do cliente.", async () => {
        await supabaseClient.from('clientes').update({ oculto: true }).eq('id', id);
        await carregarDadosDoSupabase();
        abrirTelaNotificacoes(); atualizarSinoNotificacoes();
    });
}

function fecharModal(idModal) { 
    document.getElementById(idModal).classList.remove('active'); 
    if(!document.querySelector('.modal-overlay.active')) {
        document.body.style.overflow = 'auto';
        toggleBackgroundScale(false);
    }
}

function fecharModalFora(event) { 
    if (event.target.id === 'modal-os') fecharModal('modal-os'); 
    if (event.target.id === 'modal-cliente') fecharModal('modal-cliente'); 
    if (event.target.id === 'modal-editar') fecharModal('modal-editar'); 
    if (event.target.id === 'modal-confirm') fecharConfirm();
    if (event.target.id === 'modal-sucesso-os') fecharModalSucesso();
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
});

let touchstartX = 0;
let touchendX = 0;
const abasOrdem = ['sec-servico', 'sec-agendamento', 'sec-clientes', 'sec-historico', 'sec-faturamento'];
const botoesMenu = document.querySelectorAll('.nav-item');

function processarArraste() {
    const distanciaMinima = 60; 
    const diferenca = touchstartX - touchendX;
    
    if (Math.abs(diferenca) < distanciaMinima) return;

    const indexAtual = abasOrdem.findIndex(id => document.getElementById(id).classList.contains('active'));
    if (indexAtual === -1) return;

    if (diferenca > 0) {
        if (indexAtual < abasOrdem.length - 1) {
            mudarAba(abasOrdem[indexAtual + 1], botoesMenu[indexAtual + 1]);
        }
    } else {
        if (indexAtual > 0) {
            mudarAba(abasOrdem[indexAtual - 1], botoesMenu[indexAtual - 1]);
        }
    }
}

document.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX;
}, { passive: true });

document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    const clicouNoCard = e.target.closest('.swipe-container') || e.target.closest('.modal-content');
    
    if (!clicouNoCard) { processarArraste(); }
}, { passive: true });