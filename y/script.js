// ====================================================================
// CONFIGURAÇÃO FIREBASE
// ====================================================================

const firebaseConfig = {
    apiKey: "AIzaSyAGFbBUOt8-74eDVlydPubn0hBolGfSqzo",
    authDomain: "usguridaunoesc1.firebaseapp.com",
    projectId: "usguridaunoesc1",
    storageBucket: "usguridaunoesc1.firebasestorage.app",
    messagingSenderId: "737967909997",
    appId: "1:737967909997:web:83482f7dbd034047cca364",
    measurementId: "G-14XB3SB6XS"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const storageRef = storage.ref();
const photosCollection = db.collection("galeria_fotos");

// ====================================================================
// VARIÁVEIS GLOBAIS
// ====================================================================

let currentUser = null;
let recadosUnsubscribe = null;
let chatUnsubscribe = null;

const AVATAR_URLS = [
    "img/avatars/guri_verde.png",
    "img/avatars/guri_azul.png",
    "img/avatars/guri_vermelho.png",
    "img/avatars/guri_amarelo.png",
    "img/avatars/guri_roxo.png"
];

// ====================================================================
// FUNÇÕES DE NAVEGAÇÃO ENTRE PÁGINAS
// ====================================================================

function showPage(pageId) {
    // Desliga listeners de páginas anteriores
    if (chatUnsubscribe) {
        chatUnsubscribe();
        chatUnsubscribe = null;
    }
    if (recadosUnsubscribe) {
        recadosUnsubscribe();
        recadosUnsubscribe = null;
    }
    if (rankingUnsubscribe) {
        rankingUnsubscribe();
        rankingUnsubscribe = null;
    }

    // Parar o jogo se estiver rodando
    if (gameRunning) {
        gameRunning = false;
        document.removeEventListener('keydown', handleJump);
    }

    // Troca a página ativa
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    // Scroll suave para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Inicia listeners específicos da página
    if (pageId === 'chat') {
        loadChat();
        updateChatAccess();
    }
    if (pageId === 'recados') {
        loadRecados();
    }
    if (pageId === 'galeria') {
        loadGallery();
    }
    if (pageId === 'jogo') {
        initGame();
        loadRanking();
    }

    // Fecha menu mobile se estiver aberto
    document.getElementById('navMenu').classList.remove('active');
}

// ====================================================================
// SISTEMA DE AUTENTICAÇÃO - LOGIN E CADASTRO
// ====================================================================

// --- Função para exibir mensagens de erro/sucesso ---
function showMessage(msgDiv, text, isError = false) {
    msgDiv.textContent = text;
    msgDiv.style.display = 'block';
    msgDiv.className = isError ? 'mensagem-auth error' : 'mensagem-auth success';
    
    // Auto-hide após 5 segundos se for sucesso
    if (!isError) {
        setTimeout(() => {
            msgDiv.style.display = 'none';
        }, 5000);
    }
}

// --- Alternar entre formulário de Login e Cadastro ---
function toggleAuthMode() {
    const loginForm = document.getElementById('loginForm');
    const cadastroForm = document.getElementById('cadastroForm');
    const msg = document.getElementById('authMessage');
    const isLogin = loginForm.style.display !== 'none';

    loginForm.style.display = isLogin ? 'none' : 'block';
    cadastroForm.style.display = isLogin ? 'block' : 'none';

    // Limpa mensagem ao trocar de formulário
    if (msg) {
        msg.style.display = 'none';
        msg.textContent = '';
    }
}

// --- Clique no botão Login/Sair ---
function handleAuthClick(event) {
    event.preventDefault();
    if (currentUser) {
        doLogout();
    } else {
        showPage('login');
    }
}

// --- Logout ---
function doLogout() {
    if (confirm('Tem certeza que quer sair do rolê?')) {
        currentUser = null;
        localStorage.removeItem('guriUsername');
        localStorage.removeItem('guriAvatarUrl');
        updateAuthUI();
        updateChatAccess();
        alert('Até mais! Deslogado com sucesso.');
        showPage('quem-somos');
    }
}

// --- Atualizar interface (mostrar username e botão Login/Sair) ---
function updateAuthUI() {
    const authLink = document.getElementById('auth-link');
    const usernameDisplay = document.getElementById('guri-username-display');

    if (currentUser) {
        // Usuário logado
        authLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sair';
        if (usernameDisplay) {
            usernameDisplay.textContent = currentUser.toUpperCase();
        }
    } else {
        // Usuário deslogado
        authLink.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        if (usernameDisplay) {
            usernameDisplay.textContent = '';
        }
    }

    updateChatAccess();
}

// --- CADASTRO ---
document.getElementById('cadastroForm').onsubmit = function(e) {
    e.preventDefault();

    const username = document.getElementById('usernameCadastro').value.trim().toLowerCase();
    const password = document.getElementById('senhaCadastro').value;
    const msgDiv = document.getElementById('authMessage');
    const btn = this.querySelector('button[type="submit"]');

    // Limpa mensagem anterior
    msgDiv.style.display = 'none';
    msgDiv.textContent = '';

    // Validações
    if (username.length < 3) {
        showMessage(msgDiv, '❌ O username deve ter pelo menos 3 caracteres!', true);
        return;
    }

    if (password.length < 6) {
        showMessage(msgDiv, '❌ A senha deve ter pelo menos 6 caracteres!', true);
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Cadastrando...';

    // Verifica se username já existe
    db.collection("users").doc(username).get()
        .then(doc => {
            if (doc.exists) {
                showMessage(msgDiv, '❌ Este username já existe! Escolha outro.', true);
                btn.disabled = false;
                btn.textContent = 'Criar Conta';
                return Promise.reject('Username já existe');
            }

            // Salva usuário no Firestore
            return db.collection("users").doc(username).set({
                username: username,
                password: password,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                avatarUrl: getDefaultAvatar()
            });
        })
        .then(() => {
            // Login automático após cadastro
            currentUser = username;
            localStorage.setItem('guriUsername', username);
            localStorage.setItem('guriAvatarUrl', getDefaultAvatar());
            updateAuthUI();

            showMessage(msgDiv, '✅ Cadastro concluído! Seja bem-vindo, guri!');
            
            this.reset();
            
            setTimeout(() => {
                showPage('quem-somos');
            }, 2000);
        })
        .catch(err => {
            if (err !== 'Username já existe') {
                console.error('Erro no cadastro:', err);
                showMessage(msgDiv, '❌ Erro ao cadastrar: ' + err.message, true);
            }
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = 'Criar Conta';
        });
};

// --- LOGIN ---
document.getElementById('loginForm').onsubmit = function(e) {
    e.preventDefault();

    const username = document.getElementById('usernameLogin').value.trim().toLowerCase();
    const password = document.getElementById('senhaLogin').value;
    const msgDiv = document.getElementById('authMessage');
    const btn = document.getElementById('btnLogin');

    // Limpa mensagem anterior
    msgDiv.style.display = 'none';
    msgDiv.textContent = '';

    // Validações básicas
    if (username.length < 3) {
        showMessage(msgDiv, '❌ Digite um username válido!', true);
        return;
    }

    if (password.length < 6) {
        showMessage(msgDiv, '❌ Senha muito curta!', true);
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';

    // Busca usuário no Firestore
    db.collection("users").doc(username).get()
        .then(doc => {
            if (!doc.exists) {
                showMessage(msgDiv, '❌ Usuário não encontrado! Cadastre-se primeiro.', true);
                btn.disabled = false;
                btn.textContent = 'Entrar';
                return;
            }

            const userData = doc.data();

            // Verifica senha (sem criptografia)
            if (userData.password !== password) {
                showMessage(msgDiv, '❌ Senha incorreta!', true);
                btn.disabled = false;
                btn.textContent = 'Entrar';
                return;
            }

            // Login bem-sucedido
            currentUser = username;
            localStorage.setItem('guriUsername', username);
            localStorage.setItem('guriAvatarUrl', userData.avatarUrl || getDefaultAvatar());
            updateAuthUI();

            showMessage(msgDiv, '✅ Acesso liberado, guri!');
            
            this.reset();
            
            setTimeout(() => {
                showPage('quem-somos');
            }, 1500);
        })
        .catch(err => {
            console.error('Erro no login:', err);
            showMessage(msgDiv, '❌ Erro ao fazer login: ' + err.message, true);
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = 'Entrar';
        });
};

// ====================================================================
// SISTEMA DE CHAT EM TEMPO REAL
// ====================================================================

// --- Carregar mensagens do chat ---
function loadChat() {
    const chatMessages = document.getElementById('chat-messages');

    chatUnsubscribe = db.collection("chat")
        .orderBy("createdAt", "asc")
        .onSnapshot(
            snapshot => {
                chatMessages.innerHTML = '';

                if (!currentUser) {
                    chatMessages.innerHTML = '<p class="system-message">💬 Chat do rolê! Você precisa estar logado para enviar mensagens.</p>';
                }

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const chatItem = document.createElement('div');
                    chatItem.classList.add('chat-item');

                    chatItem.innerHTML = `
                        <img src="${data.avatarUrl || getDefaultAvatar()}" class="chat-avatar" alt="${data.username}" />
                        <p>
                            <strong>${data.username}:</strong> 
                            <span>${data.message}</span>
                        </p>
                    `;
                    chatMessages.appendChild(chatItem);
                });

                chatMessages.scrollTop = chatMessages.scrollHeight;
            },
            error => {
                console.error("Erro ao carregar chat:", error);
                chatMessages.innerHTML = '<p class="system-message" style="color: red;">❌ Erro ao carregar mensagens.</p>';
            }
        );
}

// --- Habilitar/Desabilitar input do chat ---
function updateChatAccess() {
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const isLoggedIn = currentUser !== null;

    if (isLoggedIn) {
        chatInput.disabled = false;
        sendButton.disabled = false;
        chatInput.placeholder = 'Digite sua mensagem...';
    } else {
        chatInput.disabled = true;
        sendButton.disabled = true;
        chatInput.placeholder = 'Você precisa estar logado para digitar.';
    }
}

// --- Enviar mensagem ---
function sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();

    if (!currentUser || message === '') {
        return;
    }

    const username = currentUser.toUpperCase();
    const avatarUrl = localStorage.getItem('guriAvatarUrl') || getDefaultAvatar();

    db.collection("chat").add({
        username: username,
        message: message,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        avatarUrl: avatarUrl
    })
    .then(() => {
        chatInput.value = '';
    })
    .catch((err) => {
        console.error("Erro ao enviar mensagem:", err);
        alert("❌ Erro ao enviar mensagem: " + err.message);
    });
}

