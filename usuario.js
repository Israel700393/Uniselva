// Sistema de Chamados - Área do Usuário
class UsuarioSystem {
    constructor() {
        this.usuarioAtual = JSON.parse(localStorage.getItem('npd_usuario_atual'));
        this.chamados = JSON.parse(localStorage.getItem('npd_chamados')) || [];
        this.chamadoAtual = null;
        this.tema = localStorage.getItem('npd_tema') || 'light';
        
        // SEGURANÇA: Verificar autenticação e tipo de usuário
        if (!this.verificarAutenticacao()) {
            window.location.replace('index.html');
            return;
        }
        
        // SEGURANÇA: Bloquear acesso de admin
        if (this.usuarioAtual.tipo === 'admin') {
            window.location.replace('admin.html');
            return;
        }
        
        // SEGURANÇA: Proteger localStorage contra modificações
        this.protegerDados();
        
        this.init();
    }

    verificarAutenticacao() {
        if (!this.usuarioAtual) return false;
        
        // Verificar se o usuário existe na lista de usuários
        const usuarios = JSON.parse(localStorage.getItem('npd_usuarios')) || [];
        const usuarioValido = usuarios.find(u => 
            u.id === this.usuarioAtual.id && 
            u.email === this.usuarioAtual.email &&
            u.tipo === this.usuarioAtual.tipo
        );
        
        return !!usuarioValido;
    }

    protegerDados() {
        // SEGURANÇA: Monitorar mudanças no localStorage
        const originalSetItem = localStorage.setItem;
        const self = this;
        
        localStorage.setItem = function(key, value) {
            // Bloquear tentativas de alterar tipo de usuário
            if (key === 'npd_usuario_atual') {
                try {
                    const dados = JSON.parse(value);
                    if (dados.tipo !== self.usuarioAtual.tipo) {
                        console.error('🚫 TENTATIVA DE ALTERAÇÃO BLOQUEADA!');
                        window.location.replace('login.html');
                        return;
                    }
                } catch (e) {}
            }
            originalSetItem.call(localStorage, key, value);
        };
    }

    // Impedir navegação de volta após logout
    impedirVoltarAposLogout() {
        // Adicionar estado ao histórico
        window.history.pushState(null, '', window.location.href);
        
        // Interceptar tentativas de voltar
        const self = this;
        window.addEventListener('popstate', function(event) {
            const usuarioAtual = localStorage.getItem('npd_usuario_atual');
            if (!usuarioAtual) {
                // Sem sessão: forçar permanência no login
                window.history.pushState(null, '', window.location.href);
                window.location.replace('login.html');
            } else {
                // Com sessão: bloquear voltar
                window.history.pushState(null, '', window.location.href);
            }
        });
    }

    init() {
        this.aplicarTema();
        this.setupEventListeners();
        this.impedirVoltarAposLogout();
        document.getElementById('userName').textContent = this.usuarioAtual.nome;
        this.carregarMeusChamados();
    }

    aplicarTema() {
        document.documentElement.setAttribute('data-theme', this.tema);
        document.body.setAttribute('data-theme', this.tema);
        const icone = document.querySelector('.theme-icon');
        if (icone) icone.textContent = this.tema === 'light' ? '🌙' : '☀️';
    }

