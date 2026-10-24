import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig.js';

const launch = document.querySelector<HTMLButtonElement>('#launch-mission')!;
const gate = document.querySelector<HTMLElement>('#mission-gate')!;
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
    pause.textContent = 'Pausar';
    restart.disabled = true;
    launch.focus();
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
                    clearCountdown();
                    progress.hidden = true;
                    gate.setAttribute('aria-busy', 'false');
                    status.textContent = 'Não foi possível carregar a missão. Volte à preparação para tentar novamente.';
                    launch.textContent = 'Falha no carregamento';
                    flightState.textContent = 'FALHA NO CARREGAMENTO';
                    restart.disabled = false;
                    restart.textContent = 'Voltar à preparação';
                    restart.focus();
                });
                instance.events.once('mission-ended', (won: boolean) => {
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
                    launch.focus();
                });
            },
        },
    });
});

pause.addEventListener('click', () => {
    if (!game || pause.disabled) return;
    paused = !paused;
    if (paused) game.scene.pause('game');
    else game.scene.resume('game');
    pause.textContent = paused ? 'Continuar' : 'Pausar';
    flightState.textContent = paused ? 'VOO PAUSADO' : 'EM VOO';
    if (!paused) field.focus();
});
restart.addEventListener('click', () => {
    showBriefing();
    restart.textContent = 'Reiniciar';
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden && game && !pause.disabled && !paused) pause.click();
});
window.addEventListener('pagehide', clearCountdown);