// ====================================================================
// SISTEMA DE RECADOS
// ====================================================================

// --- Carregar recados ---
function loadRecados() {
    const lista = document.getElementById("lista-recados");

    recadosUnsubscribe = db.collection("recados")
        .orderBy("timestamp", "desc")
        .onSnapshot(
            snap => {
                lista.innerHTML = "";

                snap.forEach(doc => {
                    const d = doc.data();
                    const div = document.createElement("div");
                    div.className = "recado-item";
                    div.innerHTML = `<strong>${d.nome}:</strong> ${d.mensagem}`;
                    lista.appendChild(div);
                });
            },
            error => {
                console.error("Erro ao carregar recados:", error);
                lista.innerHTML = '<p style="color:red;">❌ Erro ao carregar Recados.</p>';
            }
        );
}

// --- Enviar recado ---
document.getElementById("form-recado").onsubmit = (e) => {
    e.preventDefault();
    const nome = document.getElementById("nome").value.trim();
    const msg = document.getElementById("mensagem").value.trim();

    if (!nome || !msg) {
        alert("⚠️ Preenche tudo, guri!");
        return;
    }

    db.collection("recados").add({
        nome: nome,
        mensagem: msg,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("✅ ZOEIRA ENVIADA COM SUCESSO 🔥");
        e.target.reset();
    })
    .catch((err) => {
        console.error(err);
        alert("❌ Erro: " + err.message);
    });
};

