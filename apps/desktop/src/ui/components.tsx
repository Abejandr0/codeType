import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Keyboard } from 'lucide-react';
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`card ${className}`}>{children}</section>; }
export function Button({ children, variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary' }) { return <button className={`button ${variant}`} {...props}>{children}</button>; }
export function ProgressBar({ value }: { value:number }) { return <div className="progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${Math.min(100,Math.max(0,value))}%`}}/></div>; }
export function StatPill({ icon, label, value }: { icon:ReactNode; label:string; value:string }) { return <div className="stat-pill"><span>{icon}</span><small>{label}</small><b>{value}</b></div>; }
export function VirtualKeyboard({ nextKey, layout='ES' }: { nextKey:string; layout?:string }) {
  const key=(label:string,values:string[]=[])=>({label,values:values.length?values:[label]});
  const numberRow=['1','2','3','4','5','6','7','8','9','0'].map((value,i)=>key(value,[value,['!','@','#','$','%','^','&','*','(',')'][i]]));
  const rowOne=Array.from('qwertyuiop',letter=>key(letter.toUpperCase(),[letter,letter.toUpperCase()]));
  const middle=Array.from(layout==='US'?'asdfghjkl':'asdfghjklñ',letter=>key(letter.toUpperCase(),[letter,letter.toUpperCase()]));
  const bottom=[key('⇧',[]),...Array.from('zxcvbnm',letter=>key(letter.toUpperCase(),[letter,letter.toUpperCase()])),key(',',[',','<']),key('.', ['.','>']),key('/', ['/', '?']),key('⌫',[])];
  const rows=[numberRow,rowOne,middle,bottom];
  return <div className={`virtual-keyboard layout-${layout.toLowerCase()}`} aria-label={`Teclado virtual ${layout}`}>
    {rows.map((row,index)=><div className={`key-row key-row-${index+1}`} key={index}>{row.map((item,i)=><span key={`${item.label}-${i}`} className={`key ${index===0?'key-number':''} ${index===1||index===2?'key-letter':''} ${index===3&&i>=8?'key-symbol':''} ${item.values.includes(nextKey)?'key-next':''}`}>{item.label}</span>)}</div>)}
    <div className="key-row key-row-bottom"><span className={`key key-space ${nextKey===' '?'key-next':''}`}><Keyboard size={13}/> Espacio</span><span className={`key key-enter ${nextKey==='Enter'?'key-next':''}`}>↵ Enter</span></div>
  </div>;
}
