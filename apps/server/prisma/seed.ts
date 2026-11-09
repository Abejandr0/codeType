import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const lessons = [
  ['py-intro-1','Python','Introducción','Mostrar un mensaje','print("Hola, mundo")','print muestra información en la terminal.'],
  ['js-intro-1','JavaScript','Introducción','Declarar una constante','const saludo = "Hola, mundo";','Usa const para valores que no se reasignan.'],
  ['py-intro-2','Python','Introducción','Usar una variable','nombre = "Ada"\nprint(f"Hola, {nombre}")','Las variables guardan valores que puedes reutilizar.'],
  ['js-intro-2','JavaScript','Introducción','Mostrar el valor de una variable','const nombre = "Ada";\nconsole.log(`Hola, ${nombre}`);','Las plantillas literales interpolan expresiones con ${}.'],
  ['py-if-1','Python','Condicionales','Evaluar una condición','edad = 18\nif edad >= 18:\n    print("Mayor de edad")','La indentación define el bloque en Python.'],
  ['js-if-1','JavaScript','Condicionales','Usar una condición','const edad = 18;\nif (edad >= 18) {\n  console.log("Mayor de edad");\n}','Las llaves delimitan el bloque condicional.'],
  ['py-if-2','Python','Condicionales','Añadir una alternativa','llueve = False\nif llueve:\n    print("Lleva paraguas")\nelse:\n    print("Buen día")','else ejecuta otro bloque cuando la condición es falsa.'],
  ['js-if-2','JavaScript','Condicionales','Comparar con else','const puntos = 72;\nif (puntos >= 60) {\n  console.log("Aprobado");\n} else {\n  console.log("Sigue practicando");\n}','Una comparación produce un valor verdadero o falso.'],
  ['py-loop-1','Python','Bucles','Recorrer un rango','for numero in range(3):\n    print(numero)','range(3) produce 0, 1 y 2.'],
  ['js-loop-1','JavaScript','Bucles','Contar con for','for (let i = 0; i < 3; i++) {\n  console.log(i);\n}','El contador se actualiza después de cada vuelta.'],
  ['py-loop-2','Python','Bucles','Recorrer una lista','colores = ["azul", "verde"]\nfor color in colores:\n    print(color)','for recorre los elementos de una colección en orden.'],
  ['js-loop-2','JavaScript','Bucles','Recorrer una colección','const colores = ["azul", "verde"];\nfor (const color of colores) {\n  console.log(color);\n}','for...of visita cada elemento de un iterable.'],
  ['py-fn-1','Python','Funciones','Definir una función','def saludar(nombre):\n    return f"Hola, {nombre}"','Una función agrupa instrucciones reutilizables.'],
  ['js-fn-1','JavaScript','Funciones','Crear una función','function saludar(nombre) {\n  return `Hola, ${nombre}`;\n}','Los parámetros reciben datos al llamar la función.'],
  ['py-fn-2','Python','Funciones','Devolver un resultado','def sumar(a, b):\n    return a + b\n\ntotal = sumar(3, 4)','return entrega el resultado de la función a quien la llamó.'],
  ['js-fn-2','JavaScript','Funciones','Crear una función flecha','const sumar = (a, b) => a + b;\n\nconsole.log(sumar(3, 4));','Una función flecha breve devuelve su expresión automáticamente.']
].map(([id, language, path, title, code, tip], i) => ({ id, language, path, title, level: i + 1, code, tip, minAccuracy: 85 }));
async function main() { for (const lesson of lessons) await prisma.lesson.upsert({ where: { id: lesson.id }, create: lesson, update: lesson }); console.log(`Seeded ${lessons.length} lessons.`); }
main().finally(() => prisma.$disconnect());