/// ====================================================================
// SISTEMA DE PERSONALIZAÇÃO DE CAMISETA
// =====================================================================

function atualizarCamiseta() {
    const nomeInput = document.getElementById('nomePersonalizado');
    const numeroInput = document.getElementById('numeroPersonalizado');
    
    // Pega o valor e limita
    let nome = (nomeInput?.value || '').toUpperCase();
    let numero = numeroInput?.value || '';
    
    // Força limite de 18 caracteres no nome
    if (nome.length > 18) {
        nome = nome.substring(0, 18);
        nomeInput.value = nome;
    }
    
    // Força apenas números e limite de 2 dígitos
    numero = numero.replace(/[^0-9]/g, ''); // Remove não-números
    if (numero.length > 2) {
        numero = numero.substring(0, 2);
    }
    numeroInput.value = numero;
    
    // Para exibição: se estiver vazio, mostra padrão (mas não força no input)
    const nomeDisplay = nome || 'SEU NOME';
    const numeroDisplay = numero || '10';
    
    // Atualiza número no peito (frente)
    const numeroFrente = document.getElementById('previewNumeroFrente');
    if (numeroFrente) {
        numeroFrente.innerText = numeroDisplay;
    }
    
    // Atualiza nome nas costas
    const nomeCostas = document.getElementById('previewNomeCostas');
    if (nomeCostas) {
        nomeCostas.innerText = nomeDisplay;
    }
    
    // Atualiza número nas costas
    const numeroCostas = document.getElementById('previewNumeroCostas');
    if (numeroCostas) {
        numeroCostas.innerText = numeroDisplay;
    }
}

