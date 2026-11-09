import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const lessons = [
  ['py-intro-1','Python','Introducción','Mostrar un mensaje','print("Hola, mundo")','print muestra información en la terminal.'],
  ['js-intro-1','JavaScript','Introducción','Declarar una constante','const saludo = "Hola, mundo";','Usa const para valores que no se reasignan.'],
  ['py-if-1','Python','Condicionales','Evaluar una condición','edad = 18\nif edad >= 18:\n    print("Mayor de edad")','La indentación define el bloque en Python.'],
  ['js-if-1','JavaScript','Condicionales','Usar una condición','const edad = 18;\nif (edad >= 18) {\n  console.log("Mayor de edad");\n}','Las llaves delimitan el bloque condicional.'],
  ['py-loop-1','Python','Bucles','Recorrer un rango','for numero in range(3):\n    print(numero)','range(3) produce 0, 1 y 2.'],
  ['js-loop-1','JavaScript','Bucles','Contar con for','for (let i = 0; i < 3; i++) {\n  console.log(i);\n}','El contador se actualiza después de cada vuelta.'],
  ['py-fn-1','Python','Funciones','Definir una función','def saludar(nombre):\n    return f"Hola, {nombre}"','Una función agrupa instrucciones reutilizables.'],
  ['js-fn-1','JavaScript','Funciones','Crear una función','function saludar(nombre) {\n  return `Hola, ${nombre}`;\n}','Los parámetros reciben datos al llamar la función.']
].map(([id, language, path, title, code, tip], i) => ({ id, language, path, title, level: i + 1, code, tip, minAccuracy: 85 }));
async function main() { for (const lesson of lessons) await prisma.lesson.upsert({ where: { id: lesson.id }, create: lesson, update: lesson }); console.log(`Seeded ${lessons.length} lessons.`); }
main().finally(() => prisma.$disconnect());
