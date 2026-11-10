import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, interval } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { API_URL, SessionService } from '../core/session.service';

interface Friend { id: string; name: string; rating: number; online: boolean }
interface Match { battleId: string; startsAt: number; lesson: { id: string; title: string; language: string; code: string } }
interface Player { userId: string; name: string; rating: number; ratingAfter?: number; progress: number; wpm: number; accuracy: number; errors: number; abandoned?: boolean }

@Component({ standalone: true, imports: [FormsModule], template: `
  <header class="page-heading"><div><div class="eyebrow">COMPITE Y APRENDE</div><h1>Batalla de Código 1v1</h1><p>Mide tu velocidad en tiempo real contra otra persona.</p></div></header>
  @if (!match()) { <section class="card battle-panel"><div class="battle-swords">⚔</div><h2>¿Listo para el duelo?</h2><p>Te emparejaremos en una cola real. Ambos competirán con el mismo fragmento de código.</p><button class="button primary" (click)="toggleQueue()" [disabled]="!session.token() || !socketConnected()">{{ queued() ? 'Cancelar búsqueda' : socketConnected() ? 'Buscar oponente' : 'Conectando…' }} ›</button>@if (status()) { <p class="inline-note" role="status">{{ status() }}</p> }<div class="battle-features"><span>◷ Cola en vivo</span><span>✓ Progreso validado</span><span>★ Rating Elo</span></div></section> }
  @if (match(); as battle) { <section class="card battle-live"><div class="card-top"><div><div class="eyebrow">BATALLA EN VIVO</div><h2>{{ result() ? resultHeading() : countdown() ? 'La batalla comienza en ' + countdown() : 'Escribe el fragmento para competir' }}</h2></div>@if (!result()) { <button class="button secondary" (click)="leaveBattle()" [disabled]="leaving()">{{ leaving() ? 'Saliendo…' : 'Salir' }}</button> } @else { <button class="button secondary" (click)="closeResult()">Cerrar</button> }</div>
    <p class="battle-instruction">{{ battle.lesson.title }} · {{ battle.lesson.language }}</p>
    <div class="battle-scoreboard">@for (player of players(); track player.userId) { <div class="battle-player"><div class="battle-player-top"><strong>{{ player.name }}{{ player.userId === session.user()?.id ? ' (tú)' : '' }}</strong><span>Rating {{ player.ratingAfter ?? player.rating }}</span></div><div class="battle-player-stats"><span>{{ player.wpm }} WPM</span><span>{{ player.accuracy }}% precisión</span><span>{{ player.errors }} errores</span></div><div class="progress-track" role="progressbar" [attr.aria-valuenow]="player.progress" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="player.progress"></span></div></div> }</div>
    <div class="battle-code" aria-label="Fragmento de código compartido"><pre>@for (character of battle.lesson.code.split(''); track $index) { <span [class.char-done]="$index < userProgressChars()">{{ character }}</span> }</pre></div>
    @if (!result()) { <textarea #input class="typing-capture" aria-label="Escribe el fragmento del duelo" (keydown)="onKeyDown($event)" (beforeinput)="onBeforeInput($event)" (input)="clearInput($event)" (paste)="$event.preventDefault()" (compositionend)="onCompositionEnd($event)" [disabled]="countdown() > 0 || leaving()" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea> }
    @if (messages().length) { <div class="battle-chat" aria-live="polite">@for (message of messages(); track $index) { <span><b>{{ message.name }}:</b> {{ message.message }}</span> }</div> }
    <div class="quick-chat">@for (message of quickMessages; track message) { <button type="button" (click)="sendQuickMessage(message)" [disabled]="!socket?.connected">{{ message }}</button> }</div>@if (status()) { <p class="inline-note" role="status">{{ status() }}</p> }
  </section> }
  <div class="friends-layout">
    <section class="card"><div class="card-title-row"><h3>Amistades conectadas</h3><span class="muted">{{ onlineFriends().length }} en línea</span></div>
      @if (friendsLoading()) { <p class="muted">Cargando amistades…</p> } @else if (friendsError()) { <p class="inline-note">{{ friendsError() }}</p> } @else if (friends().length) { <div class="friend-list">@for (friend of friends(); track friend.id) { <div class="friend-row"><span class="friend-presence" [class.online]="friend.online"></span><div><strong>{{ friend.name }}</strong><small>Rating {{ friend.rating }}</small></div><button class="button secondary" [disabled]="!friend.online || !socket?.connected || !!match()" (click)="invite(friend)">Invitar</button></div> }</div> } @else { <p class="muted">Aún no tienes amistades en CodeType.</p> }
    </section>
    <section class="card"><h3>Buscar amistades</h3><form class="friend-request-form" (ngSubmit)="sendRequest()"><label>Correo de tu amistad<input name="friendEmail" type="email" [(ngModel)]="email" required placeholder="amigo@correo.com" /></label><button class="button primary" type="submit" [disabled]="requestSending()">{{ requestSending() ? 'Enviando…' : 'Enviar solicitud' }}</button></form>
      @if (requests()?.incoming?.length) { <div class="friend-requests"><strong>Solicitudes recibidas</strong>@for (request of requests().incoming; track request.id) { <div><span>{{ request.sender.name }}</span><button type="button" (click)="respond(request.id, 'accept')">Aceptar</button><button type="button" (click)="respond(request.id, 'decline')">Rechazar</button></div> }</div> }
      @if (requests()?.outgoing?.length) { <div class="friend-requests"><strong>Solicitudes enviadas</strong>@for (request of requests().outgoing; track request.id) { <div><span>{{ request.receiver.name }}</span><small>Pendiente</small></div> }</div> }
      @if (socialNotice()) { <p class="inline-note" role="status">{{ socialNotice() }}</p> }
    </section>
  </div>
  @if (incomingInvite(); as invitation) { <section class="card incoming-invite"><div><strong>{{ invitation.senderName }} te invita a una batalla.</strong><p>La invitación vence en 30 segundos.</p></div><button class="button primary" (click)="acceptInvite()">Aceptar invitación</button><button class="button secondary" (click)="declineInvite()">Rechazar</button></section> }
` })
export class BattlePageComponent {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly session = inject(SessionService);
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
  readonly connecting = signal(false);
  readonly leaving = signal(false);
  readonly requestSending = signal(false);
  readonly quickMessages = ['¡Buena suerte!', '¡Buen ritmo!', '¡Vamos!', '¡Bien jugado!'];
  readonly onlineFriends = () => this.friends().filter((friend) => friend.online);
  readonly userProgressChars = () => Math.floor((this.players().find((player) => player.userId === this.session.user()?.id)?.progress ?? 0) * (this.match()?.lesson.code.length ?? 0) / 100);
  private deadKeyPending = false;
  private inviteTimer?: ReturnType<typeof setTimeout>;
  private cachedEmail = '';
  get email(): string { return this.cachedEmail; }
  set email(value: string) { this.cachedEmail = value; }

