import { Component, inject, input } from '@angular/core';
import { SessionService } from '../core/session.service';
import { translate } from '../core/translation';

interface VirtualKey { label: string; values: string[] }

@Component({ selector: 'app-virtual-keyboard', standalone: true, template: `
  <div [class]="'virtual-keyboard layout-' + layout().toLowerCase()" [attr.aria-label]="t('Teclado virtual') + ' ' + layout()">
    @for (row of rows(); track $index; let rowIndex = $index) { <div class="key-row" [class]="'key-row key-row-' + (rowIndex + 1)">@for (key of row; track key.label + $index) { <span class="key" [class.key-next]="key.values.includes(nextKey())">{{ key.label }}</span> }</div> }
    <div class="key-row key-row-bottom"><span class="key key-space" [class.key-next]="nextKey() === ' '">{{ t('Espacio') }}</span><span class="key key-enter" [class.key-next]="nextKey() === 'Enter'">↵ Enter</span></div>
  </div>
` })
export class VirtualKeyboardComponent {
  private readonly session = inject(SessionService);
  t(text: string): string { return translate(text, this.session.language()); }
  readonly layout = input('ES');
  readonly nextKey = input('');
  readonly rows = () => {
    const make = (label: string, values: string[] = [label]): VirtualKey => ({ label, values });
    const numberSymbols = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];
    const numbers = Array.from('1234567890', (key, index) => make(key, [key, numberSymbols[index]]));
    const first = Array.from('qwertyuiop', (key) => make(key.toUpperCase(), [key, key.toUpperCase()]));
    const letters = this.layout() === 'US' ? 'asdfghjkl' : 'asdfghjklñ';
    const second = Array.from(letters, (key) => make(key.toUpperCase(), [key, key.toUpperCase()]));
    const third = [...Array.from('zxcvbnm', (key) => make(key.toUpperCase(), [key, key.toUpperCase()])), make(',', [',', '<']), make('.', ['.', '>']), make('/', ['/', '?'])];
    return [numbers, first, second, third];
  };
}
