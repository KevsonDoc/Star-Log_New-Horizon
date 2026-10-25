import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig.js';

const launch = document.querySelector<HTMLButtonElement>('#launch-mission')!;
const gate = document.querySelector<HTMLElement>('#mission-gate')!;
const pauseModal = document.querySelector<HTMLElement>('#pause-modal');
const status = document.querySelector<HTMLElement>('#launch-status')!;
const progress = document.querySelector<HTMLProgressElement>('#load-progress')!;
const field = document.querySelector<HTMLElement>('#game-container')!;
const flightState = document.querySelector<HTMLElement>('#flight-state')!;
const pause = document.querySelector<HTMLButtonElement>('#pause-mission')!;
const restart = document.querySelector<HTMLButtonElement>('#restart-mission')!;
let game: Phaser.Game | undefined;
let countdown: number | undefined;
let paused = false;
let failed = false;
let inFlight = false;

function clearCountdown(): void {
    window.clearInterval(countdown);
    countdown = undefined;
}

function showBriefing(): void {
    clearCountdown();
    game?.destroy(true);
    game = undefined;
    failed = false;
    paused = false;
    inFlight = false;
    if (pauseModal) pauseModal.hidden = true;
    gate.hidden = false;
    gate.querySelector('h2')!.innerHTML = 'Seu próximo<br><em>horizonte.</em>';
    gate.setAttribute('aria-busy', 'false');
    progress.hidden = true;
    progress.value = 0;
    launch.disabled = false;
    launch.textContent = 'Iniciar missão ↗';
    status.textContent = 'Aguardando seu comando.';
    flightState.textContent = 'PRÉ-VOO';
    pause.disabled = true;
    pause.textContent = 'Retornar';
    restart.disabled = true;
    restart.hidden = true;
    launch.focus();
}

function pauseMission(): void {
    if (!game || !inFlight || pause.disabled || paused) return;
    paused = true;
    game.scene.pause('game');
    if (pauseModal) pauseModal.hidden = false;
    pause.textContent = 'Retornar';
    flightState.textContent = 'VOO PAUSADO';
    pause.focus();
}

function resumeMission(): void {
    if (!game || !inFlight || pause.disabled || !paused) return;
    paused = false;
    game.scene.resume('game');
    if (pauseModal) pauseModal.hidden = true;
    pause.textContent = 'Retornar';
    flightState.textContent = 'EM VOO';
    field.focus();
}

function startCountdown(instance: Phaser.Game): void {
    if (failed) return;
    progress.hidden = true;
    let remaining = 3;
    flightState.textContent = 'CONTAGEM REGRESSIVA';
    launch.textContent = String(remaining);
    status.textContent = 'Decolagem em ' + remaining + ' segundos.';
    countdown = window.setInterval(() => {
        // A tab in the background must not send the player into a running match.
        if (document.hidden) return;
        remaining -= 1;
        if (remaining > 0) {
            launch.textContent = String(remaining);
            status.textContent = 'Decolagem em ' + remaining + (remaining === 1 ? ' segundo.' : ' segundos.');
            return;
        }
        clearCountdown();
        gate.hidden = true;
        gate.setAttribute('aria-busy', 'false');
        inFlight = true;
        paused = false;
        if (pauseModal) pauseModal.hidden = true;
        flightState.textContent = 'EM VOO';
        pause.disabled = false;
        field.focus();
        instance.events.emit('mission-start');
    }, 1000);
}

launch.addEventListener('click', () => {
    launch.disabled = true;
    launch.textContent = 'Carregando…';
    gate.setAttribute('aria-busy', 'true');
    progress.hidden = false;
    status.textContent = 'Carregando os sistemas da missão…';
    flightState.textContent = 'CARREGANDO';
    failed = false;
    inFlight = false;
    game = new Phaser.Game({
        ...gameConfig,
        callbacks: {
            preBoot: (instance) => {
                instance.events.on('mission-progress', (value: number) => {
                    progress.value = value;
                    status.textContent = 'Carregando sistemas: ' + Math.round(value * 100) + '%';
                });
                instance.events.once('mission-ready', () => {
                    gate.setAttribute('aria-busy', 'false');
                    restart.disabled = false;
                    startCountdown(instance);
                });
                instance.events.once('mission-load-error', () => {
                    failed = true;
                    inFlight = false;
                    clearCountdown();
                    progress.hidden = true;
                    gate.setAttribute('aria-busy', 'false');
                    status.textContent = 'Não foi possível carregar a missão. Volte à preparação para tentar novamente.';
                    launch.textContent = 'Falha no carregamento';
                    flightState.textContent = 'FALHA NO CARREGAMENTO';
                    restart.hidden = false;
                    restart.disabled = false;
                    restart.textContent = 'Voltar à preparação';
                    restart.focus();
                });
                instance.events.once('mission-ended', (won: boolean) => {
                    inFlight = false;
                    paused = false;
                    if (pauseModal) pauseModal.hidden = true;
                    flightState.textContent = won ? 'MISSÃO CONCLUÍDA' : 'NAVE DESTRUÍDA';
                    pause.disabled = true;
                    status.textContent = won ? 'Missão concluída. Você pode iniciar um novo voo.' : 'Sua nave foi atingida. Pronto para tentar de novo?';
                    launch.textContent = 'Tentar novamente ↗';
                    gate.querySelector('h2')!.textContent = won ? 'Horizonte alcançado.' : 'Um novo voo?';
                    gate.hidden = false;
                    launch.disabled = false;
                    // A fresh attempt always goes through preparation and asset readiness.
                    game?.destroy(true);
                    game = undefined;
                    restart.disabled = true;
                    restart.hidden = true;
                    launch.focus();
                });
            },
        },
    });
});

pause.addEventListener('click', () => {
    if (paused) resumeMission();
    else pauseMission();
});
restart.addEventListener('click', () => {
    showBriefing();
    restart.textContent = 'Reiniciar';
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseMission();
});
window.addEventListener('blur', () => {
    pauseMission();
});
window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !inFlight) return;
    event.preventDefault();
    if (paused) resumeMission();
    else pauseMission();
});
window.addEventListener('pagehide', clearCountdown);
