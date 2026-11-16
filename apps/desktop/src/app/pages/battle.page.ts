import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, interval, timeout } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { API_URL, SessionService } from '../core/session.service';
import { translate } from '../core/translation';

interface Friend { id: string; name: string; rating: number; online: boolean; inBattle: boolean; queued: boolean; canInvite: boolean }
interface Match { battleId: string; startsAt: number; lesson: { id: string; title: string; path: string; language: string; code: string } }
interface Player { userId: string; name: string; rating: number; ratingAfter?: number; cursor: number; progress: number; wpm: number; accuracy: number; errors: number; abandoned?: boolean }

@Component({ standalone: true, imports: [FormsModule, RouterLink], template: `
  <header class="page-heading"><div><div class="eyebrow">{{ t('COMPITE Y APRENDE') }}</div><h1>{{ t('Batalla de Código 1v1') }}</h1><p>{{ t('Mide tu velocidad en tiempo real contra otra persona.') }}</p></div></header>
  @if (!session.token()) { <section class="card battle-panel"><div class="battle-swords" aria-hidden="true">VS</div><h2>{{ t('Inicia sesión para entrar a la batalla') }}</h2><p>{{ t('La cola, las invitaciones y el historial pertenecen a tu cuenta.') }}</p><a class="button primary" routerLink="/acceso" [queryParams]="{ mode: 'login', returnUrl: '/batalla' }">{{ t('Iniciar sesión') }} ›</a><div class="battle-features"><span>{{ t('Cola en vivo') }}</span><span>{{ t('Progreso validado') }}</span><span>{{ t('Rating Elo') }}</span></div></section> }
  @else if (!match()) { <section class="card battle-panel"><div class="battle-swords" aria-hidden="true">VS</div><h2>{{ t('¿Listo para el duelo?') }}</h2><p>{{ t('Te emparejaremos en una cola real. Ambos competirán con el mismo fragmento de código.') }}</p><button class="button primary" (click)="toggleQueue()" [disabled]="connecting() && !socketConnected()">{{ queued() ? t('Cancelar búsqueda') : socketConnected() ? t('Buscar oponente') : connecting() ? t('Conectando…') : t('Reconectar') }} ›</button>@if (status()) { <p class="inline-note" role="status">{{ t(status()) }}</p> }<div class="battle-features"><span>{{ t('Cola en vivo') }}</span><span>{{ t('Progreso validado') }}</span><span>{{ t('Rating Elo') }}</span></div></section> }
  @if (match(); as battle) { <section class="card battle-live"><div class="card-top"><div><div class="eyebrow">{{ t('BATALLA EN VIVO') }}</div><h2>{{ result() ? t(resultHeading()) : countdown() ? t('La batalla comienza en') + ' ' + countdown() : t('Escribe el fragmento para competir') }}</h2></div>@if (!result()) { <button class="button secondary" (click)="leaveBattle()" [disabled]="leaving()">{{ leaving() ? t('Saliendo…') : t('Salir') }}</button> } @else { <button class="button secondary" (click)="closeResult()">{{ t('Cerrar') }}</button> }</div>
    <p class="battle-instruction">{{ t(battle.lesson.title) }} · {{ t(battle.lesson.path) }} · {{ battle.lesson.language }} · {{ t('Sesión del catálogo común') }}</p>
    <div class="battle-scoreboard">@for (player of players(); track player.userId) { <div class="battle-player"><div class="battle-player-top"><strong>{{ player.name }}{{ player.userId === session.user()?.id ? ' (' + t('tú') + ')' : '' }}</strong><span>{{ t('Rating') }} {{ player.ratingAfter ?? player.rating }}</span></div><div class="battle-player-stats"><span>{{ player.wpm }} WPM</span><span>{{ player.accuracy }}% {{ t('precisión') }}</span><span>{{ player.errors }} {{ t('errores') }}</span></div><div class="progress-track" role="progressbar" [attr.aria-valuenow]="player.progress" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="player.progress"></span></div></div> }</div>
    <div class="battle-code" [class.battle-code-focused]="inputFocused()" [attr.aria-label]="t('Fragmento de código compartido')" (click)="focusInput()"><pre>@for (character of battle.lesson.code.split(''); track $index) {<span [class.char-done]="$index < userProgressChars()" [class.battle-cursor]="$index === userProgressChars()" [attr.aria-current]="$index === userProgressChars() ? 'step' : null">{{ character }}</span>}</pre>@if (!result()) { <textarea #input class="typing-capture" [attr.aria-label]="t('Escribe el fragmento del duelo')" (keydown)="onKeyDown($event)" (beforeinput)="onBeforeInput($event)" (input)="clearInput($event)" (paste)="$event.preventDefault()" (compositionstart)="onCompositionStart()" (compositionend)="onCompositionEnd($event)" (focus)="inputFocused.set(true)" (blur)="inputFocused.set(false)" [disabled]="countdown() > 0 || leaving()" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea> }</div>
    @if (!result()) { <p class="battle-input-hint" role="status">{{ countdown() ? t('La escritura se habilitará al terminar la cuenta regresiva.') : inputFocused() ? t('El cursor marca la siguiente tecla correcta.') : t('Haz clic en el fragmento para empezar a escribir.') }} @if (!countdown()) { <span>{{ userProgressChars() + 1 }} / {{ battle.lesson.code.length }}</span> }</p> }
    @if (messages().length) { <div class="battle-chat" aria-live="polite">@for (message of messages(); track $index) { <span><b>{{ message.name }}:</b> {{ t(message.message) }}</span> }</div> }
    <div class="quick-chat">@for (message of quickMessages; track message) { <button type="button" (click)="sendQuickMessage(message)" [disabled]="!socket?.connected">{{ t(message) }}</button> }</div>@if (status()) { <p class="inline-note" role="status">{{ t(status()) }}</p> }
  </section> }
  @if (session.token()) { <div class="friends-layout">
    <section class="card"><div class="card-title-row"><h3>{{ t('Amistades conectadas') }}</h3><span class="muted">{{ onlineFriends().length }} {{ t('en línea') }}</span></div>
      @if (friendsLoading()) { <p class="muted">{{ t('Cargando amistades…') }}</p> } @else if (friendsError()) { <p class="inline-note" role="alert">{{ t(friendsError()) }} <button type="button" class="button secondary" (click)="loadSocial()">{{ t('Reintentar') }}</button></p> } @else if (friends().length) { <div class="friend-list">@for (friend of friends(); track friend.id) { <div class="friend-row"><span class="friend-presence" [class.online]="friend.online"></span><div><strong>{{ friend.name }}</strong><small>{{ t('Rating') }} {{ friend.rating }}</small></div>@if (friendAvailable(friend) && !match() && !queued()) { <button class="button secondary" [disabled]="!socket?.connected" (click)="invite(friend)">{{ t('Invitar') }}</button> } @else if (friend.inBattle) { <small class="friend-unavailable">{{ t('En un duelo') }}</small> } @else if (friend.queued) { <small class="friend-unavailable">{{ t('Buscando rival') }}</small> } @else if (!friend.online) { <small class="friend-unavailable">{{ t('Desconectada') }}</small> }</div> }</div> } @else { <p class="muted">{{ t('Aún no tienes amistades en CodeType.') }}</p> }
    </section>
    <section class="card"><h3>{{ t('Buscar amistades') }}</h3><form class="friend-request-form" (ngSubmit)="sendRequest()"><label>{{ t('Correo de tu amistad') }}<input name="friendEmail" type="email" [(ngModel)]="email" required placeholder="friend@example.com" /></label><button class="button primary" type="submit" [disabled]="requestSending()">{{ requestSending() ? t('Enviando…') : t('Enviar solicitud') }}</button></form>
      @if (requests()?.incoming?.length) { <div class="friend-requests"><strong>Solicitudes recibidas</strong>@for (request of requests().incoming; track request.id) { <div><span>{{ request.sender.name }}</span><button type="button" (click)="respond(request.id, 'accept')">Aceptar</button><button type="button" (click)="respond(request.id, 'decline')">Rechazar</button></div> }</div> }
      @if (requests()?.outgoing?.length) { <div class="friend-requests"><strong>Solicitudes enviadas</strong>@for (request of requests().outgoing; track request.id) { <div><span>{{ request.receiver.name }}</span><small>Pendiente</small></div> }</div> }
      @if (socialNotice()) { <p class="inline-note" role="status">{{ t(socialNotice()) }}</p> }
    </section>
  </div> }
  @if (session.token() && incomingInvite(); as invitation) { <section class="card incoming-invite"><div><strong>{{ invitation.senderName }} {{ t('te invita a una batalla.') }}</strong><p>{{ t('La invitación vence en 30 segundos.') }}</p></div><button class="button primary" (click)="acceptInvite()">{{ t('Aceptar invitación') }}</button><button class="button secondary" (click)="declineInvite()">{{ t('Rechazar') }}</button></section> }
` })
export class BattlePageComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly session = inject(SessionService);
  t(text: string): string { return translate(text, this.session.language()); }
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');
  socket?: Socket;
  readonly status = signal('');
  readonly match = signal<Match | null>(null);
  readonly players = signal<Player[]>([]);
  readonly countdown = signal(0);
  readonly result = signal<any>(null);
  readonly messages = signal<Array<{ name: string; message: string }>>([]);
  readonly incomingInvite = signal<any>(null);
  readonly friends = signal<Friend[]>([]);
  readonly requests = signal<any>(null);
  readonly friendsLoading = signal(true);
  readonly friendsError = signal('');
  readonly socialNotice = signal('');
  readonly queued = signal(false);
  readonly socketConnected = signal(false);
  readonly inputFocused = signal(false);
  readonly connecting = signal(false);
  readonly leaving = signal(false);
  readonly requestSending = signal(false);
  readonly quickMessages = ['¡Buena suerte!', '¡Buen ritmo!', '¡Vamos!', '¡Bien jugado!'];
  readonly onlineFriends = () => this.friends().filter((friend) => friend.online);
  readonly userProgressChars = () => {
    const player = this.players().find((entry) => entry.userId === this.session.user()?.id);
    const length = this.match()?.lesson.code.length ?? 0;
    return Math.min(length, player?.cursor ?? Math.floor((player?.progress ?? 0) * length / 100));
  };
  private deadKeyPending = false;
  private composing = false;
  private compositionCommitted: { text: string; until: number } | null = null;
  private lastSubmittedInput: { text: string; at: number } | null = null;
  private inviteTimer?: ReturnType<typeof setTimeout>;
  private socialLoadInFlight = false;
  private cachedEmail = '';
  get email(): string { return this.cachedEmail; }
  set email(value: string) { this.cachedEmail = value; }

  constructor() {
    effect(() => {
      const token = this.session.token();
      if (!token) {
        const socket = this.socket;
        this.socket = undefined;
        this.socketConnected.set(false);
        this.queued.set(false);
        socket?.disconnect();
        return;
      }
      if (this.socket) {
        // Access-token renewal should update future reconnects without tearing
        // down a live socket and briefly abandoning an in-progress duel.
        this.socket.auth = { token };
        if (!this.socket.connected) {
          this.connecting.set(true);
          this.socket.connect();
        }
        return;
      }
      this.connecting.set(true);
      const socket = io(API_URL || undefined, { auth: { token }, transports: ['websocket'] });
      this.socket = socket;
      socket.on('connect', () => { this.socketConnected.set(true); this.connecting.set(false); this.status.set('Conectado a matchmaking.'); });
      socket.on('disconnect', () => { this.socketConnected.set(false); this.queued.set(false); this.connecting.set(true); this.status.set('Conexión interrumpida. Reconectando…'); });
      socket.on('connect_error', () => { this.socketConnected.set(false); this.connecting.set(false); this.status.set('No se pudo conectar con el servidor.'); });
      socket.on('matchmaking:queued', () => { this.queued.set(true); this.status.set('Estás en la cola. Esperando a otro jugador…'); });
      socket.on('matchmaking:cancelled', () => { this.queued.set(false); this.status.set('Búsqueda cancelada.'); });
      socket.on('matchmaking:error', (error: { message: string }) => { this.queued.set(false); this.status.set(error.message); });
      socket.on('battle:matched', (match: Match & { players: Player[] }) => { this.activateMatch(match, match.players); });
      socket.on('battle:resume', (match: Match & { players: Player[] }) => { this.activateMatch(match, match.players); this.status.set('Batalla reconectada.'); });
      socket.on('battle:progress', (update: { players: Player[] }) => this.players.set(update.players));
      socket.on('battle:finished', (result: any) => { this.result.set(result); this.players.set(result.players); this.leaving.set(false); this.status.set(''); });
      socket.on('battle:input-rejected', (error: { message: string }) => this.status.set(error.message));
      socket.on('battle:chat', (message: { name: string; message: string }) => this.messages.update((messages) => [...messages, message]));
      socket.on('battle:invitation', (invitation: any) => this.showInvite(invitation));
      socket.on('battle:invite:sent', () => this.socialNotice.set('Invitación enviada.'));
      socket.on('battle:invite:declined', () => this.socialNotice.set('La invitación fue rechazada.'));
      socket.on('battle:invite:error', (error: { message: string }) => this.socialNotice.set(error.message));
    });
    this.destroyRef.onDestroy(() => {
      if (this.inviteTimer) clearTimeout(this.inviteTimer);
      this.socket?.disconnect();
      this.socket = undefined;
      this.socketConnected.set(false);
    });
    interval(150).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const start = this.match()?.startsAt;
      this.countdown.set(start ? Math.max(0, Math.ceil((start - Date.now()) / 1000)) : 0);
    });
    interval(30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadSocial());
    effect(() => { if (this.session.token()) this.loadSocial(); });
    effect(() => { if (this.match() && !this.countdown() && !this.result()) queueMicrotask(() => this.focusInput()); });
  }

  private activateMatch(match: Match & { players: Player[] }, players: Player[]): void {
    this.match.set(match);
    this.countdown.set(Math.max(0, Math.ceil((match.startsAt - Date.now()) / 1000)));
    this.players.set(players.map((player) => ({ ...player, cursor: player.cursor ?? 0, progress: player.progress ?? 0, wpm: player.wpm ?? 0, accuracy: player.accuracy ?? 0, errors: player.errors ?? 0 })));
    this.result.set(null); this.queued.set(false); this.leaving.set(false); this.messages.set([]); this.status.set('');
  }
  focusInput(): void {
    const input = this.input()?.nativeElement;
    if (input && !input.disabled && !this.result()) input.focus({ preventScroll: true });
  }
  friendAvailable(friend: Friend): boolean { return friend.canInvite && friend.online && !friend.inBattle && !friend.queued; }
  private showInvite(invitation: any): void { this.incomingInvite.set(invitation); if (this.inviteTimer) clearTimeout(this.inviteTimer); this.inviteTimer = setTimeout(() => this.incomingInvite.set(null), Math.max(0, invitation.expiresAt - Date.now())); }

  toggleQueue(): void {
    if (!this.session.token()) { this.status.set('Inicia sesión para entrar a la cola.'); return; }
    if (!this.socket?.connected) { this.connecting.set(true); this.status.set('Conectando con matchmaking…'); this.socket?.connect(); return; }
    if (this.queued()) { this.socket.emit('matchmaking:cancel'); this.queued.set(false); this.status.set('Búsqueda cancelada.'); }
    else { this.status.set(''); this.socket.emit('matchmaking:join'); }
  }

  leaveBattle(): void { this.leaving.set(true); this.socket?.emit('battle:leave'); }
  closeResult(): void { this.match.set(null); this.players.set([]); this.result.set(null); this.messages.set([]); this.status.set(''); }
  resultHeading(): string {
    const result = this.result();
    if (!result) return '';
    if (result.winnerId === this.session.user()?.id) return '¡Ganaste el duelo!';
    if (result.players?.find((player: Player) => player.userId === this.session.user()?.id)?.abandoned) return 'Abandonaste la batalla';
    return result.winnerId ? 'Duelo terminado' : 'Empate';
  }

  onKeyDown(event: KeyboardEvent): void {
    if (this.countdown() > 0 || this.result()) { event.preventDefault(); return; }
    if (event.isComposing || this.composing) return;
    if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); this.submitKey(event.key); this.deadKeyPending = false; return; }
    if (event.key === 'Dead') { this.deadKeyPending = true; return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); return; }
    if ((event.ctrlKey || event.metaKey) && !event.getModifierState('AltGraph')) return;
    if (event.altKey && !event.getModifierState('AltGraph')) return;
    // Use the same layout-resolved character as the lesson engine. Dead keys
    // and IME input still fall through to beforeinput/composition events.
    if (this.deadKeyPending && event.key.length === 1) return;
    if (event.key.length === 1) { event.preventDefault(); this.deadKeyPending = false; this.submitKey(event.key); return; }
    if (event.key.length > 1 && !['Shift', 'Control', 'Alt', 'Meta', 'Process'].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault();
  }
  onBeforeInput(event: InputEvent): void {
    if (event.inputType === 'insertCompositionText' || event.inputType === 'insertFromComposition' || this.composing) return;
    if (event.inputType.startsWith('insertFrom')) { event.preventDefault(); this.deadKeyPending = false; return; }
    if (this.compositionCommitted && Date.now() < this.compositionCommitted.until && event.data === this.compositionCommitted.text && event.inputType === 'insertText') { event.preventDefault(); this.compositionCommitted = null; return; }
    if (event.data && this.lastSubmittedInput && Date.now() - this.lastSubmittedInput.at < 250 && event.data === this.lastSubmittedInput.text && event.inputType === 'insertText') { event.preventDefault(); this.lastSubmittedInput = null; return; }
    if (event.data && (event.inputType === 'insertText' || this.deadKeyPending)) { event.preventDefault(); this.deadKeyPending = false; this.submitKey(event.data); }
  }
  onCompositionStart(): void { this.composing = true; }
  onCompositionEnd(event: CompositionEvent): void { this.composing = false; if (event.data) { this.submitKey(event.data); this.compositionCommitted = { text: event.data, until: Date.now() + 500 }; } if (event.target instanceof HTMLTextAreaElement) event.target.value = ''; }
  private submitKey(key: string): void {
    if (key.length === 1) this.lastSubmittedInput = { text: key, at: Date.now() };
    this.socket?.emit('battle:key', { key }, (ack: { handled?: boolean; players?: Player[] }) => {
      if (ack?.handled && ack.players) this.players.set(ack.players);
    });
  }
  clearInput(event: Event): void {
    if (this.composing) return;
    const input = event.target as HTMLTextAreaElement;
    const value = input.value;
    input.value = '';
    if (!value) return;
    if (this.lastSubmittedInput && Date.now() - this.lastSubmittedInput.at < 250 && value === this.lastSubmittedInput.text) { this.lastSubmittedInput = null; return; }
    for (const character of value) this.submitKey(character);
  }
  sendQuickMessage(message: string): void { this.socket?.emit('battle:quick-chat', { message }); }

  invite(friend: Friend): void { this.socket?.emit('battle:invite', { friendId: friend.id }); this.socialNotice.set('Enviando invitación…'); }
  acceptInvite(): void { const invitation = this.incomingInvite(); if (invitation) this.socket?.emit('battle:invite:accept', { inviteId: invitation.id }); this.incomingInvite.set(null); }
  declineInvite(): void { const invitation = this.incomingInvite(); if (invitation) this.socket?.emit('battle:invite:decline', { inviteId: invitation.id }); this.incomingInvite.set(null); }

  async sendRequest(): Promise<void> {
    if (!this.session.token() || !this.email.trim()) return;
    this.requestSending.set(true); this.socialNotice.set('');
    try {
      const data = await firstValueFrom(this.http.post<any>(`${API_URL}/friends/requests`, { email: this.email }));
      this.email = '';
      this.socialNotice.set(data.accepted ? 'Solicitud recíproca aceptada; ya son amistades.' : 'Solicitud de amistad enviada.');
      this.loadSocial();
    } catch (error) { this.socialNotice.set(this.errorMessage(error, 'No se pudo enviar la solicitud.')); }
    finally { this.requestSending.set(false); }
  }

  async respond(id: string, action: 'accept' | 'decline'): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_URL}/friends/requests/${id}/${action}`, {}));
      this.socialNotice.set(action === 'accept' ? 'Solicitud aceptada.' : 'Solicitud rechazada.'); this.loadSocial();
    } catch (error) { this.socialNotice.set(this.errorMessage(error, 'No se pudo responder a la solicitud.')); }
  }

  loadSocial(): void {
    if (!this.session.token() || this.socialLoadInFlight) return;
    this.socialLoadInFlight = true;
    this.friendsLoading.set(this.friends().length === 0);
    forkJoin({
      friends: this.http.get<Friend[]>(`${API_URL}/friends`),
      requests: this.http.get<any>(`${API_URL}/friends/requests`),
    }).pipe(timeout({ first: 10_000 }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ friends, requests }) => {
        this.friends.set(friends);
        this.requests.set(requests);
        this.friendsError.set('');
        this.friendsLoading.set(false);
        this.socialLoadInFlight = false;
      },
      error: (error) => {
        this.friendsError.set(this.errorMessage(error, 'No se pudieron cargar las amistades.'));
        this.friendsLoading.set(false);
        this.socialLoadInFlight = false;
      },
    });
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) return fallback;
    if (error.status === 429) return 'Se alcanzó el límite de solicitudes. Espera un momento y vuelve a intentar.';
    return error.error?.error ?? error.error?.message ?? fallback;
  }
}