// Inicializa a preview quando a página carrega
window.addEventListener('load', () => {
    atualizarCamiseta();
});

// --- Pedido via WhatsApp ---
document.getElementById('pedidoForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nome = document.getElementById('nomeCompleto').value;
    const whats = document.getElementById('whatsapp').value;
    const tam = document.getElementById('tamanho').value;
    const nomePers = (document.getElementById('nomePersonalizado').value || 'Sem').toUpperCase();
    const numPers = document.getElementById('numeroPersonalizado').value || 'Sem';

    const msg = `*PEDIDO 2º LOTE - US GURI*\n\nNome: ${nome}\nWhats: ${whats}\nTamanho: ${tam}\n\nPersonalização:\nNome: ${nomePers}\nNúmero: ${numPers}`;
    const url = `https://wa.me/5549991348038?text=${encodeURIComponent(msg)}`;
    
    window.open(url, '_blank');
    document.getElementById('mensagemSucesso').innerHTML = '✅ Pedido enviado! Abre o WhatsApp.';
    this.reset();
    setTimeout(() => document.getElementById('mensagemSucesso').innerHTML = '', 5000);
});

// ====================================================================
// SISTEMA DE GALERIA DE FOTOS
// ====================================================================

// --- Upload de foto ---
document.getElementById('upload-btn').onclick = () => {
    if (!currentUser) {
        alert("⚠️ Você precisa estar logado para fazer upload de fotos!");
        return;
    }

    const fileInput = document.getElementById('photo-file');
    const captionInput = document.getElementById('photo-caption');
    const statusText = document.getElementById('upload-status');
    const file = fileInput.files[0];
    const caption = captionInput.value.trim();

    if (!file) {
        alert("⚠️ Selecione uma foto, guri!");
        return;
    }

    statusText.textContent = "⏳ Iniciando upload...";

    const fileName = `${currentUser}_${Date.now()}_${file.name}`;
    const photoRef = storageRef.child('fotos_guris/' + fileName);

    photoRef.put(file)
        .then((snapshot) => {
            statusText.textContent = "✅ Upload concluído!";
            return snapshot.ref.getDownloadURL();
        })
        .then((downloadURL) => {
            return photosCollection.add({
                uploadedBy: currentUser.toUpperCase(),
                caption: caption,
                photoURL: downloadURL,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            statusText.textContent = "🎉 Foto salva na galeria!";
            fileInput.value = '';
            captionInput.value = '';
            loadGallery();
        })
        .catch((error) => {
            console.error("Erro no upload:", error);
            statusText.textContent = `❌ Erro: ${error.message}`;
        });
};

// --- Carregar galeria ---
function loadGallery() {
    const container = document.getElementById('photos-container');
    container.innerHTML = "⏳ Carregando as melhores zoeiras...";

    photosCollection.orderBy('createdAt', 'desc').get()
        .then(snapshot => {
            container.innerHTML = '';
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const photoId = doc.id;

                const photoItem = document.createElement('div');
                photoItem.classList.add('photo-item');

                photoItem.innerHTML = `
                    <img src="${data.photoURL}" alt="${data.caption || 'Foto do Guri'}" />
                    <div class="photo-info">
                        <p class="photo-caption">${data.caption || '(Sem Legenda)'}</p>
                        <small>📸 Postado por: ${data.uploadedBy}</small>
                    </div>
                    
                    <div id="comments-${photoId}" class="comments-list"></div>

                    <div class="comment-form-area">
                        <input type="text" id="comment-input-${photoId}" placeholder="Comente aqui..." />
                        <button onclick="postComment('${photoId}')">💬 Comentar</button>
                    </div>
                `;
                container.appendChild(photoItem);

                loadComments(photoId);
            });
        })
        .catch(err => {
            console.error("Erro ao carregar galeria:", err);
            container.innerHTML = "❌ Não foi possível carregar a galeria.";
        });
}

