// Sistema de Chamados - Área Administrativa NPD
class AdminSystem {
    constructor() {
        this.usuarioAtual = JSON.parse(localStorage.getItem('npd_usuario_atual'));
        this.usuarios = JSON.parse(localStorage.getItem('npd_usuarios')) || [];
        this.chamados = JSON.parse(localStorage.getItem('npd_chamados')) || [];
        this.chamadoAtual = null;
        this.periodoRelatorio = 'semanal';
        this.tema = localStorage.getItem('npd_tema') || 'light';
        
        // SEGURANÇA: Verificar autenticação e permissões de admin
        if (!this.verificarAutenticacaoAdmin()) {
            this.logout();
            return;
        }
        
        // SEGURANÇA: Proteger dados contra modificações não autorizadas
        this.protegerDadosAdmin();
        
        this.init();
    }

    verificarAutenticacaoAdmin() {
        if (!this.usuarioAtual) return false;
        if (this.usuarioAtual.tipo !== 'admin') return false;
        
        // Verificar se o admin existe na lista de usuários
        const usuarioValido = this.usuarios.find(u => 
            u.id === this.usuarioAtual.id && 
            u.email === this.usuarioAtual.email &&
            u.tipo === 'admin'
        );
        
        return !!usuarioValido;
    }

    // Impedir navegação de volta após logout
    impedirVoltarAposLogout() {
        // Adicionar estado ao histórico
        window.history.pushState(null, '', window.location.href);
        
        // Interceptar tentativas de voltar
        window.addEventListener('popstate', function(event) {
            const usuarioAtual = JSON.parse(localStorage.getItem('npd_usuario_atual'));
            if (!usuarioAtual || usuarioAtual.tipo !== 'admin') {
                // Sem sessão válida: forçar permanência no login
                window.history.pushState(null, '', window.location.href);
                window.location.replace('login.html');
            } else {
                // Com sessão: bloquear voltar
                window.history.pushState(null, '', window.location.href);
            }
        });
        
        // Bloquear também o evento beforeunload
        window.addEventListener('beforeunload', function(event) {
            const usuarioAtual = JSON.parse(localStorage.getItem('npd_usuario_atual'));
            if (!usuarioAtual || usuarioAtual.tipo !== 'admin') {
                window.history.pushState(null, '', window.location.href);
            }
        });
    }

    protegerDadosAdmin() {
        // SEGURANÇA: Monitorar tentativas de modificação
        const self = this;
        const originalSetItem = localStorage.setItem;
        
        localStorage.setItem = function(key, value) {
            // Validar modificações em dados críticos
            if (key === 'npd_usuarios') {
                try {
                    const usuarios = JSON.parse(value);
                    // Garantir que sempre existe pelo menos um admin
                    const temAdmin = usuarios.some(u => u.tipo === 'admin');
                    if (!temAdmin) {
                        console.error('🚫 BLOQUEADO: Tentativa de remover todos os admins!');
                        return;
                    }
                } catch (e) {}
            }
            originalSetItem.call(localStorage, key, value);
        };
    }