    setupEventListeners() {
        // Logout
        document.getElementById('btnLogout').addEventListener('click', () => this.logout());

        // Tema
        document.getElementById('btnThemeToggle').addEventListener('click', () => this.alternarTema());

        // Navegação
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.navegar(view, e.currentTarget);
            });
        });

        // Novo Chamado
        document.getElementById('formNovoChamado').addEventListener('submit', (e) => {
            e.preventDefault();
            this.criarChamado();
        });

        // Filtros
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filtrarChamados(e.currentTarget.dataset.status, e.currentTarget);
            });
        });

        // Modal
        document.querySelector('.modal-close').addEventListener('click', () => this.fecharModal());
        document.getElementById('modalChamado').addEventListener('click', (e) => {
            if (e.target.id === 'modalChamado') this.fecharModal();
        });

        // Chat
        document.getElementById('chatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.enviarMensagem();
        });
    }

    alternarTema() {
        this.tema = this.tema === 'light' ? 'dark' : 'light';
        localStorage.setItem('npd_tema', this.tema);
        this.aplicarTema();
    }

    logout() {
        // Limpar sessão completamente
        localStorage.removeItem('npd_usuario_atual');
        
        // Redirecionar imediatamente
        window.location.replace('index.html');
    }

    navegar(view, btnElement) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        const viewMap = {
            'meus-chamados': 'viewMeusChamados',
            'novo-chamado': 'viewNovoChamado',
            'historico': 'viewHistorico'
        };

        document.getElementById(viewMap[view]).classList.add('active');

        if (view === 'meus-chamados') this.carregarMeusChamados();
        else if (view === 'historico') this.carregarHistorico();
    }

    criarChamado() {
        const titulo = document.getElementById('chamadoTitulo').value;
        const categoria = document.getElementById('chamadoCategoria').value;
        const descricao = document.getElementById('chamadoDescricao').value;

        const novoChamado = {
            id: Date.now(),
            titulo,
            categoria,
            prioridade: 'media',
            descricao,
            status: 'aberto',
            usuarioId: this.usuarioAtual.id,
            usuarioNome: this.usuarioAtual.nome,
            usuarioSetor: this.usuarioAtual.setor,
            dataAbertura: new Date().toISOString(),
            dataAtualizacao: new Date().toISOString(),
            dataResolucao: null,
            mensagens: []
        };

        this.chamados.push(novoChamado);
        this.salvarChamados();

        this.mostrarToast('✅ Chamado aberto com sucesso! A prioridade será definida pelo NPD.', 'success');
        document.getElementById('formNovoChamado').reset();
        
        setTimeout(() => {
            document.querySelector('.nav-item[data-view="meus-chamados"]').click();
        }, 1000);
    }

    carregarMeusChamados() {
        const meusChamados = this.chamados.filter(c => c.usuarioId === this.usuarioAtual.id);
        this.renderizarChamados(meusChamados, 'listaChamados');
    }

    carregarHistorico() {
        const historico = this.chamados
            .filter(c => c.usuarioId === this.usuarioAtual.id)
            .sort((a, b) => new Date(b.dataAbertura) - new Date(a.dataAbertura));
        this.renderizarChamados(historico, 'listaHistorico');
    }

    renderizarChamados(chamados, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (chamados.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">Nenhum chamado encontrado</div>
                </div>
            `;
            return;
        }

        container.innerHTML = chamados.map(chamado => `
            <div class="chamado-card prioridade-${chamado.prioridade}" onclick="usuario.abrirChamado(${chamado.id})">
                <div class="chamado-header">
                    <div>
                        <div class="chamado-title">${this.escapeHtml(chamado.titulo)}</div>
                    </div>
                    <span class="chamado-status status-${chamado.status}">
                        ${this.getStatusTexto(chamado.status)}
                    </span>
                </div>
                <div class="chamado-info">
                    <div class="chamado-meta">📁 ${this.escapeHtml(chamado.categoria)}</div>
                    <div class="chamado-meta">🔥 ${this.getPrioridadeTexto(chamado.prioridade)}</div>
                    <div class="chamado-meta">📅 ${this.formatarData(chamado.dataAbertura)}</div>
                    ${chamado.mensagens.length > 0 ? `
                        <div class="chamado-meta">💬 ${chamado.mensagens.length} ${chamado.mensagens.length === 1 ? 'mensagem' : 'mensagens'}</div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    abrirChamado(chamadoId) {
        this.chamadoAtual = this.chamados.find(c => c.id === chamadoId);
        if (!this.chamadoAtual) return;

        const detalhesHtml = `
            <div class="chamado-detalhes-header">
                <h2 class="chamado-detalhes-title">${this.escapeHtml(this.chamadoAtual.titulo)}</h2>
                <div class="chamado-detalhes-info">
                    <div class="info-item">
                        <div class="info-label">Status</div>
                        <div class="info-value">
                            <span class="chamado-status status-${this.chamadoAtual.status}">
                                ${this.getStatusTexto(this.chamadoAtual.status)}
                            </span>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Categoria</div>
                        <div class="info-value">${this.escapeHtml(this.chamadoAtual.categoria)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Prioridade</div>
                        <div class="info-value">${this.getPrioridadeTexto(this.chamadoAtual.prioridade)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Data de Abertura</div>
                        <div class="info-value">${this.formatarDataCompleta(this.chamadoAtual.dataAbertura)}</div>
                    </div>
                </div>
            </div>
            <div class="chamado-descricao">
                <h3>Descrição</h3>
                <p>${this.escapeHtml(this.chamadoAtual.descricao)}</p>
            </div>
        `;

        document.getElementById('chamadoDetalhes').innerHTML = detalhesHtml;
        this.carregarChat();
        document.getElementById('modalChamado').classList.add('active');
    }

    carregarChat() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer || !this.chamadoAtual) return;

        if (this.chamadoAtual.mensagens.length === 0) {
            chatContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💬</div>
                    <div class="empty-state-text">Nenhuma mensagem ainda.<br>Inicie a conversa!</div>
                </div>
            `;
            return;
        }

        chatContainer.innerHTML = this.chamadoAtual.mensagens.map(msg => `
            <div class="chat-message ${msg.tipo}">
                <div class="chat-message-header">
                    <span class="chat-author">${this.escapeHtml(msg.autor)}</span>
                    <span class="chat-time">${this.formatarDataHora(msg.data)}</span>
                </div>
                <div class="chat-text">${this.escapeHtml(msg.texto)}</div>
            </div>
        `).join('');

        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);
    }

    enviarMensagem() {
        const input = document.getElementById('chatInput');
        const texto = input.value.trim();

        if (!texto || !this.chamadoAtual) return;

        const novaMensagem = {
            id: Date.now(),
            autor: this.usuarioAtual.nome,
            tipo: 'user',
            texto,
            data: new Date().toISOString()
        };

        this.chamadoAtual.mensagens.push(novaMensagem);
        this.chamadoAtual.dataAtualizacao = new Date().toISOString();
        this.salvarChamados();

        input.value = '';
        this.carregarChat();
    }

    filtrarChamados(status, btnElement) {
        btnElement.parentElement.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        btnElement.classList.add('active');

        let chamados = this.chamados.filter(c => c.usuarioId === this.usuarioAtual.id);

        if (status !== 'todos') {
            chamados = chamados.filter(c => c.status === status);
        }

        chamados.sort((a, b) => new Date(b.dataAbertura) - new Date(a.dataAbertura));
        this.renderizarChamados(chamados, 'listaChamados');
    }

    fecharModal() {
        document.getElementById('modalChamado').classList.remove('active');
        this.chamadoAtual = null;
    }

    // Utilitários
    getStatusTexto(status) {
        const textos = { 'aberto': 'Aberto', 'em_andamento': 'Em Andamento', 'resolvido': 'Resolvido' };
        return textos[status] || status;
    }

    getPrioridadeTexto(prioridade) {
        const textos = { 'baixa': 'Baixa', 'media': 'Média', 'alta': 'Alta', 'urgente': 'Urgente' };
        return textos[prioridade] || prioridade;
    }

    formatarData(dataISO) {
        return new Date(dataISO).toLocaleDateString('pt-BR');
    }

    formatarDataCompleta(dataISO) {
        return new Date(dataISO).toLocaleString('pt-BR');
    }

    formatarDataHora(dataISO) {
        return new Date(dataISO).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    salvarChamados() {
        localStorage.setItem('npd_chamados', JSON.stringify(this.chamados));
    }

    mostrarToast(mensagem, tipo = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = mensagem;
        toast.className = `toast ${tipo}`;
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

// Inicializar
const usuario = new UsuarioSystem();