// --- Postar comentário ---
function postComment(photoId) {
    if (!currentUser) {
        alert("⚠️ Faça login para comentar!");
        return;
    }

    const input = document.getElementById(`comment-input-${photoId}`);
    const commentText = input.value.trim();

    if (commentText === "") return;

    photosCollection.doc(photoId).collection('comments').add({
        username: currentUser.toUpperCase(),
        text: commentText,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        input.value = '';
        loadComments(photoId);
    })
    .catch(err => console.error("Erro ao postar comentário:", err));
}

// --- Carregar comentários ---
function loadComments(photoId) {
    const listDiv = document.getElementById(`comments-${photoId}`);
    listDiv.innerHTML = '⏳ Carregando comentários...';

    photosCollection.doc(photoId).collection('comments')
        .orderBy('createdAt', 'asc')
        .get()
        .then(snapshot => {
            listDiv.innerHTML = '';
            
            snapshot.forEach(doc => {
                const comment = doc.data();
                const commentElement = document.createElement('p');
                commentElement.innerHTML = `<strong>${comment.username}:</strong> ${comment.text}`;
                listDiv.appendChild(commentElement);
            });
            
            if (snapshot.empty) {
                listDiv.innerHTML = '<p class="no-comments">💭 Seja o primeiro a comentar!</p>';
            }
        });
}

// ====================================================================
// FUNÇÕES UTILITÁRIAS
// ====================================================================

function getDefaultAvatar() {
    const randomIndex = Math.floor(Math.random() * AVATAR_URLS.length);
    return AVATAR_URLS[randomIndex];
}

// ====================================================================
// SISTEMA DE JOGO - DINO RUNNER
// ====================================================================

// Variáveis do Jogo
let gameCanvas, gameCtx;
let gameRunning = false;
let gameScore = 0;
let gameSpeed = 6;
let gameFrameCount = 0;
let highScore = 0;
let rankingUnsubscribe = null;

// Objeto Dinossauro
const dino = {
    x: 50,
    y: 0,
    width: 40,
    height: 50,
    jumping: false,
    velocityY: 0,
    gravity: 0.8,
    jumpPower: -15,
    groundY: 330
};

// Array de Obstáculos
let obstacles = [];

// Configurações dos Obstáculos
const obstacleConfig = {
    width: 25,
    height: 50,
    color: '#27ae60',
    minGap: 150,
    maxGap: 300
};

// --- Inicializar Jogo ---
function initGame() {
    gameCanvas = document.getElementById('gameCanvas');
    gameCtx = gameCanvas.getContext('2d');

    // Ajustar dimensões do canvas para tela real
    gameCanvas.width = 800;
    gameCanvas.height = 400;

    dino.y = dino.groundY;

    // Carregar high score do localStorage
    highScore = parseInt(localStorage.getItem('guriDinoHighScore')) || 0;
    document.getElementById('high-score').textContent = highScore;
}

