import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { Server as SocketServer } from 'socket.io';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import jsonwebtoken from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { createAdapter as createRedisSocketAdapter } from '@socket.io/redis-adapter';
import { PrismaClient } from '@prisma/client';
import { calculateMetrics, completeLessonSchema, friendRequestSchema, loginSchema, profileSchema, registerSchema, settingsSchema } from '@codetype/shared';

const prisma = new PrismaClient();
const redisUrl=process.env.REDIS_URL??'redis://localhost:6380';
const redis=new Redis(redisUrl,{maxRetriesPerRequest:null});
redis.on('error',(error:Error)=>console.error('Redis error:',error.message));
if(process.env.NODE_ENV==='production'&&!process.env.REDIS_URL)throw new Error('Configura REDIS_URL para compartir cola, presencia y salas de batalla.');
const { sign: signJwt, verify: verifyJwt } = jsonwebtoken;
const app = Fastify({ logger: true });
const accessSecret = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-before-deploy-000000';
const refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-before-deploy-000000';
if (process.env.NODE_ENV === 'production' && (accessSecret.length < 32 || refreshSecret.length < 32 || accessSecret === refreshSecret)) throw new Error('Configura dos secretos JWT distintos de al menos 32 caracteres.');
const clientOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173').split(',').map(origin=>origin.trim()).filter(Boolean);
await app.register(cors, { origin: [...clientOrigins, 'null'], credentials: true });
await app.register(cookie);
await app.register(jwt, { secret: accessSecret });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const accessCookie = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };
app.decorate('authenticate', async (request: any, reply: any) => { try { await request.jwtVerify(); } catch { return reply.code(401).send({ error: 'Inicia sesión para continuar.' }); } });
app.get('/health', async () => ({ status: 'ok' }));
app.post('/auth/register', async (request, reply) => {
  const input = registerSchema.safeParse(request.body); if (!input.success) return reply.code(400).send({ error: input.error.issues[0]?.message });
  const exists = await prisma.user.findUnique({ where: { email: input.data.email.toLowerCase() } }); if (exists) return reply.code(409).send({ error: 'Este correo ya está registrado.' });
  const user = await prisma.user.create({ data: { name: input.data.name, email: input.data.email.toLowerCase(), passwordHash: await argon2.hash(input.data.password), settings: { create: {} } } });
  return issueSession(user, reply);
});
app.post('/auth/login', async (request, reply) => {
  const input = loginSchema.safeParse(request.body); if (!input.success) return reply.code(400).send({ error: 'Correo o contraseña inválidos.' });
  const user = await prisma.user.findUnique({ where: { email: input.data.email.toLowerCase() } });
  if (!user || !(await argon2.verify(user.passwordHash, input.data.password))) return reply.code(401).send({ error: 'Correo o contraseña incorrectos.' });
  return issueSession(user, reply);
});
async function issueSession(user: { id: string; name: string; email: string; xp: number; rating: number }, reply: any) {
  const accessToken = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: '15m' });
  const refreshToken = signJwt({ sub: user.id, type: 'refresh' }, refreshSecret, { expiresIn: '30d' });
  await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hash(refreshToken), expiresAt: new Date(Date.now() + 30 * 86400_000) } });
  reply.setCookie('refreshToken', refreshToken, { ...accessCookie, maxAge: 30 * 86400, path: '/auth' });
  return { accessToken, user: { id: user.id, name: user.name, email: user.email, xp: user.xp, rating: user.rating } };
}
app.post('/auth/refresh', async (request, reply) => {
  const token = (request.cookies as any).refreshToken; if (!token) return reply.code(401).send({ error: 'Sesión expirada.' });
  try { const claims = verifyJwt(token, refreshSecret); if (typeof claims === 'string' || claims.type !== 'refresh') throw new Error('invalid'); } catch { reply.clearCookie('refreshToken', { path: '/auth' }); return reply.code(401).send({ error: 'Sesión expirada.' }); }
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!stored || stored.expiresAt < new Date()) return reply.code(401).send({ error: 'Sesión expirada.' });
  await prisma.refreshToken.delete({ where: { id: stored.id } }); return issueSession(stored.user, reply);
});
app.post('/auth/logout', async (request, reply) => { const token = (request.cookies as any).refreshToken; if (token) await prisma.refreshToken.deleteMany({ where: { tokenHash: hash(token) } }); reply.clearCookie('refreshToken', { path: '/auth' }); return { ok: true }; });
app.get('/me', { preHandler: (app as any).authenticate }, async (request: any) => prisma.user.findUnique({ where: { id: request.user.sub }, select: { id: true, name: true, email: true, xp: true, rating: true, settings: true } }));
app.patch('/me', { preHandler: (app as any).authenticate }, async (request:any,reply) => { const parsed=profileSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:parsed.error.issues[0]?.message??'Revisa los datos del perfil.'});const email=parsed.data.email.toLowerCase();const other=await prisma.user.findUnique({where:{email},select:{id:true}});if(other&&other.id!==request.user.sub)return reply.code(409).send({error:'Ese correo ya está asociado a otra cuenta.'});const user=await prisma.user.update({where:{id:request.user.sub},data:{name:parsed.data.name,email},select:{id:true,name:true,email:true,xp:true,rating:true}});return {user}; });
app.get('/settings', { preHandler: (app as any).authenticate }, async (request: any, reply) => { const [settings,user] = await Promise.all([prisma.userSettings.findUnique({ where: { userId: request.user.sub } }),prisma.user.findUnique({where:{id:request.user.sub},select:{timezone:true}})]); if (!settings||!user) return reply.code(404).send({ error: 'No encontramos las preferencias de esta cuenta.' }); return {...settings,timezone:user.timezone}; });
app.patch('/settings', { preHandler: (app as any).authenticate }, async (request: any, reply) => { const parsed = settingsSchema.safeParse(request.body); if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message }); const { timezone, ...settings } = parsed.data; let savedTimezone = timezone; if (timezone) { try { new Intl.DateTimeFormat('en-US',{timeZone:timezone}); } catch { return reply.code(400).send({error:'La zona horaria no es válida.'}); } const user = await prisma.user.update({ where: { id: request.user.sub }, data: { timezone }, select: { timezone: true } }); savedTimezone = user.timezone; } else { savedTimezone = (await prisma.user.findUnique({ where: { id: request.user.sub }, select: { timezone: true } }))?.timezone; } const saved = await prisma.userSettings.upsert({ where: { userId: request.user.sub }, create: { userId: request.user.sub, ...settings }, update: settings }); return { ...saved, timezone: savedTimezone }; });
app.get('/me/export', { preHandler: (app as any).authenticate }, async (request: any) => { const user = await prisma.user.findUnique({ where: { id: request.user.sub }, include: { settings: true, lessonAttempts: { include: { lesson: true }, orderBy: { createdAt: 'desc' } }, keystrokes: { orderBy: { createdAt: 'desc' } }, battleEntries:{include:{battle:{include:{lesson:true}}}} } }); if (!user) return { error: 'Cuenta no encontrada.' }; const { passwordHash, ...safeUser } = user; return safeUser; });
app.delete('/me', { preHandler: (app as any).authenticate }, async (request: any, reply) => { await prisma.$transaction([prisma.battle.updateMany({where:{winnerId:request.user.sub},data:{winnerId:null}}),prisma.user.delete({ where: { id: request.user.sub } })]); reply.clearCookie('refreshToken', { path: '/auth' }); return { ok: true }; });
app.get('/dashboard', { preHandler: (app as any).authenticate }, async (request: any) => {
  const user = await prisma.user.findUnique({
    where: { id: request.user.sub },
    select: { id: true, xp: true, rating: true, timezone: true, settings: { select: { dailyGoalMinutes: true } } },
  });
  if (!user) return { error: 'Cuenta no encontrada.' };

  const [attempts, lessons] = await Promise.all([
    prisma.lessonAttempt.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { lesson: { select: { id: true, title: true, language: true, path: true } } },
    }),
    prisma.lesson.findMany({ orderBy: { level: 'asc' }, select: { id: true, title: true, language: true, path: true, level: true, code: true } }),
  ]);

  const dateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: user.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const practicedDays = new Set(attempts.map((attempt) => dateKey(attempt.createdAt)));
  const today = dateKey(new Date());
  const shiftDay = (key: string, delta: number) => {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
  };
  let cursor = practicedDays.has(today) ? today : practicedDays.has(shiftDay(today, -1)) ? shiftDay(today, -1) : '';
  let streakDays = 0;
  while (cursor && practicedDays.has(cursor)) { streakDays++; cursor = shiftDay(cursor, -1); }

  const paths = [...new Set(lessons.map((lesson) => lesson.path))].sort((left, right) =>
    Math.min(...lessons.filter((lesson) => lesson.path === left).map((lesson) => lesson.level)) -
    Math.min(...lessons.filter((lesson) => lesson.path === right).map((lesson) => lesson.level)),
  );
  const passedLessonIds = new Set(attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.lessonId));
  const firstIncomplete = paths.findIndex((path) => lessons.filter((lesson) => lesson.path === path).some((lesson) => !passedLessonIds.has(lesson.id)));
  const unlockedThrough = firstIncomplete < 0 ? paths.length - 1 : firstIncomplete;
  const challengeSeed = [...today].reduce((sum, character) => sum + character.charCodeAt(0), 0) % Math.max(1, lessons.length);
  const challengeOrder = [...lessons.slice(challengeSeed), ...lessons.slice(0, challengeSeed)];
  const dailyChallenge = challengeOrder.find((lesson) => paths.indexOf(lesson.path) <= unlockedThrough) ?? null;
  const todayPracticeMs = attempts.filter((attempt) => dateKey(attempt.createdAt) === today).reduce((total, attempt) => total + attempt.durationMs, 0);
  const xp = user.xp;

  return {
    streakDays,
    timezone: user.timezone,
    xp,
    level: Math.floor(xp / 100) + 1,
    rank: xp >= 1000 ? 'Caballero' : xp >= 500 ? 'Jedi' : 'Padawan',
    rating: user.rating,
    dailyGoalMinutes: user.settings?.dailyGoalMinutes ?? 20,
    todayPracticeMs,
    recentActivities: attempts.slice(0, 3).map((attempt) => ({ wpm: attempt.wpm, accuracy: attempt.accuracy, createdAt: attempt.createdAt, lesson: attempt.lesson })),
    lastActivity: attempts[0] ? { wpm: attempts[0].wpm, accuracy: attempts[0].accuracy, createdAt: attempts[0].createdAt, lesson: attempts[0].lesson } : null,
    dailyChallenge,
  };
});
app.get('/lessons', { preHandler: (app as any).authenticate }, async (request: any) => {
  const rows = await prisma.lesson.findMany({ orderBy: { level: 'asc' }, include: { attempts: { where: { userId: request.user.sub, passed: true }, take: 1, select: { passed: true } } } });
  const paths = [...new Set(rows.map(lesson => lesson.path))].sort((a,b) => Math.min(...rows.filter(x=>x.path===a).map(x=>x.level))-Math.min(...rows.filter(x=>x.path===b).map(x=>x.level)));
  return rows.map(lesson => { const index=paths.indexOf(lesson.path); const completed=lesson.attempts.some(attempt=>attempt.passed); const previousPath=index>0?rows.filter(item=>item.path===paths[index-1]):[]; const unlocked=index===0||previousPath.length>0&&previousPath.every(item=>item.attempts.some(attempt=>attempt.passed)); return {...lesson,status:completed?'completed':unlocked?'in_progress':'locked'}; });
});
app.post('/lessons/complete', { preHandler: (app as any).authenticate }, async (request: any, reply) => {
  const input = completeLessonSchema.safeParse(request.body); if (!input.success) return reply.code(400).send({ error: input.error.issues[0]?.message });
  const lesson = await prisma.lesson.findUnique({ where: { id: input.data.lessonId } }); if (!lesson) return reply.code(404).send({ error: 'No encontramos esta lección.' });
  const catalog = await prisma.lesson.findMany({ include: { attempts: { where: { userId: request.user.sub, passed: true }, take: 1, select: { passed: true } } } });
  const orderedPaths = [...new Set(catalog.map(item => item.path))].sort((a,b) => Math.min(...catalog.filter(x=>x.path===a).map(x=>x.level))-Math.min(...catalog.filter(x=>x.path===b).map(x=>x.level)));
  const pathIndex = orderedPaths.indexOf(lesson.path);
  if (pathIndex > 0) { const prior = catalog.filter(item => item.path === orderedPaths[pathIndex-1]); if (prior.some(item => !item.attempts.some(attempt=>attempt.passed))) return reply.code(403).send({ error: 'Completa todas las lecciones de la ruta anterior para desbloquear esta.' }); }
  let cursor = 0;
  let lastElapsedMs = 0;
  for (const key of input.data.keystrokes) {
    if (key.elapsedMs < lastElapsedMs || key.elapsedMs > input.data.durationMs + 50) return reply.code(400).send({ error: 'La secuencia temporal de las pulsaciones no es válida.' });
    lastElapsedMs = key.elapsedMs;
  }
  if (input.data.durationMs < input.data.keystrokes.length * 40 || lastElapsedMs > input.data.durationMs) return reply.code(400).send({ error: 'La duración no coincide con la velocidad de escritura.' });
  const checkedKeystrokes = input.data.keystrokes.map(k => {
    const expected = lesson.code[cursor] ?? '';
    const correct = k.actual === expected && expected !== '';
    if (correct) cursor++;
    return { expected, actual: k.actual, elapsedMs: k.elapsedMs, correct };
  });
  const correctChars = cursor;
  const errors = checkedKeystrokes.filter(k => !k.correct).length;
  const metrics = calculateMetrics(correctChars, errors, input.data.durationMs);
  if (metrics.wpm > 300) return reply.code(400).send({ error: 'La velocidad reportada supera el límite permitido.' });
  const passed = metrics.accuracy >= lesson.minAccuracy && cursor === lesson.code.length;
  const attempt = await prisma.lessonAttempt.create({ data: { userId: request.user.sub, lessonId: lesson.id, wpm: metrics.wpm, accuracy: metrics.accuracy, errors: metrics.errors, durationMs: metrics.elapsedMs, passed } });
  await prisma.keystroke.createMany({ data: checkedKeystrokes.map(k => ({ ...k, userId: request.user.sub })) });
  if (passed) await prisma.user.update({ where: { id: request.user.sub }, data: { xp: { increment: Math.max(10, Math.round(metrics.wpm)) } } });
  return { ...attempt, metrics, passed };
});
app.get('/stats', { preHandler: (app as any).authenticate }, async (request: any) => {
  const days = Number((request.query as any)?.days ?? 0); const since = days ? new Date(Date.now() - days * 86400_000) : undefined;
  const where = { userId: request.user.sub, ...(since ? { createdAt: { gte: since } } : {}) };
  const [attempts, errors, user] = await Promise.all([prisma.lessonAttempt.findMany({ where, orderBy: { createdAt: 'asc' } }), prisma.keystroke.groupBy({ by: ['expected'], where: { userId: request.user.sub, correct: false, ...(since ? { createdAt: { gte: since } } : {}) }, _count: { expected: true }, orderBy: { _count: { expected: 'desc' } }, take: 100 }), prisma.user.findUnique({ where: { id: request.user.sub }, select: { id: true } })]);
  return { attempts, commonErrors: errors.map(e => ({ character: e.expected, count: e._count.expected })), summary: { averageWpm: attempts.length ? attempts.reduce((s, a) => s + a.wpm, 0) / attempts.length : 0, averageAccuracy: attempts.length ? attempts.reduce((s, a) => s + a.accuracy, 0) / attempts.length : 0, practiceMs: attempts.reduce((s, a) => s + a.durationMs, 0), completed: attempts.filter(a => a.passed).length }, userId: user?.id };
});
app.get('/recommendations', { preHandler: (app as any).authenticate }, async (request: any) => {
  const errors = await prisma.keystroke.groupBy({ by: ['expected'], where: { userId: request.user.sub, correct: false }, _count: { expected: true }, orderBy: { _count: { expected: 'desc' } }, take: 100 });
  if (!errors.length) return { recommendation: null, message: 'Completa algunas prácticas con errores para recibir un consejo personalizado.' };
  const total = errors.reduce((sum,item)=>sum+item._count.expected,0);
  const symbols = new Set(['(',')','{','}','[',']',':',';','=','+','-','/','*','"','\'']);
  const symbolCount = errors.filter(item=>symbols.has(item.expected)).reduce((sum,item)=>sum+item._count.expected,0);
  const focused = symbolCount/total >= 0.3 ? { character: errors.find(item=>symbols.has(item.expected))!.expected, title:'Practica los símbolos de código', tip:'Escribe despacio los signos de agrupación y operadores. Comprueba cada pareja de paréntesis y llaves antes de avanzar.' } : { character: errors[0]!.expected, title:`Refuerza el carácter ${errors[0]!.expected===' '?'espacio':errors[0]!.expected}`, tip:`El carácter ${errors[0]!.expected===' '?'espacio':`“${errors[0]!.expected}”`} concentra tus errores. Reduce el ritmo y verifica cada pulsación antes de continuar.` };
  const lessons = await prisma.lesson.findMany({ orderBy:{level:'asc'}, include:{attempts:{where:{userId:request.user.sub,passed:true},select:{passed:true}}} });
  const paths=[...new Set(lessons.map(item=>item.path))].sort((left,right)=>Math.min(...lessons.filter(item=>item.path===left).map(item=>item.level))-Math.min(...lessons.filter(item=>item.path===right).map(item=>item.level)));
  const firstIncomplete=paths.findIndex(path=>lessons.filter(item=>item.path===path).some(item=>!item.attempts.length));
  const unlockedThrough=firstIncomplete<0?paths.length-1:firstIncomplete;
  const available=lessons.filter(item=>paths.indexOf(item.path)<=unlockedThrough);
  const lesson = available.filter(item=>item.code.includes(focused.character)).sort((a,b)=>b.code.split(focused.character).length-a.code.split(focused.character).length)[0] ?? available[0];
  return { recommendation:{...focused,errorCount:errors.find(item=>item.expected===focused.character)?._count.expected??0,lesson:lesson?{id:lesson.id,title:lesson.title,language:lesson.language,path:lesson.path}:null} };
});
app.get('/battles', { preHandler: (app as any).authenticate }, async (request:any) => prisma.battle.findMany({where:{participants:{some:{userId:request.user.sub}}},orderBy:{createdAt:'desc'},take:25,include:{lesson:{select:{title:true,language:true,path:true}},participants:{include:{user:{select:{id:true,name:true}}}}}}));
app.get('/friends', { preHandler: (app as any).authenticate }, async (request:any) => { const userId=request.user.sub; const connections=await prisma.friendConnection.findMany({where:{OR:[{userOneId:userId},{userTwoId:userId}]},include:{userOne:{select:{id:true,name:true,rating:true}},userTwo:{select:{id:true,name:true,rating:true}}},orderBy:{createdAt:'desc'}}); return Promise.all(connections.map(async connection=>{const friend=connection.userOneId===userId?connection.userTwo:connection.userOne;return {...friend,online:(await redis.scard(`codetype:presence:${friend.id}`))>0};})); });
app.get('/friends/requests', { preHandler: (app as any).authenticate }, async (request:any) => { const userId=request.user.sub; const [incoming,outgoing]=await Promise.all([prisma.friendRequest.findMany({where:{receiverId:userId,status:'PENDING'},include:{sender:{select:{id:true,name:true,email:true}}},orderBy:{createdAt:'desc'}}),prisma.friendRequest.findMany({where:{senderId:userId,status:'PENDING'},include:{receiver:{select:{id:true,name:true,email:true}}},orderBy:{createdAt:'desc'}})]); return {incoming,outgoing}; });
app.post('/friends/requests', { preHandler: (app as any).authenticate }, async (request:any,reply) => { const parsed=friendRequestSchema.safeParse(request.body);if(!parsed.success)return reply.code(400).send({error:parsed.error.issues[0]?.message});const target=await prisma.user.findUnique({where:{email:parsed.data.email.toLowerCase()},select:{id:true}});if(!target)return reply.code(404).send({error:'No encontramos una cuenta con ese correo.'});if(target.id===request.user.sub)return reply.code(400).send({error:'No puedes enviarte una solicitud a tu propia cuenta.'});const one=request.user.sub<target.id?request.user.sub:target.id;const two=request.user.sub<target.id?target.id:request.user.sub;const connection=await prisma.friendConnection.findUnique({where:{userOneId_userTwoId:{userOneId:one,userTwoId:two}}});if(connection)return reply.code(409).send({error:'Esta cuenta ya está en tu lista de amistades.'});const reverse=await prisma.friendRequest.findUnique({where:{senderId_receiverId:{senderId:target.id,receiverId:request.user.sub}}});if(reverse?.status==='PENDING'){await prisma.$transaction([prisma.friendRequest.update({where:{id:reverse.id},data:{status:'ACCEPTED'}}),prisma.friendRequest.upsert({where:{senderId_receiverId:{senderId:request.user.sub,receiverId:target.id}},create:{senderId:request.user.sub,receiverId:target.id,status:'ACCEPTED'},update:{status:'ACCEPTED'}}),prisma.friendConnection.create({data:{userOneId:one,userTwoId:two}})]);return reply.code(201).send({accepted:true});}const previous=await prisma.friendRequest.findUnique({where:{senderId_receiverId:{senderId:request.user.sub,receiverId:target.id}}});if(previous?.status==='PENDING')return reply.code(409).send({error:'Ya enviaste una solicitud a esta cuenta.'});const invite=previous?await prisma.friendRequest.update({where:{id:previous.id},data:{status:'PENDING'}}):await prisma.friendRequest.create({data:{senderId:request.user.sub,receiverId:target.id}});return reply.code(201).send(invite); });
app.post('/friends/requests/:id/accept', { preHandler: (app as any).authenticate }, async (request:any,reply) => { const friendRequest=await prisma.friendRequest.findUnique({where:{id:(request.params as any).id}});if(!friendRequest||friendRequest.receiverId!==request.user.sub||friendRequest.status!=='PENDING')return reply.code(404).send({error:'No encontramos una solicitud pendiente para aceptar.'});const one=friendRequest.senderId<friendRequest.receiverId?friendRequest.senderId:friendRequest.receiverId;const two=friendRequest.senderId<friendRequest.receiverId?friendRequest.receiverId:friendRequest.senderId;await prisma.$transaction([prisma.friendRequest.update({where:{id:friendRequest.id},data:{status:'ACCEPTED'}}),prisma.friendConnection.upsert({where:{userOneId_userTwoId:{userOneId:one,userTwoId:two}},create:{userOneId:one,userTwoId:two},update:{}})]);return {ok:true}; });
app.post('/friends/requests/:id/decline', { preHandler: (app as any).authenticate }, async (request:any,reply) => { const friendRequest=await prisma.friendRequest.findUnique({where:{id:(request.params as any).id}});if(!friendRequest||friendRequest.receiverId!==request.user.sub||friendRequest.status!=='PENDING')return reply.code(404).send({error:'No encontramos una solicitud pendiente para rechazar.'});await prisma.friendRequest.update({where:{id:friendRequest.id},data:{status:'DECLINED'}});return {ok:true}; });
const nodeId=randomUUID();
const redisPub=new Redis(redisUrl,{maxRetriesPerRequest:null});
const redisSub=new Redis(redisUrl,{maxRetriesPerRequest:null});
const io=new SocketServer(app.server,{cors:{origin:[...clientOrigins,'null'],credentials:true}});
io.adapter(createRedisSocketAdapter(redisPub,redisSub));
const queueKey='codetype:matchmaking:queue';
const queueMetaKey='codetype:matchmaking:metadata';
const queuedUsersKey='codetype:matchmaking:users';
const socketMetaKey='codetype:sockets';
const activeUsersKey='codetype:battles:active-users';
const battleOwnersKey='codetype:battles:owners';
type BattlePlayer={userId:string;socketId:string;name:string;rating:number;cursor:number;errors:number;inputCount:number;disconnectedTimer?:NodeJS.Timeout};
type BattleState={id:string;room:string;code:string;lessonId:string;lesson:{id:string;language:string;path:string;title:string;code:string};startsAt:number;players:Map<string,BattlePlayer>;finished:boolean};
const activeBattleByUser=new Map<string,BattleState>();
const battleForSocket=new Map<string,BattleState>();
function emitBattle(battle:BattleState,event:string,payload:unknown){for(const player of battle.players.values())io.to(player.socketId).emit(event,payload);}
const luaQueueJoin=`
local queue=KEYS[1];local metadata=KEYS[2];local users=KEYS[3];local active=KEYS[4];local sockets=KEYS[5]
local socketId=ARGV[1];local userId=ARGV[2];local now=ARGV[3];local meta=ARGV[4]
if redis.call('HEXISTS',active,userId)==1 then return {'active'} end
if redis.call('HEXISTS',users,userId)==1 then return {'queued'} end
redis.call('ZADD',queue,now,socketId);redis.call('HSET',metadata,socketId,meta);redis.call('HSET',users,userId,socketId);redis.call('HSET',sockets,socketId,meta)
local candidates=redis.call('ZRANGE',queue,0,100)
for _,candidate in ipairs(candidates) do
 if candidate~=socketId then
  local otherMeta=redis.call('HGET',metadata,candidate)
  if otherMeta then
   local other=cjson.decode(otherMeta)
   if other.userId~=userId and redis.call('HEXISTS',active,other.userId)==0 then
    redis.call('ZREM',queue,candidate,socketId);redis.call('HDEL',metadata,candidate,socketId);redis.call('HDEL',users,other.userId,userId)
    return {'matched',candidate,otherMeta}
   end
  else redis.call('ZREM',queue,candidate) end
 end
end
return {'queued'}`;
const luaQueueRemove=`local meta=redis.call('HGET',KEYS[2],ARGV[1]);redis.call('ZREM',KEYS[1],ARGV[1]);redis.call('HDEL',KEYS[2],ARGV[1]);if meta then local parsed=cjson.decode(meta);if redis.call('HGET',KEYS[3],parsed.userId)==ARGV[1] then redis.call('HDEL',KEYS[3],parsed.userId) end end;return 1`;
io.use((socket,next)=>{try{const claims=app.jwt.verify(socket.handshake.auth.token) as {sub:string};socket.data.userId=claims.sub;next();}catch{next(new Error('No autorizado'));}});
function progressSnapshot(battle:BattleState){return [...battle.players.values()].map(player=>{const elapsed=Math.max(100,Date.now()-battle.startsAt)/60_000;const wpm=Math.round((player.cursor/5/elapsed)*10)/10;const attempted=player.cursor+player.errors;return {userId:player.userId,name:player.name,rating:player.rating,progress:Math.round(player.cursor/battle.code.length*100),wpm,accuracy:attempted?Math.round(player.cursor/attempted*1000)/10:100,errors:player.errors};});}
async function finishBattle(battle:BattleState,winnerId:string|null,abandonedId:string|null=null){if(battle.finished)return;const lock=await redis.set(`codetype:battles:finished:${battle.id}`,'1','EX',120,'NX');if(!lock)return;battle.finished=true;const finished=await prisma.battle.findUnique({where:{id:battle.id},select:{finishedAt:true}});if(!finished||finished.finishedAt)return;const players=[...battle.players.values()];const ratings=await prisma.user.findMany({where:{id:{in:players.map(player=>player.userId)}},select:{id:true,rating:true}});const ratingMap=new Map(ratings.map(item=>[item.id,item.rating]));const updateData=players.map(player=>{const before=ratingMap.get(player.userId)??player.rating;const opponent=players.find(other=>other.userId!==player.userId);const opponentRating=opponent?ratingMap.get(opponent.userId)??opponent.rating:before;const expected=1/(1+10**((opponentRating-before)/400));const score=winnerId===player.userId?1:winnerId===null?0.5:0;const after=Math.max(100,Math.round(before+32*(score-expected)));const elapsed=Math.max(100,Date.now()-battle.startsAt)/60_000;const accuracy=player.cursor+player.errors?Math.round(player.cursor/(player.cursor+player.errors)*1000)/10:100;return {player,before,after,accuracy,wpm:Math.round((player.cursor/5/elapsed)*10)/10};});await prisma.$transaction(async tx=>{await tx.battle.update({where:{id:battle.id},data:{winnerId,finishedAt:new Date()}});for(const item of updateData){await tx.user.update({where:{id:item.player.userId},data:{rating:item.after}});await tx.battleParticipant.upsert({where:{battleId_userId:{battleId:battle.id,userId:item.player.userId}},create:{battleId:battle.id,userId:item.player.userId,wpm:item.wpm,accuracy:item.accuracy,errors:item.player.errors,ratingBefore:item.before,ratingAfter:item.after,abandoned:item.player.userId===abandonedId},update:{wpm:item.wpm,accuracy:item.accuracy,errors:item.player.errors,ratingBefore:item.before,ratingAfter:item.after,abandoned:item.player.userId===abandonedId}});}});emitBattle(battle,'battle:finished',{winnerId,players:updateData.map(item=>({userId:item.player.userId,name:item.player.name,wpm:item.wpm,accuracy:item.accuracy,errors:item.player.errors,ratingBefore:item.before,ratingAfter:item.after,abandoned:item.player.userId===abandonedId}))});for(const player of players){activeBattleByUser.delete(player.userId);battleForSocket.delete(player.socketId);await redis.hdel(activeUsersKey,player.userId);}await Promise.all([redis.hdel(battleOwnersKey,battle.id),redis.del(`codetype:battles:sockets:${battle.id}`)]);}
async function createMatch(firstId:string,secondId:string){const [firstMeta,secondMeta]=await Promise.all([redis.hget(socketMetaKey,firstId),redis.hget(socketMetaKey,secondId)]);if(!firstMeta||!secondMeta)throw new Error('Uno de los jugadores se desconectó.');const firstSocket=JSON.parse(firstMeta) as {userId:string};const secondSocket=JSON.parse(secondMeta) as {userId:string};const userIds=[firstSocket.userId,secondSocket.userId];if(userIds[0]===userIds[1])throw new Error('No puedes competir contra tu propia cuenta.');const active=await redis.hmget(activeUsersKey,...userIds);if(active.some(Boolean))throw new Error('Uno de los jugadores ya está en una batalla.');const [users,lessons]=await Promise.all([prisma.user.findMany({where:{id:{in:userIds}},select:{id:true,name:true,rating:true}}),prisma.lesson.findMany({orderBy:{level:'asc'}})]);const lesson=lessons[Math.floor(Math.random()*lessons.length)];if(users.length!==2||!lesson)throw new Error('No se encontró el contenido necesario para la batalla.');const startsAt=Date.now()+5000;const battle=await prisma.battle.create({data:{lessonId:lesson.id,startedAt:new Date(startsAt)}});const room=`battle-${battle.id}`;const players=new Map(users.map(user=>[user.id,{userId:user.id,socketId:user.id===userIds[0]?firstId:secondId,name:user.name,rating:user.rating,cursor:0,errors:0,inputCount:0}]));const state:BattleState={id:battle.id,room,code:lesson.code,lessonId:lesson.id,lesson:{id:lesson.id,language:lesson.language,path:lesson.path,title:lesson.title,code:lesson.code},startsAt,players,finished:false};for(const player of players.values()){activeBattleByUser.set(player.userId,state);battleForSocket.set(player.socketId,state);}await Promise.all([redis.hset(activeUsersKey,userIds[0],battle.id,userIds[1],battle.id),redis.hset(battleOwnersKey,battle.id,nodeId),redis.hset(`codetype:battles:sockets:${battle.id}`,userIds[0],firstId,userIds[1],secondId),io.in(firstId).socketsJoin(room),io.in(secondId).socketsJoin(room)]);emitBattle(state,'battle:matched',{battleId:battle.id,room,startsAt,lesson:state.lesson,players:[...players.values()].map(player=>({userId:player.userId,name:player.name,rating:player.rating}))});}
async function onBattleKey(battle:BattleState,socketId:string,userId:string,rawKey:unknown){if(battle.finished||Date.now()<battle.startsAt||typeof rawKey!=='string')return;const player=battle.players.get(userId);if(!player||player.socketId!==socketId)return;const key=rawKey==='Enter'?'\n':rawKey==='Tab'?'\t':rawKey;if(key.length!==1)return;const elapsedSeconds=Math.max(.4,(Date.now()-battle.startsAt)/1000);if(player.inputCount+1>elapsedSeconds*25+2){io.to(socketId).emit('battle:input-rejected',{message:'Se detectaron pulsaciones más rápidas de lo posible.'});return;}player.inputCount++;const expected=battle.code[player.cursor]??'';if(key===expected)player.cursor++;else player.errors++;emitBattle(battle,'battle:progress',{players:progressSnapshot(battle)});if(player.cursor>=battle.code.length){const elapsed=Math.max(100,Date.now()-battle.startsAt)/60_000;const wpm=player.cursor/5/elapsed;if(wpm>300){const opponent=[...battle.players.keys()].find(id=>id!==player.userId)??null;io.to(socketId).emit('battle:input-rejected',{message:'Velocidad no plausible: se registra abandono.'});await finishBattle(battle,opponent,player.userId);}else await finishBattle(battle,player.userId);}}
async function resumeBattle(userId:string,socketId:string){const battle=activeBattleByUser.get(userId);if(!battle)return;const player=battle.players.get(userId);if(!player)return;if(player.disconnectedTimer)clearTimeout(player.disconnectedTimer);player.socketId=socketId;battleForSocket.set(socketId,battle);await redis.hset(`codetype:battles:sockets:${battle.id}`,userId,socketId);await io.in(socketId).socketsJoin(battle.room);io.to(socketId).emit('battle:resume',{battleId:battle.id,room:battle.room,startsAt:battle.startsAt,lesson:battle.lesson,players:progressSnapshot(battle)});}
function scheduleAbandon(battle:BattleState,userId:string){const player=battle.players.get(userId);if(!player)return;if(player.disconnectedTimer)clearTimeout(player.disconnectedTimer);player.disconnectedTimer=setTimeout(async()=>{if((await redis.scard(`codetype:presence:${userId}`))===0&&activeBattleByUser.get(userId)===battle)await finishBattle(battle,[...battle.players.keys()].find(id=>id!==userId)??null,userId);},10000);}
io.on('battle:key-forward',(targetNodeId:string,socketId:string,userId:string,key:unknown)=>{if(targetNodeId!==nodeId)return;const battle=battleForSocket.get(socketId);if(battle)void onBattleKey(battle,socketId,userId,key);});
io.on('battle:reconnect-forward',(targetNodeId:string,userId:string,socketId:string)=>{if(targetNodeId===nodeId)void resumeBattle(userId,socketId);});
io.on('battle:disconnect-forward',(targetNodeId:string,userId:string)=>{if(targetNodeId===nodeId){const battle=activeBattleByUser.get(userId);if(battle)scheduleAbandon(battle,userId);}});
io.on('battle:leave-forward',(targetNodeId:string,userId:string)=>{if(targetNodeId===nodeId){const battle=activeBattleByUser.get(userId);if(battle)void finishBattle(battle,[...battle.players.keys()].find(id=>id!==userId)??null,userId);}});
io.on('connection',socket=>{const userId=String(socket.data.userId);void Promise.all([redis.sadd(`codetype:presence:${userId}`,socket.id),redis.sadd('codetype:presence:users',userId),redis.hset(socketMetaKey,socket.id,JSON.stringify({userId,nodeId}))]);void redis.hget(activeUsersKey,userId).then(async (battleId:string|null)=>{if(!battleId)return;const owner=await redis.hget(battleOwnersKey,battleId);if(owner===nodeId)await resumeBattle(userId,socket.id);else if(owner)io.serverSideEmit('battle:reconnect-forward',owner,userId,socket.id);});
  socket.on('matchmaking:join',async()=>{try{const meta=JSON.stringify({userId,nodeId});const joined=await redis.eval(luaQueueJoin,5,queueKey,queueMetaKey,queuedUsersKey,activeUsersKey,socketMetaKey,socket.id,userId,String(Date.now()),meta) as string[];if(joined[0]==='active'){socket.emit('matchmaking:error',{message:'Ya estás en una batalla.'});return;}if(joined[0]!=='matched'){socket.emit('matchmaking:queued');return;}try{await createMatch(joined[1]!,socket.id);}catch(error){app.log.error(error);socket.emit('matchmaking:error',{message:'No se pudo crear la sala. Inténtalo de nuevo.'});}}catch(error){app.log.error(error);socket.emit('matchmaking:error',{message:'No se pudo entrar a la cola compartida.'});}});
  socket.on('matchmaking:cancel',async()=>{await redis.eval(luaQueueRemove,3,queueKey,queueMetaKey,queuedUsersKey,socket.id);socket.emit('matchmaking:cancelled');});
  socket.on('battle:invite',async(payload:{friendId?:unknown})=>{if(typeof payload?.friendId!=='string'||payload.friendId===userId){socket.emit('battle:invite:error',{message:'Selecciona una amistad válida.'});return;}const one=userId<payload.friendId?userId:payload.friendId;const two=userId<payload.friendId?payload.friendId:userId;const [friendship,online,active]=await Promise.all([prisma.friendConnection.findUnique({where:{userOneId_userTwoId:{userOneId:one,userTwoId:two}}}),redis.smembers(`codetype:presence:${payload.friendId}`),redis.hexists(activeUsersKey,payload.friendId)]);if(!friendship||!online.length||active){socket.emit('battle:invite:error',{message:'Esta amistad no está conectada.'});return;}const sender=await prisma.user.findUnique({where:{id:userId},select:{name:true}});const inviteId=randomBytes(12).toString('hex');const expiresAt=Date.now()+30000;await redis.set(`codetype:invites:${inviteId}`,JSON.stringify({senderId:userId,recipientId:payload.friendId,senderSocketId:socket.id,expiresAt}),'EX',30);for(const recipientSocketId of online)io.to(recipientSocketId).emit('battle:invitation',{id:inviteId,senderId:userId,senderName:sender?.name??'Amistad',expiresAt});socket.emit('battle:invite:sent',{friendId:payload.friendId});});
  socket.on('battle:invite:accept',async(payload:{inviteId?:unknown})=>{const inviteId=typeof payload?.inviteId==='string'?payload.inviteId:'';const stored=inviteId?await redis.get(`codetype:invites:${inviteId}`):null;const invite=stored?JSON.parse(stored) as {senderId:string;recipientId:string;senderSocketId:string;expiresAt:number}:null;if(!invite||invite.recipientId!==userId||invite.expiresAt<Date.now()){socket.emit('battle:invite:error',{message:'La invitación ya expiró.'});return;}await redis.del(`codetype:invites:${inviteId}`);try{await createMatch(invite.senderSocketId,socket.id);}catch(error){app.log.error(error);socket.emit('battle:invite:error',{message:'No se pudo abrir la batalla.'});}});
  socket.on('battle:invite:decline',async(payload:{inviteId?:unknown})=>{const inviteId=typeof payload?.inviteId==='string'?payload.inviteId:'';const stored=inviteId?await redis.get(`codetype:invites:${inviteId}`):null;const invite=stored?JSON.parse(stored) as {recipientId:string;senderSocketId:string}:null;if(!invite||invite.recipientId!==userId)return;await redis.del(`codetype:invites:${inviteId}`);io.to(invite.senderSocketId).emit('battle:invite:declined',{userId});});
  socket.on('battle:key',async(payload:{key?:unknown},acknowledge?: (state:unknown)=>void)=>{const battle=battleForSocket.get(socket.id);if(battle){await onBattleKey(battle,socket.id,userId,payload?.key);acknowledge?.({handled:true,players:progressSnapshot(battle)});return;}const battleId=await redis.hget(activeUsersKey,userId);const owner=battleId?await redis.hget(battleOwnersKey,battleId):null;if(owner){io.serverSideEmit('battle:key-forward',owner,socket.id,userId,payload?.key);acknowledge?.({handled:false});}else acknowledge?.({handled:false});});
  socket.on('battle:leave',async()=>{const battle=battleForSocket.get(socket.id);if(battle){await finishBattle(battle,[...battle.players.keys()].find(id=>id!==userId)??null,userId);return;}const battleId=await redis.hget(activeUsersKey,userId);const owner=battleId?await redis.hget(battleOwnersKey,battleId):null;if(owner)io.serverSideEmit('battle:leave-forward',owner,userId);});
  socket.on('battle:quick-chat',async(payload:{message?:unknown})=>{const allowed=['¡Buena suerte!','¡Buen ritmo!','¡Vamos!','¡Bien jugado!'];if(typeof payload?.message!=='string'||!allowed.includes(payload.message))return;const battle=battleForSocket.get(socket.id);const battleId=await redis.hget(activeUsersKey,userId);const name=battle?.players.get(userId)?.name??(await prisma.user.findUnique({where:{id:userId},select:{name:true}}))?.name;if(battleId&&name){const socketIds=await redis.hgetall(`codetype:battles:sockets:${battleId}`);for(const targetSocketId of Object.values(socketIds))io.to(targetSocketId).emit('battle:chat',{userId,name,message:payload.message});}});
  socket.on('disconnect',async()=>{const presenceKey=`codetype:presence:${userId}`;await redis.srem(presenceKey,socket.id);if((await redis.scard(presenceKey))===0)await redis.srem('codetype:presence:users',userId);const stored=await redis.hget(socketMetaKey,socket.id);if(stored&&JSON.parse(stored).userId===userId)await redis.hdel(socketMetaKey,socket.id);await redis.eval(luaQueueRemove,3,queueKey,queueMetaKey,queuedUsersKey,socket.id);const battleId=await redis.hget(activeUsersKey,userId);const owner=battleId?await redis.hget(battleOwnersKey,battleId):null;if(owner===nodeId){const battle=activeBattleByUser.get(userId);if(battle)scheduleAbandon(battle,userId);}else if(owner)io.serverSideEmit('battle:disconnect-forward',owner,userId);});
});
const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: '0.0.0.0' });