    init() {
        this.aplicarTema();
        this.setupEventListeners();
        this.impedirVoltarAposLogout();
        document.getElementById('adminName').textContent = this.usuarioAtual.nome;
        this.carregarDashboard();
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

        // Filtros
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filtrarChamados(e.currentTarget.dataset.status, e.currentTarget);
            });
        });

        // Período Relatório
        document.querySelectorAll('.periodo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.alterarPeriodoRelatorio(e.currentTarget.dataset.periodo, e.currentTarget);
            });
        });

        // Adicionar Usuário
        document.getElementById('btnAddUser').addEventListener('click', () => this.abrirModalAddUser());
        document.getElementById('formAddUser').addEventListener('submit', (e) => {
            e.preventDefault();
            this.cadastrarUsuarioAdmin();
        });

        // Editar Usuário
        document.getElementById('formEditUser').addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarEdicaoUsuario();
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
        
        // Limpar todo o histórico
        window.history.go(-(window.history.length - 1));
        
        // Aguardar um momento e redirecionar
        setTimeout(() => {
            window.location.replace('login.html');
        }, 100);
    }

    navegar(view, btnElement) {
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

        const viewMap = {
            'dashboard': 'viewDashboard',
            'todos-chamados': 'viewTodosChamados',
            'usuarios': 'viewUsuarios',
            'relatorios': 'viewRelatorios'
        };

        document.getElementById(viewMap[view]).classList.add('active');

        if (view === 'dashboard') this.carregarDashboard();
        else if (view === 'todos-chamados') this.carregarTodosChamados();
        else if (view === 'usuarios') this.carregarUsuarios();
        else if (view === 'relatorios') this.carregarRelatorios();
    }

    carregarDashboard() {
        document.getElementById('statTotal').textContent = this.chamados.length;
        document.getElementById('statAbertos').textContent = this.chamados.filter(c => c.status === 'aberto').length;
        document.getElementById('statAndamento').textContent = this.chamados.filter(c => c.status === 'em_andamento').length;
        document.getElementById('statResolvidos').textContent = this.chamados.filter(c => c.status === 'resolvido').length;

        const recentes = this.chamados
            .sort((a, b) => new Date(b.dataAbertura) - new Date(a.dataAbertura))
            .slice(0, 5);
        this.renderizarChamados(recentes, 'recentChamados', true);
    }

    carregarTodosChamados() {
        const chamadosOrdenados = [...this.chamados].sort((a, b) => 
            new Date(b.dataAbertura) - new Date(a.dataAbertura)
        );
        this.renderizarChamados(chamadosOrdenados, 'adminListaChamados', true);
    }

    renderizarChamados(chamados, containerId, isAdmin = false) {
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
            <div class="chamado-card prioridade-${chamado.prioridade}" onclick="admin.abrirChamado(${chamado.id})">
                <div class="chamado-header">
                    <div>
                        <div class="chamado-title">${this.escapeHtml(chamado.titulo)}</div>
                        ${isAdmin ? `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem; font-weight: 500;">
                            👤 ${this.escapeHtml(chamado.usuarioNome)} - ${this.escapeHtml(chamado.usuarioSetor)}
                        </div>` : ''}
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
                    <div class="info-item">
                        <div class="info-label">Usuário</div>
                        <div class="info-value">${this.escapeHtml(this.chamadoAtual.usuarioNome)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Setor</div>
                        <div class="info-value">${this.escapeHtml(this.chamadoAtual.usuarioSetor)}</div>
                    </div>
                </div>
            </div>
            <div class="chamado-descricao">
                <h3>Descrição</h3>
                <p>${this.escapeHtml(this.chamadoAtual.descricao)}</p>
            </div>
            ${this.renderizarAcoesAdmin()}
        `;

        document.getElementById('chamadoDetalhes').innerHTML = detalhesHtml;
        this.carregarChat();
        document.getElementById('modalChamado').classList.add('active');
    }

    renderizarAcoesAdmin() {
        const status = this.chamadoAtual.status;
        const prioridade = this.chamadoAtual.prioridade;
        
        let acoes = '';

        if (status === 'aberto') {
            acoes = `
                <button class="btn-action andamento" onclick="admin.alterarStatus('em_andamento')">
                    ⏳ Colocar em Andamento
                </button>
                <button class="btn-action resolver" onclick="admin.alterarStatus('resolvido')">
                    ✅ Resolver
                </button>
            `;
        } else if (status === 'em_andamento') {
            acoes = `
                <button class="btn-action resolver" onclick="admin.alterarStatus('resolvido')">
                    ✅ Resolver
                </button>
            `;
        } else if (status === 'resolvido') {
            acoes = `
                <button class="btn-action reabrir" onclick="admin.alterarStatus('aberto')">
                    🔄 Reabrir Chamado
                </button>
            `;
        }

        const prioridadeHtml = `
            <div class="admin-prioridade">
                <label>🔥 Definir Prioridade:</label>
                <select id="selectPrioridade" class="select-prioridade" onchange="admin.alterarPrioridade(this.value)">
                    <option value="baixa" ${prioridade === 'baixa' ? 'selected' : ''}>Baixa</option>
                    <option value="media" ${prioridade === 'media' ? 'selected' : ''}>Média</option>
                    <option value="alta" ${prioridade === 'alta' ? 'selected' : ''}>Alta</option>
                    <option value="urgente" ${prioridade === 'urgente' ? 'selected' : ''}>Urgente</option>
                </select>
            </div>
        `;

        return `
            ${prioridadeHtml}
            <div class="admin-actions">${acoes}</div>
        `;
    }

    alterarStatus(novoStatus) {
        if (!this.chamadoAtual) return;

        const statusAnterior = this.chamadoAtual.status;
        this.chamadoAtual.status = novoStatus;
        this.chamadoAtual.dataAtualizacao = new Date().toISOString();

        if (novoStatus === 'resolvido') {
            this.chamadoAtual.dataResolucao = new Date().toISOString();
        }

        const mensagemAuto = {
            id: Date.now(),
            autor: this.usuarioAtual.nome,
            tipo: 'admin',
            texto: `Status alterado de "${this.getStatusTexto(statusAnterior)}" para "${this.getStatusTexto(novoStatus)}"`,
            data: new Date().toISOString(),
            automatica: true
        };
        this.chamadoAtual.mensagens.push(mensagemAuto);

        this.salvarChamados();
        this.abrirChamado(this.chamadoAtual.id);
        this.carregarDashboard();
    }

    alterarPrioridade(novaPrioridade) {
        if (!this.chamadoAtual) return;

        const prioridadeAnterior = this.chamadoAtual.prioridade;
        
        if (prioridadeAnterior === novaPrioridade) return;

        this.chamadoAtual.prioridade = novaPrioridade;
        this.chamadoAtual.dataAtualizacao = new Date().toISOString();

        const mensagemAuto = {
            id: Date.now(),
            autor: this.usuarioAtual.nome,
            tipo: 'admin',
            texto: `Prioridade alterada de "${this.getPrioridadeTexto(prioridadeAnterior)}" para "${this.getPrioridadeTexto(novaPrioridade)}"`,
            data: new Date().toISOString(),
            automatica: true
        };
        this.chamadoAtual.mensagens.push(mensagemAuto);

        this.salvarChamados();
        this.mostrarToast(`🔥 Prioridade alterada para ${this.getPrioridadeTexto(novaPrioridade)}`, 'info');
        this.carregarChat();
        this.carregarDashboard();
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
            tipo: 'admin',
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

        let chamados = [...this.chamados];

        if (status !== 'todos') {
            chamados = chamados.filter(c => c.status === status);
        }

        chamados.sort((a, b) => new Date(b.dataAbertura) - new Date(a.dataAbertura));
        this.renderizarChamados(chamados, 'adminListaChamados', true);
    }

    fecharModal() {
        document.getElementById('modalChamado').classList.remove('active');
        this.chamadoAtual = null;
    }

    abrirModalAddUser() {
        document.getElementById('modalAddUser').classList.add('active');
    }

    fecharModalAddUser() {
        document.getElementById('modalAddUser').classList.remove('active');
        document.getElementById('formAddUser').reset();
    }

    cadastrarUsuarioAdmin() {
        const nome = document.getElementById('addUserNome').value.trim();
        const email = document.getElementById('addUserEmail').value.trim();
        const senha = document.getElementById('addUserSenha').value;
        const setor = document.getElementById('addUserSetor').value;
        const tipo = document.getElementById('addUserTipo').value;

        if (!nome || !email || !senha || !setor || !tipo) {
            this.mostrarToast('❌ Por favor, preencha todos os campos!', 'error');
            return;
        }

        if (senha.length < 6) {
            this.mostrarToast('❌ A senha deve ter no mínimo 6 caracteres!', 'error');
            return;
        }

        if (this.usuarios.find(u => u.email === email)) {
            this.mostrarToast('❌ Este email já está cadastrado!', 'error');
            return;
        }

        const novoUsuario = {
            id: Date.now(),
            nome,
            email,
            senha,
            setor,
            tipo,
            dataCriacao: new Date().toISOString()
        };

        this.usuarios.push(novoUsuario);
        this.salvarUsuarios();

        this.mostrarToast(`✅ Usuário ${tipo === 'admin' ? 'administrador' : ''} cadastrado com sucesso!`, 'success');
        this.fecharModalAddUser();
        this.carregarUsuarios();
    }

    carregarUsuarios() {
        const container = document.getElementById('listaUsuarios');
        if (!container) return;

        const todosUsuarios = this.usuarios.filter(u => u.id !== this.usuarioAtual.id);

        if (todosUsuarios.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-text">Nenhum usuário cadastrado</div>
                </div>
            `;
            return;
        }

        container.innerHTML = todosUsuarios.map(usuario => {
            const chamadosUsuario = this.chamados.filter(c => c.usuarioId === usuario.id);
            const podeExcluir = usuario.tipo !== 'admin' || this.usuarios.filter(u => u.tipo === 'admin').length > 1;
            
            return `
                <div class="usuario-card">
                    <div class="usuario-info">
                        <h3>${this.escapeHtml(usuario.nome)}</h3>
                        <p>📧 ${this.escapeHtml(usuario.email)}</p>
                        <p>🏢 ${this.escapeHtml(usuario.setor)}</p>
                        <p>📅 Cadastrado em: ${this.formatarData(usuario.dataCriacao)}</p>
                        <span class="usuario-badge ${usuario.tipo === 'admin' ? 'admin' : ''}">
                            ${usuario.tipo === 'admin' ? '👑 Administrador' : '👤 Usuário'}
                        </span>
                    </div>
                    <div style="text-align: center;">
                        <p style="font-weight: 700; color: var(--primary); font-size: 1.5rem;">
                            ${chamadosUsuario.length}
                        </p>
                        <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1rem;">
                            ${chamadosUsuario.length === 1 ? 'chamado' : 'chamados'}
                        </p>
                        <div class="usuario-actions">
                            <button class="btn-edit-user" onclick="admin.abrirModalEditUser(${usuario.id})" title="Editar usuário">
                                ✏️
                            </button>
                            ${podeExcluir ? `
                                <button class="btn-delete-user" onclick="admin.confirmarExclusaoUsuario(${usuario.id})" title="Excluir usuário">
                                    🗑️
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    abrirModalEditUser(userId) {
        const usuario = this.usuarios.find(u => u.id === userId);
        if (!usuario) return;

        document.getElementById('editUserId').value = usuario.id;
        document.getElementById('editUserNome').value = usuario.nome;
        document.getElementById('editUserEmail').value = usuario.email;
        document.getElementById('editUserSenha').value = '';
        document.getElementById('editUserSetor').value = usuario.setor;
        document.getElementById('editUserTipo').value = usuario.tipo;

        document.getElementById('modalEditUser').classList.add('active');
    }

    fecharModalEditUser() {
        document.getElementById('modalEditUser').classList.remove('active');
        document.getElementById('formEditUser').reset();
    }

    salvarEdicaoUsuario() {
        const userId = parseInt(document.getElementById('editUserId').value);
        const nome = document.getElementById('editUserNome').value.trim();
        const email = document.getElementById('editUserEmail').value.trim();
        const novaSenha = document.getElementById('editUserSenha').value;
        const setor = document.getElementById('editUserSetor').value;
        const tipo = document.getElementById('editUserTipo').value;

        if (!nome || !email || !setor || !tipo) {
            this.mostrarToast('❌ Por favor, preencha todos os campos!', 'error');
            return;
        }

        // SEGURANÇA: Verificar se email já existe em outro usuário
        const emailExiste = this.usuarios.find(u => u.email === email && u.id !== userId);
        if (emailExiste) {
            this.mostrarToast('❌ Este email já está cadastrado!', 'error');
            return;
        }

        // SEGURANÇA: Não permitir remover o último admin
        const usuario = this.usuarios.find(u => u.id === userId);
        if (usuario.tipo === 'admin' && tipo !== 'admin') {
            const adminsRestantes = this.usuarios.filter(u => u.tipo === 'admin' && u.id !== userId);
            if (adminsRestantes.length === 0) {
                this.mostrarToast('❌ Não é possível remover o último administrador!', 'error');
                return;
            }
        }

        // Atualizar usuário
        const index = this.usuarios.findIndex(u => u.id === userId);
        if (index !== -1) {
            this.usuarios[index].nome = nome;
            this.usuarios[index].email = email;
            if (novaSenha) {
                this.usuarios[index].senha = novaSenha;
            }
            this.usuarios[index].setor = setor;
            this.usuarios[index].tipo = tipo;

            this.salvarUsuarios();
            this.mostrarToast('✅ Usuário atualizado com sucesso!', 'success');
            this.fecharModalEditUser();
            this.carregarUsuarios();
        }
    }

    confirmarExclusaoUsuario(userId) {
        const usuario = this.usuarios.find(u => u.id === userId);
        if (!usuario) return;

        // SEGURANÇA: Não permitir excluir o último admin
        if (usuario.tipo === 'admin') {
            const adminsRestantes = this.usuarios.filter(u => u.tipo === 'admin' && u.id !== userId);
            if (adminsRestantes.length === 0) {
                this.mostrarToast('❌ Não é possível excluir o último administrador!', 'error');
                return;
            }
        }

        const confirmar = confirm(
            `⚠️ ATENÇÃO!\n\n` +
            `Deseja realmente excluir o usuário?\n\n` +
            `Nome: ${usuario.nome}\n` +
            `Email: ${usuario.email}\n\n` +
            `Esta ação não pode ser desfeita!`
        );

        if (confirmar) {
            this.excluirUsuario(userId);
        }
    }

    excluirUsuario(userId) {
        const usuario = this.usuarios.find(u => u.id === userId);
        if (!usuario) return;

        // Remover usuário
        this.usuarios = this.usuarios.filter(u => u.id !== userId);
        this.salvarUsuarios();

        // Remover chamados do usuário (opcional - você pode querer manter o histórico)
        // this.chamados = this.chamados.filter(c => c.usuarioId !== userId);
        // this.salvarChamados();

        this.mostrarToast(`✅ Usuário ${usuario.nome} excluído com sucesso!`, 'success');
        this.carregarUsuarios();
    }


    alterarPeriodoRelatorio(periodo, btnElement) {
        this.periodoRelatorio = periodo;
        
        btnElement.parentElement.querySelectorAll('.periodo-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        btnElement.classList.add('active');
        
        this.carregarRelatorios();
    }

    carregarRelatorios() {
        const agora = new Date();
        let dataInicio;

        switch (this.periodoRelatorio) {
            case 'semanal':
                dataInicio = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'mensal':
                dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
                break;
            case 'anual':
                dataInicio = new Date(agora.getFullYear(), 0, 1);
                break;
            default:
                dataInicio = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        const chamadosPeriodo = this.chamados.filter(c => 
            new Date(c.dataAbertura) >= dataInicio
        );

        const resolvidos = chamadosPeriodo.filter(c => c.status === 'resolvido');
        
        let tempoMedio = 0;
        if (resolvidos.length > 0) {
            const tempos = resolvidos
                .filter(c => c.dataResolucao)
                .map(c => {
                    const inicio = new Date(c.dataAbertura);
                    const fim = new Date(c.dataResolucao);
                    return (fim - inicio) / (1000 * 60 * 60);
                });
            
            if (tempos.length > 0) {
                tempoMedio = tempos.reduce((a, b) => a + b, 0) / tempos.length;
            }
        }

        const taxaResolucao = chamadosPeriodo.length > 0 
            ? ((resolvidos.length / chamadosPeriodo.length) * 100).toFixed(1)
            : 0;

        document.getElementById('relatorioTotal').textContent = chamadosPeriodo.length;
        document.getElementById('relatorioResolvidos').textContent = resolvidos.length;
        document.getElementById('relatorioTempo').textContent = tempoMedio.toFixed(1) + 'h';
        document.getElementById('relatorioTaxa').textContent = taxaResolucao + '%';

        this.renderizarGraficos(chamadosPeriodo, dataInicio);
    }

    renderizarGraficos(chamados, dataInicio) {
        // Gráfico por Categoria
        const categorias = {};
        chamados.forEach(c => {
            categorias[c.categoria] = (categorias[c.categoria] || 0) + 1;
        });

        const total = chamados.length || 1;
        const chartCategoria = document.getElementById('chartCategoria');
        
        if (Object.keys(categorias).length === 0) {
            chartCategoria.innerHTML = '<p style="text-align: center; color: var(--text-tertiary);">Sem dados</p>';
        } else {
            chartCategoria.innerHTML = Object.entries(categorias)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => `
                    <div style="margin-bottom: 1.25rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.625rem;">
                            <span style="font-weight: 600; color: var(--text-primary);">${this.escapeHtml(cat)}</span>
                            <strong style="color: var(--primary);">${count}</strong>
                        </div>
                        <div style="background: var(--bg-primary); height: 10px; border-radius: 5px; overflow: hidden;">
                            <div style="background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); height: 100%; width: ${(count / total) * 100}%; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                `).join('');
        }

        // Gráfico por Prioridade
        const prioridades = {};
        chamados.forEach(c => {
            prioridades[c.prioridade] = (prioridades[c.prioridade] || 0) + 1;
        });

        const chartPrioridade = document.getElementById('chartPrioridade');
        const cores = { 'baixa': '#64748b', 'media': '#f59e0b', 'alta': '#ef4444', 'urgente': '#dc2626' };
        const ordem = ['urgente', 'alta', 'media', 'baixa'];
        
        if (Object.keys(prioridades).length === 0) {
            chartPrioridade.innerHTML = '<p style="text-align: center; color: var(--text-tertiary);">Sem dados</p>';
        } else {
            chartPrioridade.innerHTML = ordem
                .filter(prior => prioridades[prior])
                .map(prior => {
                    const count = prioridades[prior];
                    return `
                        <div style="margin-bottom: 1.25rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.625rem;">
                                <span style="font-weight: 600; color: var(--text-primary);">${this.getPrioridadeTexto(prior)}</span>
                                <strong style="color: ${cores[prior]};">${count}</strong>
                            </div>
                            <div style="background: var(--bg-primary); height: 10px; border-radius: 5px; overflow: hidden;">
                                <div style="background: ${cores[prior]}; height: 100%; width: ${(count / total) * 100}%; transition: width 0.5s ease;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
        }

        // Gráfico por Status
        const status = {};
        chamados.forEach(c => {
            status[c.status] = (status[c.status] || 0) + 1;
        });

        const chartStatus = document.getElementById('chartStatus');
        const coresStatus = { 'aberto': '#3b82f6', 'em_andamento': '#f59e0b', 'resolvido': '#10b981' };

        if (Object.keys(status).length === 0) {
            chartStatus.innerHTML = '<p style="text-align: center; color: var(--text-tertiary);">Sem dados</p>';
        } else {
            chartStatus.innerHTML = Object.entries(status).map(([st, count]) => `
                <div style="margin-bottom: 1.25rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.625rem;">
                        <span style="font-weight: 600; color: var(--text-primary);">${this.getStatusTexto(st)}</span>
                        <strong style="color: ${coresStatus[st]};">${count}</strong>
                    </div>
                    <div style="background: var(--bg-primary); height: 10px; border-radius: 5px; overflow: hidden;">
                        <div style="background: ${coresStatus[st]}; height: 100%; width: ${(count / total) * 100}%; transition: width 0.5s ease;"></div>
                    </div>
                </div>
            `).join('');
        }

        // Gráfico de Evolução
        const chartEvolucao = document.getElementById('chartEvolucao');
        if (chamados.length === 0) {
            chartEvolucao.innerHTML = '<p style="text-align: center; color: var(--text-tertiary);">Sem dados</p>';
        } else {
            const porDia = {};
            chamados.forEach(c => {
                const data = new Date(c.dataAbertura).toLocaleDateString('pt-BR');
                porDia[data] = (porDia[data] || 0) + 1;
            });

            const maxCount = Math.max(...Object.values(porDia));

            chartEvolucao.innerHTML = Object.entries(porDia)
                .sort((a, b) => {
                    const [diaA, mesA, anoA] = a[0].split('/');
                    const [diaB, mesB, anoB] = b[0].split('/');
                    return new Date(anoA, mesA - 1, diaA) - new Date(anoB, mesB - 1, diaB);
                })
                .slice(-10)
                .map(([data, count]) => `
                    <div style="margin-bottom: 1.25rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.625rem;">
                            <span style="font-weight: 600; color: var(--text-primary);">${data}</span>
                            <strong style="color: var(--accent);">${count}</strong>
                        </div>
                        <div style="background: var(--bg-primary); height: 10px; border-radius: 5px; overflow: hidden;">
                            <div style="background: linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%); height: 100%; width: ${(count / maxCount) * 100}%; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                `).join('');
        }
    }

    exportarRelatorio() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const agora = new Date();
        const periodo = this.periodoRelatorio;
        
        // Obter dados do período
        let dataInicio;
        switch (periodo) {
            case 'semanal':
                dataInicio = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'mensal':
                dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
                break;
            case 'anual':
                dataInicio = new Date(agora.getFullYear(), 0, 1);
                break;
        }

        const chamadosPeriodo = this.chamados.filter(c => 
            new Date(c.dataAbertura) >= dataInicio
        );

        // Cores
        const azulPrimario = [59, 130, 246];
        const azulEscuro = [30, 64, 175];
        const cinza = [100, 116, 139];
        const verde = [16, 185, 129];
        const vermelho = [239, 68, 68];
        const laranja = [245, 158, 11];

        let yPos = 20;

        // CABEÇALHO
        doc.setFillColor(...azulPrimario);
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(undefined, 'bold');
        doc.text('🎓 Fundação Uniselva', 105, 15, { align: 'center' });
        
        doc.setFontSize(16);
        doc.text('Relatório de Chamados NPD', 105, 25, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Período: ${periodo.toUpperCase()}`, 105, 33, { align: 'center' });

        yPos = 50;

        // DATA DE GERAÇÃO
        doc.setTextColor(...cinza);
        doc.setFontSize(9);
        doc.text(`Gerado em: ${agora.toLocaleString('pt-BR')}`, 15, yPos);
        yPos += 10;

        // ESTATÍSTICAS GERAIS
        doc.setFillColor(240, 240, 245);
        doc.rect(15, yPos, 180, 8, 'F');
        
        doc.setTextColor(...azulEscuro);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('📊 ESTATÍSTICAS GERAIS', 20, yPos + 6);
        yPos += 15;

        const stats = {
            total: document.getElementById('relatorioTotal')?.textContent || '0',
            resolvidos: document.getElementById('relatorioResolvidos')?.textContent || '0',
            tempo: document.getElementById('relatorioTempo')?.textContent || '0h',
            taxa: document.getElementById('relatorioTaxa')?.textContent || '0%'
        };

        // Cards de estatísticas
        const cardWidth = 42;
        const cardHeight = 25;
        const startX = 15;
        const spacing = 3;

        const cards = [
            { label: 'Total', value: stats.total, color: azulPrimario },
            { label: 'Resolvidos', value: stats.resolvidos, color: verde },
            { label: 'Tempo Médio', value: stats.tempo, color: laranja },
            { label: 'Taxa Resolução', value: stats.taxa, color: azulEscuro }
        ];

        cards.forEach((card, index) => {
            const x = startX + (index * (cardWidth + spacing));
            
            doc.setFillColor(...card.color);
            doc.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.setFont(undefined, 'normal');
            doc.text(card.label, x + cardWidth/2, yPos + 8, { align: 'center' });
            
            doc.setFontSize(16);
            doc.setFont(undefined, 'bold');
            doc.text(card.value, x + cardWidth/2, yPos + 18, { align: 'center' });
        });

        yPos += 35;

        // CHAMADOS POR SETOR
        doc.setFillColor(240, 240, 245);
        doc.rect(15, yPos, 180, 8, 'F');
        
        doc.setTextColor(...azulEscuro);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('🏢 CHAMADOS POR SETOR', 20, yPos + 6);
        yPos += 12;

        const porSetor = {};
        chamadosPeriodo.forEach(c => {
            porSetor[c.usuarioSetor] = (porSetor[c.usuarioSetor] || 0) + 1;
        });

        doc.setTextColor(...cinza);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        Object.entries(porSetor)
            .sort((a, b) => b[1] - a[1])
            .forEach(([setor, count]) => {
                const percent = ((count / chamadosPeriodo.length) * 100).toFixed(1);
                doc.text(`${setor}:`, 20, yPos);
                doc.text(`${count} (${percent}%)`, 180, yPos, { align: 'right' });
                
                // Barra de progresso
                const barWidth = 150;
                const barHeight = 3;
                doc.setFillColor(220, 220, 230);
                doc.rect(20, yPos + 2, barWidth, barHeight, 'F');
                doc.setFillColor(...azulPrimario);
                doc.rect(20, yPos + 2, (count / chamadosPeriodo.length) * barWidth, barHeight, 'F');
                
                yPos += 10;
            });

        yPos += 5;

        // CHAMADOS POR CATEGORIA
        doc.setFillColor(240, 240, 245);
        doc.rect(15, yPos, 180, 8, 'F');
        
        doc.setTextColor(...azulEscuro);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('📁 CHAMADOS POR CATEGORIA', 20, yPos + 6);
        yPos += 12;

        const porCategoria = {};
        chamadosPeriodo.forEach(c => {
            porCategoria[c.categoria] = (porCategoria[c.categoria] || 0) + 1;
        });

        doc.setTextColor(...cinza);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        Object.entries(porCategoria)
            .sort((a, b) => b[1] - a[1])
            .forEach(([categoria, count]) => {
                const percent = ((count / chamadosPeriodo.length) * 100).toFixed(1);
                doc.text(`${categoria}:`, 20, yPos);
                doc.text(`${count} (${percent}%)`, 180, yPos, { align: 'right' });
                
                const barWidth = 150;
                const barHeight = 3;
                doc.setFillColor(220, 220, 230);
                doc.rect(20, yPos + 2, barWidth, barHeight, 'F');
                doc.setFillColor(...verde);
                doc.rect(20, yPos + 2, (count / chamadosPeriodo.length) * barWidth, barHeight, 'F');
                
                yPos += 10;
            });

        yPos += 5;

        // CHAMADOS POR PRIORIDADE
        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }

        doc.setFillColor(240, 240, 245);
        doc.rect(15, yPos, 180, 8, 'F');
        
        doc.setTextColor(...azulEscuro);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('🔥 CHAMADOS POR PRIORIDADE', 20, yPos + 6);
        yPos += 12;

        const porPrioridade = {};
        chamadosPeriodo.forEach(c => {
            porPrioridade[c.prioridade] = (porPrioridade[c.prioridade] || 0) + 1;
        });

        const coresPrioridade = {
            'urgente': [220, 38, 38],
            'alta': [239, 68, 68],
            'media': [245, 158, 11],
            'baixa': [100, 116, 139]
        };

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        ['urgente', 'alta', 'media', 'baixa'].forEach(prioridade => {
            if (porPrioridade[prioridade]) {
                const count = porPrioridade[prioridade];
                const percent = ((count / chamadosPeriodo.length) * 100).toFixed(1);
                
                doc.setTextColor(...cinza);
                doc.text(`${this.getPrioridadeTexto(prioridade)}:`, 20, yPos);
                doc.text(`${count} (${percent}%)`, 180, yPos, { align: 'right' });
                
                const barWidth = 150;
                const barHeight = 3;
                doc.setFillColor(220, 220, 230);
                doc.rect(20, yPos + 2, barWidth, barHeight, 'F');
                doc.setFillColor(...coresPrioridade[prioridade]);
                doc.rect(20, yPos + 2, (count / chamadosPeriodo.length) * barWidth, barHeight, 'F');
                
                yPos += 10;
            }
        });

        yPos += 5;

        // CHAMADOS POR STATUS
        doc.setFillColor(240, 240, 245);
        doc.rect(15, yPos, 180, 8, 'F');
        
        doc.setTextColor(...azulEscuro);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('📊 CHAMADOS POR STATUS', 20, yPos + 6);
        yPos += 12;

        const porStatus = {};
        chamadosPeriodo.forEach(c => {
            porStatus[c.status] = (porStatus[c.status] || 0) + 1;
        });

        const coresStatus = {
            'aberto': azulPrimario,
            'em_andamento': laranja,
            'resolvido': verde
        };

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        Object.entries(porStatus).forEach(([status, count]) => {
            const percent = ((count / chamadosPeriodo.length) * 100).toFixed(1);
            
            doc.setTextColor(...cinza);
            doc.text(`${this.getStatusTexto(status)}:`, 20, yPos);
            doc.text(`${count} (${percent}%)`, 180, yPos, { align: 'right' });
            
            const barWidth = 150;
            const barHeight = 3;
            doc.setFillColor(220, 220, 230);
            doc.rect(20, yPos + 2, barWidth, barHeight, 'F');
            doc.setFillColor(...coresStatus[status]);
            doc.rect(20, yPos + 2, (count / chamadosPeriodo.length) * barWidth, barHeight, 'F');
            
            yPos += 10;
        });

        // RODAPÉ
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFillColor(...azulPrimario);
            doc.rect(0, 287, 210, 10, 'F');
            
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(8);
            doc.text('Fundação Uniselva - Sistema NPD', 105, 293, { align: 'center' });
            doc.text(`Página ${i} de ${pageCount}`, 190, 293, { align: 'right' });
        }

        // Salvar PDF
        const nomeArquivo = `relatorio-npd-${periodo}-${agora.getTime()}.pdf`;
        doc.save(nomeArquivo);
        
        this.mostrarToast('✅ Relatório PDF exportado com sucesso!', 'success');
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

    salvarUsuarios() {
        localStorage.setItem('npd_usuarios', JSON.stringify(this.usuarios));
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
const admin = new AdminSystem();