// --- Começar Jogo ---
function startGame() {
    // Verificar se está logado
    if (!currentUser) {
        document.getElementById('login-warning').style.display = 'block';
        setTimeout(() => {
            showPage('login');
        }, 2000);
        return;
    }

    // Esconder tela de início
    document.getElementById('game-start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';

    // Reset variáveis
    gameRunning = true;
    gameScore = 0;
    gameSpeed = 6;
    gameFrameCount = 0;
    obstacles = [];
    dino.y = dino.groundY;
    dino.velocityY = 0;
    dino.jumping = false;

    // Adicionar listeners de teclado
    document.addEventListener('keydown', handleJump);

    // Iniciar loop do jogo
    gameLoop();
}

// --- Reiniciar Jogo ---
function restartGame() {
    document.getElementById('game-over-screen').style.display = 'none';
    startGame();
}

// --- Pular ---
function handleJump(e) {
    if (!gameRunning) return;

    if ((e.code === 'Space' || e.code === 'ArrowUp') && !dino.jumping) {
        dino.velocityY = dino.jumpPower;
        dino.jumping = true;
    }
}

// --- Loop Principal do Jogo ---
function gameLoop() {
    if (!gameRunning) return;

    // Limpar canvas
    gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // Desenhar chão
    drawGround();

    // Atualizar e desenhar dinossauro
    updateDino();
    drawDino();

    // Gerenciar obstáculos
    updateObstacles();
    drawObstacles();

    // Verificar colisões
    checkCollisions();

    // Atualizar pontuação
    gameScore++;
    document.getElementById('current-score').textContent = Math.floor(gameScore / 10);

    // Aumentar dificuldade
    if (gameFrameCount % 500 === 0) {
        gameSpeed += 0.5;
    }

    gameFrameCount++;

    // Continuar loop
    requestAnimationFrame(gameLoop);
}

// --- Desenhar Chão ---
function drawGround() {
    gameCtx.fillStyle = '#27ae60';
    gameCtx.fillRect(0, 380, gameCanvas.width, 20);

    // Linha decorativa
    gameCtx.strokeStyle = '#2ecc71';
    gameCtx.lineWidth = 3;
    gameCtx.beginPath();
    gameCtx.moveTo(0, 380);
    gameCtx.lineTo(gameCanvas.width, 380);
    gameCtx.stroke();
}

// --- Atualizar Dinossauro ---
function updateDino() {
    // Aplicar gravidade
    dino.velocityY += dino.gravity;
    dino.y += dino.velocityY;

    // Verificar se tocou o chão
    if (dino.y >= dino.groundY) {
        dino.y = dino.groundY;
        dino.velocityY = 0;
        dino.jumping = false;
    }
}

// --- Desenhar Dinossauro ---
function drawDino() {
    gameCtx.fillStyle = '#f1c40f';
    gameCtx.fillRect(dino.x, dino.y, dino.width, dino.height);

    // Olho
    gameCtx.fillStyle = '#000';
    gameCtx.fillRect(dino.x + 25, dino.y + 10, 5, 5);

    // Contorno
    gameCtx.strokeStyle = '#000';
    gameCtx.lineWidth = 2;
    gameCtx.strokeRect(dino.x, dino.y, dino.width, dino.height);
}

// --- Atualizar Obstáculos ---
function updateObstacles() {
    // Criar novo obstáculo
    if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < gameCanvas.width - 200) {
        const gap = Math.random() * (obstacleConfig.maxGap - obstacleConfig.minGap) + obstacleConfig.minGap;

        if (obstacles.length === 0 || gameCanvas.width - obstacles[obstacles.length - 1].x >= gap) {
            obstacles.push({
                x: gameCanvas.width,
                y: 330,
                width: obstacleConfig.width,
                height: obstacleConfig.height
            });
        }
    }

    // Mover obstáculos
    obstacles.forEach((obstacle, index) => {
        obstacle.x -= gameSpeed;

        // Remover obstáculos fora da tela
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(index, 1);
        }
    });
}

