// Login e Cadastro - Sistema NPD Uniselva
class LoginSystem {
    constructor() {
        this.usuarios = JSON.parse(localStorage.getItem('npd_usuarios')) || [];
        this.tema = localStorage.getItem('npd_tema') || 'light';
        
        // Criar admin padrão se não existir
        if (this.usuarios.length === 0) {
            this.usuarios.push({
                id: 1,
                nome: 'Administrador NPD',
                email: 'admin@uniselva.edu.br',
                senha: 'admin123',
                setor: 'NPD',
                tipo: 'admin',
                dataCriacao: new Date().toISOString()
            });
            this.salvarUsuarios();
        }
        
        this.init();
    }

    init() {
        this.aplicarTema();
        this.setupEventListeners();
        this.verificarSessao();
    }

    aplicarTema() {
        document.documentElement.setAttribute('data-theme', this.tema);
        document.body.setAttribute('data-theme', this.tema);
    }

    setupEventListeners() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.fazerLogin();
        });
    }

    verificarSessao() {
        const usuarioAtual = JSON.parse(localStorage.getItem('npd_usuario_atual'));
        if (usuarioAtual) {
            // Já está logado, redirecionar
            this.redirecionarUsuario(usuarioAtual);
        }
    }

    fazerLogin() {
        const email = document.getElementById('loginEmail').value;
        const senha = document.getElementById('loginPassword').value;

        const usuario = this.usuarios.find(u => u.email === email && u.senha === senha);

        if (usuario) {
            localStorage.setItem('npd_usuario_atual', JSON.stringify(usuario));
            this.mostrarToast('✅ Login realizado com sucesso!', 'success');
            setTimeout(() => {
                this.redirecionarUsuario(usuario);
            }, 800);
        } else {
            this.mostrarToast('❌ Email ou senha incorretos!', 'error');
        }
    }

    redirecionarUsuario(usuario) {
        if (usuario.tipo === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'usuario.html';
        }
    }

    mostrarToast(mensagem, tipo = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = mensagem;
        toast.className = `toast ${tipo}`;
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    salvarUsuarios() {
        localStorage.setItem('npd_usuarios', JSON.stringify(this.usuarios));
    }
}

// Inicializar
new LoginSystem();