  constructor() {
    effect((onCleanup) => {
      const token = this.session.token();
      if (!token) return;
      this.connecting.set(true);
      const socket = io(API_URL, { auth: { token }, transports: ['websocket'] });
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
      onCleanup(() => { socket.disconnect(); this.socketConnected.set(false); if (this.socket === socket) this.socket = undefined; });
    });
    interval(150).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const start = this.match()?.startsAt;
      this.countdown.set(start ? Math.max(0, Math.ceil((start - Date.now()) / 1000)) : 0);
      if (start && !this.countdown()) this.input()?.nativeElement.focus();
    });
    interval(5000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => { if (this.session.token()) this.loadSocial(); });
    effect(() => { if (this.session.token()) this.loadSocial(); });
    effect(() => { if (this.match() && !this.countdown() && !this.result()) queueMicrotask(() => this.input()?.nativeElement.focus()); });
  }

  private activateMatch(match: Match & { players: Player[] }, players: Player[]): void {
    this.match.set(match);
    this.countdown.set(Math.max(0, Math.ceil((match.startsAt - Date.now()) / 1000)));
    this.players.set(players.map((player) => ({ ...player, progress: player.progress ?? 0, wpm: player.wpm ?? 0, accuracy: player.accuracy ?? 100, errors: player.errors ?? 0 })));
    this.result.set(null); this.queued.set(false); this.leaving.set(false); this.messages.set([]); this.status.set('');
  }
  private showInvite(invitation: any): void { this.incomingInvite.set(invitation); if (this.inviteTimer) clearTimeout(this.inviteTimer); this.inviteTimer = setTimeout(() => this.incomingInvite.set(null), Math.max(0, invitation.expiresAt - Date.now())); }

  toggleQueue(): void {
    if (!this.session.token()) { this.status.set('Inicia sesión para entrar a la cola.'); return; }
    if (!this.socket?.connected) { this.connecting.set(true); this.status.set('Conectando con matchmaking…'); return; }
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
    if (event.key === 'Enter' || event.key === 'Tab' || event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); this.submitKey(event.key); this.deadKeyPending = false; }
    else if (event.key === 'Dead') this.deadKeyPending = true;
    else if (event.key.length > 1 && !['Shift', 'Control', 'Alt', 'Meta', 'Process'].includes(event.key)) event.preventDefault();
  }
  onBeforeInput(event: InputEvent): void { if (event.data && (event.inputType === 'insertText' || this.deadKeyPending)) { event.preventDefault(); this.deadKeyPending = false; this.submitKey(event.data); } else if (event.inputType.startsWith('insertFrom')) event.preventDefault(); }
  onCompositionEnd(event: CompositionEvent): void { if (event.data) this.submitKey(event.data); }
  private submitKey(key: string): void {
    this.socket?.emit('battle:key', { key }, (ack: { handled?: boolean; players?: Player[] }) => {
      if (ack?.handled && ack.players) this.players.set(ack.players);
    });
  }
  clearInput(event: Event): void { (event.target as HTMLTextAreaElement).value = ''; }
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

  private loadSocial(): void {
    this.friendsLoading.set(true);
    this.http.get<Friend[]>(`${API_URL}/friends`).subscribe({ next: (friends) => { this.friends.set(friends); this.friendsError.set(''); this.friendsLoading.set(false); }, error: (error) => { this.friendsError.set(this.errorMessage(error, 'No se pudieron cargar las amistades.')); this.friendsLoading.set(false); } });
    this.http.get<any>(`${API_URL}/friends/requests`).subscribe({ next: (requests) => this.requests.set(requests), error: () => this.requests.set(null) });
  }

  private errorMessage(error: unknown, fallback: string): string { return error instanceof HttpErrorResponse ? error.error?.error ?? fallback : fallback; }
}
