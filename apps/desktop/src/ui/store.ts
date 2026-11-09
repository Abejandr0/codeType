import { create } from 'zustand';
type User = { id:string; name:string; email:string; xp:number; rating:number };
type State = { accessToken:string|null; user:User|null; sessionChecked:boolean; interfaceLanguage:'ES'|'EN'; setSession:(accessToken:string,user:User)=>void; setInterfaceLanguage:(language:'ES'|'EN')=>void; markSessionChecked:()=>void; clearSession:()=>void };
export const useAppStore = create<State>(set => ({ accessToken: null, user: null, sessionChecked:false, interfaceLanguage:'ES', setSession:(accessToken,user)=>set({accessToken,user,sessionChecked:true}), setInterfaceLanguage:interfaceLanguage=>set({interfaceLanguage}), markSessionChecked:()=>set({sessionChecked:true}), clearSession:()=>set({accessToken:null,user:null,sessionChecked:true}) }));
