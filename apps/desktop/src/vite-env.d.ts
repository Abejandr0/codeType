/// <reference types="vite/client" />
interface Window { codeTypeDesktop?: { platform: string; isDesktop: boolean; notifyPracticeComplete: (result:{lessonTitle:string;accuracy:number;wpm:number})=>Promise<boolean> } }
