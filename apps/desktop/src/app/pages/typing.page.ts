import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { calculateMetrics, typeCharacter, typingKeyInstruction } from '@codetype/shared';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-javascript';
import { API_URL, SessionService } from '../core/session.service';
import { VirtualKeyboardComponent } from '../shared/virtual-keyboard.component';
import { firstValueFrom, interval, map } from 'rxjs';
import { translate } from '../core/translation';

interface Lesson { id: string; title: string; language: string; path: string; level: number; code: string; tip: string; minAccuracy: number; status: string }
interface KeyRecord { expected: string; actual: string; elapsedMs: number; correct: boolean }
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

@Component({ standalone: true, imports: [RouterLink, VirtualKeyboardComponent], template: `
  <div class="typing-page">
  <div class="lesson-toolbar"><a routerLink="/ejercicios" class="back-link">← {{ t('Ejercicios') }}</a></div>
  @if (loading()) { <section class="card">{{ t('Cargando la lección…') }}</section> }
  @else if (error()) { <section class="card empty-state"><h2>{{ t('No se pudo abrir esta lección') }}</h2><p>{{ t(error()) }}</p></section> }
  @else if (lesson(); as item) {
    <div class="typing-session-header"><div><div class="eyebrow">{{ t('PRÁCTICA DE CÓDIGO') }}</div><h1>{{ t('Práctica de código') }}</h1><p>{{ t(item.title) }} · {{ t(item.path) }} · {{ t('Nivel') }} {{ item.level }}</p></div><div class="typing-clock"><strong>{{ clock() }}</strong><span>{{ item.language }}</span></div></div>
    <section class="card typing-metrics"><div><small>WPM</small><b>{{ metrics().wpm }}</b></div><div><small>{{ t('Precisión') }}</small><b>{{ metrics().accuracy }}%</b></div><div><small>{{ t('Errores') }}</small><b>{{ errors() }}</b></div><div><small>{{ t('Progreso') }}</small><b>{{ cursor() }} / {{ item.code.length }}</b></div></section>
    @if (started() && !done()) { <div class="typing-session-controls"><span class="typing-active-label">{{ t(paused() ? 'Práctica pausada' : 'Tiempo activo') }}</span><button class="button secondary" type="button" (click)="togglePause()">{{ paused() ? t('Reanudar') : t('Pausar') }}</button></div> }
    <section class="card typing-card"><div class="typing-code" (click)="focusEditor()" [attr.aria-label]="t('Fragmento de código para transcribir')"><pre [style.font-size.px]="fontSize()">@for (character of characters(); track $index) { <span [class]="character.className">{{ character.value }}</span> }</pre></div><textarea #editor class="typing-capture" [attr.aria-label]="t('Escribe el código tal como aparece. Pegar está desactivado.')" (keydown)="onKeyDown($event)" (beforeinput)="onBeforeInput($event)" (input)="clearNativeInput($event)" (paste)="$event.preventDefault()" (compositionstart)="onCompositionStart()" (compositionend)="onCompositionEnd($event)" [disabled]="done() || paused()" autocapitalize="off" autocorrect="off" spellcheck="false"></textarea><div class="typing-hint" role="status" aria-live="polite"><span>{{ t('Siguiente carácter:') }} <kbd>{{ nextKeyLabel() }}</kbd></span>@if (inputFeedback()) { <strong>{{ inputFeedback() }}</strong> } @else { <span>{{ t('Pegar está desactivado.') }}</span> }</div></section>
    <div class="typing-support-grid"><section class="card typing-keyboard-card"><app-virtual-keyboard [layout]="layout()" [nextKey]="nextKey()" [shiftRequired]="shiftRequired()" /></section><section class="card typing-tip"><div class="eyebrow">{{ t('¿QUÉ HACE ESTE CÓDIGO?') }}</div><p>{{ t(item.tip) }}</p><span>{{ done() ? t('Fragmento completado') : t('Siguiente tecla:') + ' ' + nextKeyLabel() }}</span></section></div>
    @if (done()) { <section class="card result-card"><div class="result-check">✓</div><div><h3>{{ t('¡Lección completada!') }}</h3><p>{{ t('Resultado:') }} {{ finalMetrics().accuracy }}% {{ t('de precisión') }} · {{ finalMetrics().wpm }} WPM. {{ t(saveMessage()) }}</p></div>@if (saveState() === 'error') { <button class="button secondary" (click)="submit()">{{ t('Reintentar guardado') }}</button> }<button class="button secondary" (click)="reset()">↻ {{ t('Repetir') }}</button></section> }
  }
  </div>
` })
export class TypingPageComponent {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly routeId = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), { initialValue: null });
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');
  private records: KeyRecord[] = [];
  private bad = new Set<number>();
  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private pausedDuration = 0;
  private composing = false;
  private compositionCommitted: { text: string; until: number } | null = null;
  private startedEffect = false;
  private deadKeyPending = false;
  private audioContext: AudioContext | null = null;
  private settings: any = null;
  private lessonId = '';
  readonly lesson = signal<Lesson | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly cursor = signal(0);
  readonly errors = signal(0);
  readonly elapsed = signal(0);
  readonly done = signal(false);
  readonly started = signal(false);
  readonly paused = signal(false);
  readonly saveState = signal<SaveState>('idle');
  readonly layout = signal('ES');
  readonly fontSize = signal(16);
  readonly metrics = signal(calculateMetrics(0, 0, 0));
  readonly finalMetrics = signal(calculateMetrics(0, 0, 0));
  readonly clock = signal('00:00');
  t(text: string): string { return translate(text, this.session.language()); }
  readonly characters = signal<Array<{ value: string; className: string }>>([]);
  readonly nextKey = signal('');
  readonly nextKeyLabel = signal('');
  readonly shiftRequired = signal(false);
  readonly inputFeedback = signal('');
  readonly saveMessage = () => this.saveState() === 'saving' ? 'Guardando tu intento…' : this.saveState() === 'saved' ? 'Intento guardado en tu cuenta.' : this.saveState() === 'error' ? 'No se pudo guardar el intento.' : '';

  constructor() {
    interval(250).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.startedAt !== null && !this.done() && !this.paused()) this.refreshMetrics();
    });
    effect(() => {
      const id = this.routeId();
      const token = this.session.token();
      if (id && token && id !== this.lessonId) { this.lessonId = id; this.resetState(); this.error.set(''); this.loadLesson(id); }
    });
    effect(() => {
      const token = this.session.token();
      if (!token || this.startedEffect) return;
      this.startedEffect = true;
      this.http.get<any>(`${API_URL}/settings`).subscribe({ next: (settings) => { this.settings = settings; this.layout.set(settings.keyboardLayout ?? 'ES'); this.fontSize.set(settings.editorFontSize ?? 16); this.updateView(); }, error: () => undefined });
    });
  }

  private loadLesson(id: string): void {
    this.loading.set(true);
    this.http.get<Lesson[]>(`${API_URL}/lessons`).subscribe({ next: (lessons) => {
      const selected = lessons.find((item) => item.id === id);
      if (!selected) this.error.set('No encontramos esta lección.');
      else if (selected.status === 'locked') this.error.set('Completa la ruta anterior para desbloquear esta lección.');
      else { this.lesson.set(selected); this.updateView(); }
      this.loading.set(false);
    }, error: (response) => { this.error.set(response.error?.error ?? 'No se pudo consultar el contenido.'); this.loading.set(false); } });
  }

  focusEditor(): void { this.editor()?.nativeElement.focus(); }

  onKeyDown(event: KeyboardEvent): void {
    if (this.paused() || this.done()) { event.preventDefault(); return; }
    if (event.isComposing || this.composing) return;
    if (event.key === 'Dead') { this.deadKeyPending = true; return; }
    if (event.key === 'Enter') { event.preventDefault(); const code = this.lesson()?.code ?? ''; const indent = code.slice(this.cursor() + 1).match(/^[ \t]*/)?.[0] ?? ''; this.consume('\n' + indent); return; }
    if (event.key === 'Tab') { event.preventDefault(); const code = this.lesson()?.code ?? ''; const lineStart = code.lastIndexOf('\n', this.cursor() - 1) + 1; const prefix = code.slice(lineStart, this.cursor()); const indentation = code.slice(this.cursor()).match(/^[ \t]+/)?.[0] ?? ''; this.consume(prefix.trim() === '' && indentation ? indentation.slice(0, Math.min(4, indentation.length)) : '\t'); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); return; }
    if ((event.ctrlKey || event.metaKey) && !event.getModifierState('AltGraph')) return;
    if (event.altKey && !event.getModifierState('AltGraph')) return;
    // Keydown gives browsers such as Firefox a reliable printable-character path.
    // event.key already contains the layout result (including Shift and AltGr).
    if (this.deadKeyPending && event.key.length === 1) return;
    if (event.key.length === 1) { event.preventDefault(); this.deadKeyPending = false; this.consume(event.key); return; }
    if (event.key === 'Escape') { event.preventDefault(); return; }
    if (event.key.length !== 1 && !['Shift', 'Control', 'Alt', 'Meta', 'Process'].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault();
  }

  onBeforeInput(event: InputEvent): void {
    if (this.paused() || this.done()) { event.preventDefault(); return; }
    if (event.inputType === 'insertCompositionText' || event.inputType === 'insertFromComposition' || this.composing) return;
    if (event.inputType.startsWith('insertFrom')) { event.preventDefault(); this.deadKeyPending = false; return; }
    if (this.compositionCommitted && Date.now() < this.compositionCommitted.until && event.data === this.compositionCommitted.text && event.inputType === 'insertText') {
      event.preventDefault(); this.compositionCommitted = null; return;
    }
    if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') { event.preventDefault(); this.consume('\n'); return; }
    if (event.data && (event.inputType === 'insertText' || this.deadKeyPending)) { event.preventDefault(); this.deadKeyPending = false; this.consume(event.data); }
  }

  onCompositionStart(): void { this.composing = true; }
  onCompositionEnd(event: CompositionEvent): void { this.composing = false; if (event.data) { this.deadKeyPending = false; this.consume(event.data); this.compositionCommitted = { text: event.data, until: Date.now() + 500 }; } if (event.target instanceof HTMLTextAreaElement) event.target.value = ''; }
  clearNativeInput(event: Event): void {
    if (this.composing) return;
    const textarea = event.target as HTMLTextAreaElement;
    const value = textarea.value;
    textarea.value = '';
    if (value) this.consume(value);
  }

  private consume(value: string): void {
    const lesson = this.lesson();
    if (!lesson || this.done() || this.paused()) return;
    const now = Date.now();
    if (this.startedAt === null) { this.startedAt = now; this.started.set(true); }
    for (const character of value) {
      const position = this.cursor();
      const step = typeCharacter(lesson.code, position, character);
      const elapsedMs = this.activeElapsed(now);
      this.records.push({ expected: lesson.code[position] ?? '', actual: character, elapsedMs, correct: step.correct });
      if (step.correct) { this.cursor.set(step.cursor); this.bad.delete(position); this.inputFeedback.set(''); }
      else { this.errors.update((count) => count + 1); this.bad.add(position); this.inputFeedback.set(this.mismatchMessage(lesson.code[position] ?? '', character)); }
      if (this.settings?.sounds) this.playKey(step.correct);
      if (step.complete) {
        const duration = Math.max(1, elapsedMs);
        this.done.set(true);
        this.elapsed.set(duration);
        this.finalMetrics.set(calculateMetrics(step.cursor, this.errors(), duration));
        void this.submit();
        break;
      }
    }
    this.refreshMetrics();
    this.updateView();
  }

  private playKey(correct: boolean): void {
    try {
      this.audioContext ??= new AudioContext();
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      oscillator.frequency.value = correct ? 640 : 210;
      gain.gain.value = 0.025;
      oscillator.connect(gain); gain.connect(this.audioContext.destination);
      oscillator.start(); oscillator.stop(this.audioContext.currentTime + 0.035);
    } catch { /* El sonido no está disponible en algunos entornos. */ }
  }

  private refreshMetrics(): void {
    const now = this.pausedAt ?? Date.now();
    const elapsed = this.startedAt === null ? 0 : this.activeElapsed(now);
    this.elapsed.set(elapsed);
    this.metrics.set(calculateMetrics(this.cursor(), this.errors(), elapsed));
    this.clock.set(`${String(Math.floor(elapsed / 60_000)).padStart(2, '0')}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}`);
  }

  private activeElapsed(now: number): number {
    if (this.startedAt === null) return 0;
    const pausedSoFar = this.pausedDuration + (this.pausedAt === null ? 0 : Math.max(0, now - this.pausedAt));
    return Math.max(0, now - this.startedAt - pausedSoFar);
  }

  togglePause(): void {
    if (this.startedAt === null || this.done()) return;
    if (this.paused()) {
      if (this.pausedAt !== null) this.pausedDuration += Date.now() - this.pausedAt;
      this.pausedAt = null;
      this.paused.set(false);
      this.refreshMetrics();
      queueMicrotask(() => this.focusEditor());
    } else {
      this.pausedAt = Date.now();
      this.paused.set(true);
      this.refreshMetrics();
    }
  }

  private updateView(): void {
    const lesson = this.lesson();
    if (!lesson) return;
    const types = syntaxTypes(lesson.code, lesson.language);
    this.characters.set(Array.from(lesson.code, (value, index) => ({ value, className: [types[index] ? `syntax-${types[index]}` : '', index < this.cursor() ? 'char-done' : '', index === this.cursor() ? 'char-cursor' : '', this.bad.has(index) ? 'char-error' : ''].filter(Boolean).join(' ') })));
    const next = lesson.code[this.cursor()] ?? '';
    this.nextKey.set(next === '\n' ? 'Enter' : next === '\t' ? 'Tab' : next);
    const instruction = typingKeyInstruction(next, this.layout() as 'ES' | 'LATAM' | 'US');
    this.shiftRequired.set(instruction.shift);
    const keyLabel = instruction.key === 'Espacio' ? this.t('Espacio') : instruction.shift ? instruction.key.toLocaleUpperCase(this.session.language() === 'EN' ? 'en' : 'es') : instruction.key;
    this.nextKeyLabel.set(next ? `${instruction.shift ? `${this.t('Mayús')} + ` : ''}${keyLabel}` : '—');
  }

  private mismatchMessage(expected: string, actual: string): string {
    const expectedLabel = this.readableKey(expected);
    const actualLabel = this.readableKey(actual);
    const shiftHint = this.shiftRequired() ? ` ${this.t('Pulsa')} ${this.nextKeyLabel()}.` : '';
    return this.session.language() === 'EN'
      ? `Expected “${expectedLabel}”, received “${actualLabel}”.${this.shiftRequired() ? ` Press ${this.nextKeyLabel()}.` : ''}`
      : `Se esperaba “${expectedLabel}” y llegó “${actualLabel}”.${shiftHint}`;
  }

  private readableKey(character: string): string {
    return character === ' ' ? this.t('Espacio') : character === '\n' ? 'Enter' : character === '\t' ? 'Tab' : character;
  }

  async submit(): Promise<void> {
    const lesson = this.lesson();
    if (!lesson || !this.session.token()) return;
    const durationMs = Math.max(1, this.activeElapsed(this.pausedAt ?? Date.now()));
    this.saveState.set('saving');
    try {
      const result = await firstValueFrom(this.http.post<any>(`${API_URL}/lessons/complete`, { lessonId: lesson.id, correctChars: this.cursor(), errors: this.errors(), durationMs: Math.round(durationMs), keystrokes: this.records }));
      this.finalMetrics.set(result.metrics);
      this.saveState.set('saved');
      if (this.settings?.notifications) void window.codeTypeDesktop?.notifyPracticeComplete({ lessonTitle: lesson.title, accuracy: result.metrics.accuracy, wpm: result.metrics.wpm });
    } catch { this.saveState.set('error'); }
  }

  reset(): void { this.resetState(); this.updateView(); this.focusEditor(); }
  private resetState(): void { this.records = []; this.bad.clear(); this.startedAt = null; this.started.set(false); this.pausedAt = null; this.pausedDuration = 0; this.paused.set(false); this.composing = false; this.compositionCommitted = null; this.cursor.set(0); this.errors.set(0); this.elapsed.set(0); this.done.set(false); this.saveState.set('idle'); this.inputFeedback.set(''); this.metrics.set(calculateMetrics(0, 0, 0)); this.finalMetrics.set(calculateMetrics(0, 0, 0)); this.clock.set('00:00'); }
}

function syntaxTypes(code: string, language: string): string[] {
  const grammar = Prism.languages[language.toLowerCase()] ?? Prism.languages.clike;
  const output: string[] = [];
  const walk = (items: Array<string | Prism.Token>, parent = ''): void => { for (const item of items) { if (typeof item === 'string') { for (let index = 0; index < item.length; index++) output.push(parent); } else { const contents = Array.isArray(item.content) ? item.content : [item.content]; walk(contents, item.type ?? parent); } } };
  walk(Prism.tokenize(code, grammar));
  return output;
}