// --- Desenhar Obstáculos ---
function drawObstacles() {
    gameCtx.fillStyle = obstacleConfig.color;

    obstacles.forEach(obstacle => {
        gameCtx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

        // Contorno
        gameCtx.strokeStyle = '#000';
        gameCtx.lineWidth = 2;
        gameCtx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
}

// --- Verificar Colisões ---
function checkCollisions() {
    obstacles.forEach(obstacle => {
        if (
            dino.x < obstacle.x + obstacle.width &&
            dino.x + dino.width > obstacle.x &&
            dino.y < obstacle.y + obstacle.height &&
            dino.y + dino.height > obstacle.y
        ) {
            gameOver();
        }
    });
}

// --- Game Over ---
function gameOver() {
    gameRunning = false;
    document.removeEventListener('keydown', handleJump);

    const finalScore = Math.floor(gameScore / 10);
    document.getElementById('final-score').textContent = finalScore;

    // Atualizar high score local
    if (finalScore > highScore) {
        highScore = finalScore;
        localStorage.setItem('guriDinoHighScore', highScore);
        document.getElementById('high-score').textContent = highScore;
    }

    // Salvar pontuação no Firestore
    saveScore(finalScore);

    // Mostrar tela de game over
    document.getElementById('game-over-screen').style.display = 'block';
}

// --- Salvar Pontuação no Firestore ---
function saveScore(score) {
    const saveStatus = document.getElementById('save-status');
    saveStatus.textContent = '⏳ Salvando pontuação...';
    saveStatus.style.color = '#f1c40f';

    if (!currentUser) {
        saveStatus.textContent = '❌ Não logado - pontuação não salva';
        saveStatus.style.color = '#ff0000';
        return;
    }

    // Verificar se já existe um recorde do usuário
    db.collection("dino_scores").doc(currentUser).get()
        .then(doc => {
            if (doc.exists) {
                const currentHighScore = doc.data().score;

                // Só atualiza se for um novo recorde
                if (score > currentHighScore) {
                    return db.collection("dino_scores").doc(currentUser).update({
                        score: score,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    saveStatus.textContent = `✅ Pontuação salva! Seu recorde é ${currentHighScore}`;
                    saveStatus.style.color = '#27ae60';
                    return Promise.resolve();
                }
            } else {
                // Primeiro jogo do usuário
                return db.collection("dino_scores").doc(currentUser).set({
                    username: currentUser.toUpperCase(),
                    score: score,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        })
        .then(() => {
            saveStatus.textContent = '🎉 Novo recorde salvo!';
            saveStatus.style.color = '#27ae60';
            loadRanking();
        })
        .catch(err => {
            console.error('Erro ao salvar pontuação:', err);
            saveStatus.textContent = '❌ Erro ao salvar: ' + err.message;
            saveStatus.style.color = '#ff0000';
        });
}

// --- Carregar Ranking ---
function loadRanking() {
    const rankingList = document.getElementById('ranking-list');

    rankingUnsubscribe = db.collection("dino_scores")
        .orderBy("score", "desc")
        .limit(10)
        .onSnapshot(
            snapshot => {
                rankingList.innerHTML = '';

                if (snapshot.empty) {
                    rankingList.innerHTML = '<p class="loading-text">Nenhuma pontuação ainda. Seja o primeiro!</p>';
                    return;
                }

                snapshot.forEach((doc, index) => {
                    const data = doc.data();
                    const position = index + 1;

                    const rankingItem = document.createElement('div');
                    rankingItem.classList.add('ranking-item');

                    // Adicionar classe especial para top 3
                    if (position === 1) rankingItem.classList.add('top-1');
                    if (position === 2) rankingItem.classList.add('top-2');
                    if (position === 3) rankingItem.classList.add('top-3');

                    // Emoji de medalha
                    let medal = '';
                    if (position === 1) medal = '🥇';
                    else if (position === 2) medal = '🥈';
                    else if (position === 3) medal = '🥉';
                    else medal = `${position}º`;

                    rankingItem.innerHTML = `
                        <span class="ranking-position">${medal}</span>
                        <span class="ranking-player">${data.username}</span>
                        <span class="ranking-score">${data.score}</span>
                    `;

                    rankingList.appendChild(rankingItem);
                });
            },
            error => {
                console.error('Erro ao carregar ranking:', error);
                rankingList.innerHTML = '<p style="color: red;">❌ Erro ao carregar ranking</p>';
            }
        );
}

// ====================================================================
// INICIALIZAÇÃO QUANDO A PÁGINA CARREGAR
// ====================================================================

window.addEventListener('load', () => {
    // Verifica se há usuário salvo na sessão
    const savedUsername = localStorage.getItem('guriUsername');
    if (savedUsername) {
        currentUser = savedUsername;
        updateAuthUI();
    }

    // Menu mobile toggle
    document.getElementById('mobileMenuBtn').addEventListener('click', function() {
        document.getElementById('navMenu').classList.toggle('active');
    });

    // Listener para enviar mensagem com Enter no chat
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !chatInput.disabled) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    console.log('🎉 US GURI DA UNOESC - Sistema carregado com sucesso!');
});