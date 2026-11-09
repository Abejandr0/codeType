import { create } from 'zustand';
type User = { id:string; name:string; email:string; xp:number; rating:number };
type State = { accessToken:string|null; user:User|null; sessionChecked:boolean; setSession:(accessToken:string,user:User)=>void; markSessionChecked:()=>void; clearSession:()=>void };
export const useAppStore = create<State>(set => ({ accessToken: null, user: null, sessionChecked:false, setSession:(accessToken,user)=>set({accessToken,user,sessionChecked:true}), markSessionChecked:()=>set({sessionChecked:true}), clearSession:()=>set({accessToken:null,user:null,sessionChecked:true}) }));
