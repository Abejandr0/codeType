import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type LessonSeed = [id: string, language: 'Python' | 'JavaScript', path: string, title: string, code: string, explanation: string];

const catalog: LessonSeed[] = [
  ['py-intro-1','Python','Introducción','Mostrar un mensaje','print("Hola, mundo")','print recibe el texto entre comillas y lo escribe en la salida de la terminal. Las comillas delimitan una cadena; los paréntesis indican el argumento de la función.'],
  ['js-intro-1','JavaScript','Introducción','Declarar una constante','const saludo = "Hola, mundo";','const crea una variable que no se reasigna. El operador = guarda la cadena a su derecha bajo el nombre saludo; el punto y coma cierra la instrucción.'],
  ['py-intro-2','Python','Introducción','Usar una variable','nombre = "Ada"\nprint(f"Hola, {nombre}")','La primera línea asigna una cadena a nombre. La f antes de las comillas permite insertar el valor de la variable dentro del mensaje con llaves.'],
  ['js-intro-2','JavaScript','Introducción','Mostrar el valor de una variable','const nombre = "Ada";\nconsole.log(`Hola, ${nombre}`);','La primera línea guarda el nombre. La plantilla literal usa ${nombre} para insertar su valor y console.log lo muestra en la consola.'],
  ['py-intro-3','Python','Introducción','Leer un dato','nombre = input("¿Cómo te llamas? ")\nprint("Hola, " + nombre)','input muestra una pregunta y espera texto escrito por la persona. El resultado se guarda en nombre y el operador + concatena ese valor con el saludo.'],
  ['js-intro-3','JavaScript','Introducción','Convertir texto a número','const entrada = "12";\nconst cantidad = Number(entrada);\nconsole.log(cantidad + 3);','La primera línea contiene texto, no un número. Number convierte ese texto en valor numérico para que la suma dé 15 en lugar de concatenar caracteres.'],
  ['py-intro-4','Python','Introducción','Convertir una entrada','edad = int(input("Edad: "))\nprint(edad + 1)','input devuelve texto. int convierte ese texto en entero y la suma calcula la edad del siguiente año antes de imprimirla.'],
  ['js-intro-4','JavaScript','Introducción','Usar una variable mutable','let puntos = 0;\npuntos = puntos + 10;\nconsole.log(puntos);','let permite reasignar la variable. La segunda línea lee el valor actual, suma diez y guarda el nuevo total; la consola muestra 10.'],
  ['py-intro-5','Python','Introducción','Guardar varios valores','lenguajes = ["Python", "JavaScript"]\nprint(len(lenguajes))','Los corchetes crean una lista con dos cadenas. len devuelve cuántos elementos contiene la lista, por eso se imprime 2.'],
  ['js-intro-5','JavaScript','Introducción','Guardar valores en una lista','const lenguajes = ["Python", "JavaScript"];\nconsole.log(lenguajes.length);','Los corchetes crean un arreglo. Su propiedad length devuelve el número de elementos guardados, que en este ejemplo es dos.'],

  ['py-if-1','Python','Condicionales','Evaluar una condición','edad = 18\nif edad >= 18:\n    print("Mayor de edad")','La comparación >= produce un valor verdadero o falso. Si edad es al menos 18, el bloque indentado se ejecuta; si no, se omite.'],
  ['js-if-1','JavaScript','Condicionales','Usar una condición','const edad = 18;\nif (edad >= 18) {\n  console.log("Mayor de edad");\n}','if evalúa la comparación entre edad y 18. Las llaves agrupan las instrucciones que solo se ejecutan cuando la condición es verdadera.'],
  ['py-if-2','Python','Condicionales','Añadir una alternativa','llueve = False\nif llueve:\n    print("Lleva paraguas")\nelse:\n    print("Buen día")','if ejecuta su bloque cuando llueve es verdadero. else cubre el caso contrario, así que con False se imprime Buen día.'],
  ['js-if-2','JavaScript','Condicionales','Comparar con else','const puntos = 72;\nif (puntos >= 60) {\n  console.log("Aprobado");\n} else {\n  console.log("Sigue practicando");\n}','La comparación determina si se alcanza el puntaje mínimo. El bloque if se ejecuta al aprobar y el bloque else cuando la condición es falsa.'],
  ['py-if-3','Python','Condicionales','Elegir entre varias opciones','nota = 4\nif nota >= 4.5:\n    nivel = "alto"\nelif nota >= 3:\n    nivel = "medio"\nelse:\n    nivel = "bajo"','elif comprueba otra condición cuando la anterior fue falsa. Python ejecuta únicamente el primer bloque cuya condición se cumple y omite el resto.'],
  ['js-if-3','JavaScript','Condicionales','Encadenar alternativas','const nota = 4;\nlet nivel;\nif (nota >= 4.5) {\n  nivel = "alto";\n} else if (nota >= 3) {\n  nivel = "medio";\n} else {\n  nivel = "bajo";\n}','else if evalúa una condición secundaria solo si la primera no se cumple. La cadena asigna una categoría y evita evaluar las alternativas después de encontrar una coincidencia.'],
  ['py-if-4','Python','Condicionales','Comprobar pertenencia','rol = "editora"\nif rol in ["editora", "admin"]:\n    print("Puede publicar")','in comprueba si rol coincide con algún elemento de la lista. El mensaje aparece únicamente si la persona tiene uno de esos dos roles.'],
  ['js-if-4','JavaScript','Condicionales','Comprobar pertenencia en una lista','const rol = "editora";\nif (["editora", "admin"].includes(rol)) {\n  console.log("Puede publicar");\n}','includes devuelve true cuando la lista contiene el rol. if usa ese resultado para decidir si permite publicar.'],
  ['py-if-5','Python','Condicionales','Combinar condiciones','edad = 22\nmiembro = True\nif edad >= 18 and miembro:\n    print("Acceso permitido")','and exige que ambas condiciones sean verdaderas. El acceso solo se permite a una persona adulta que también sea miembro.'],
  ['js-if-5','JavaScript','Condicionales','Usar un operador lógico','const edad = 22;\nconst miembro = true;\nif (edad >= 18 && miembro) {\n  console.log("Acceso permitido");\n}','&& combina dos comprobaciones y solo devuelve true si las dos son verdaderas. El bloque representa una regla de acceso con dos requisitos.'],

  ['py-loop-1','Python','Bucles','Recorrer un rango','for numero in range(3):\n    print(numero)','range(3) genera los enteros 0, 1 y 2. for asigna cada valor a numero y ejecuta el bloque indentado una vez por elemento.'],
  ['js-loop-1','JavaScript','Bucles','Contar con for','for (let i = 0; i < 3; i++) {\n  console.log(i);\n}','El bucle inicia i en cero, comprueba que sea menor que tres y suma uno al final de cada vuelta. Imprime 0, 1 y 2.'],
  ['py-loop-2','Python','Bucles','Recorrer una lista','colores = ["azul", "verde"]\nfor color in colores:\n    print(color)','for toma cada elemento de colores en orden y lo asigna a color. El bloque imprime cada valor antes de pasar al siguiente.'],
  ['js-loop-2','JavaScript','Bucles','Recorrer una colección','const colores = ["azul", "verde"];\nfor (const color of colores) {\n  console.log(color);\n}','for...of obtiene los elementos del arreglo de uno en uno. Cada elemento se guarda temporalmente en color y se muestra en la consola.'],
  ['py-loop-3','Python','Bucles','Repetir mientras se cumpla una condición','intentos = 0\nwhile intentos < 3:\n    print(intentos)\n    intentos += 1','while repite el bloque mientras intentos sea menor que tres. El incremento evita un ciclo infinito y hace que el programa termine tras tres vueltas.'],
  ['js-loop-3','JavaScript','Bucles','Contar con while','let intentos = 0;\nwhile (intentos < 3) {\n  console.log(intentos);\n  intentos += 1;\n}','while vuelve a evaluar la condición después de cada vuelta. intentos += 1 actualiza el contador hasta que la condición deja de cumplirse.'],
  ['py-loop-4','Python','Bucles','Contar con índice','colores = ["azul", "verde"]\nfor indice, color in enumerate(colores):\n    print(indice, color)','enumerate entrega a la vez el índice y el elemento de cada posición. Esto permite mostrar tanto el orden como el contenido de la lista.'],
  ['js-loop-4','JavaScript','Bucles','Recorrer índices de un arreglo','const colores = ["azul", "verde"];\nfor (let indice = 0; indice < colores.length; indice++) {\n  console.log(indice, colores[indice]);\n}','El índice empieza en cero y avanza mientras quede una posición. colores[indice] consulta el elemento correspondiente del arreglo.'],
  ['py-loop-5','Python','Bucles','Acumular un total','precios = [4, 6, 3]\ntotal = 0\nfor precio in precios:\n    total += precio\nprint(total)','total empieza en cero y suma cada precio durante el recorrido. Al terminar el bucle, contiene la suma de todos los elementos: 13.'],
  ['js-loop-5','JavaScript','Bucles','Sumar valores en un bucle','const precios = [4, 6, 3];\nlet total = 0;\nfor (const precio of precios) {\n  total += precio;\n}\nconsole.log(total);','El acumulador total recibe cada precio en cada vuelta. Después del bucle, la consola muestra la suma de los valores del arreglo.'],

  ['py-fn-1','Python','Funciones','Definir una función','def saludar(nombre):\n    return f"Hola, {nombre}"','def declara una función llamada saludar con el parámetro nombre. return construye el saludo y entrega la cadena a quien llame la función.'],
  ['js-fn-1','JavaScript','Funciones','Crear una función','function saludar(nombre) {\n  return `Hola, ${nombre}`;\n}','function declara saludar y recibe nombre como parámetro. return devuelve una plantilla literal con ese valor insertado.'],
  ['py-fn-2','Python','Funciones','Devolver un resultado','def sumar(a, b):\n    return a + b\n\ntotal = sumar(3, 4)','sumar recibe dos valores y devuelve su suma. La llamada con 3 y 4 almacena el resultado 7 en total.'],
  ['js-fn-2','JavaScript','Funciones','Crear una función flecha','const sumar = (a, b) => a + b;\n\nconsole.log(sumar(3, 4));','La función flecha recibe a y b y devuelve su suma. La llamada entrega 3 y 4, y console.log muestra 7.'],
  ['py-fn-3','Python','Funciones','Definir un valor predeterminado','def saludar(nombre="equipo"):\n    return f"Hola, {nombre}"\n\nprint(saludar())','El parámetro nombre usa equipo cuando la llamada no proporciona un argumento. La función siempre devuelve un saludo, ya sea con ese valor o con uno recibido.'],
  ['js-fn-3','JavaScript','Funciones','Usar un parámetro predeterminado','function saludar(nombre = "equipo") {\n  return `Hola, ${nombre}`;\n}\nconsole.log(saludar());','El valor predeterminado se asigna cuando nombre no recibe argumento. La llamada sin argumentos devuelve Hola, equipo.'],
  ['py-fn-4','Python','Funciones','Validar antes de calcular','def dividir(total, personas):\n    if personas == 0:\n        return None\n    return total / personas','La función evita dividir entre cero. Si no hay personas devuelve None; en caso contrario calcula cuánto corresponde a cada una.'],
  ['js-fn-4','JavaScript','Funciones','Validar un argumento','function dividir(total, personas) {\n  if (personas === 0) return null;\n  return total / personas;\n}','La comparación estricta detecta el caso que causaría una división no válida. Si personas es cero retorna null; en otro caso retorna el cociente.'],
  ['py-fn-5','Python','Funciones','Reutilizar una función','def doble(numero):\n    return numero * 2\n\nresultado = doble(6)\nprint(resultado)','doble multiplica su argumento por dos. La llamada reutiliza esa lógica con 6, guarda 12 en resultado y lo imprime.'],
  ['js-fn-5','JavaScript','Funciones','Componer funciones','const doble = numero => numero * 2;\nconst resultado = doble(6);\nconsole.log(resultado);','La función flecha devuelve el doble del argumento. La siguiente línea guarda el resultado de llamarla con 6 y la última lo imprime.'],
];

const languageLevels = new Map<LessonSeed[1], number>();
const lessons = catalog.map(([id, language, path, title, code, tip]) => {
  const level = (languageLevels.get(language) ?? 0) + 1;
  languageLevels.set(language, level);
  return { id, language, path, title, code, tip, level, minAccuracy: 85 };
});

if (lessons.some((lesson) => !lesson.code.trim() || !lesson.tip.trim())) {
  throw new Error('Todas las lecciones deben incluir código y una explicación real.');
}

for (const language of ['Python', 'JavaScript'] as const) {
  const languageLessons = lessons.filter((lesson) => lesson.language === language);
  if (languageLessons.length !== 20) throw new Error(`El catálogo de ${language} debe tener 20 lecciones.`);
  if (languageLessons.some((lesson, index) => lesson.level !== index + 1)) {
    throw new Error(`Los niveles de ${language} deben avanzar de forma consecutiva.`);
  }
  const pathOrder = ['Introducción', 'Condicionales', 'Bucles', 'Funciones'];
  if (languageLessons.some((lesson, index) => index > 0 && pathOrder.indexOf(lesson.path) < pathOrder.indexOf(languageLessons[index - 1]!.path))) {
    throw new Error(`Las rutas de ${language} deben conservar el orden del temario.`);
  }
  for (const path of pathOrder) {
    const track = languageLessons.filter((lesson) => lesson.path === path);
    if (track.length !== 5) {
      throw new Error(`La ruta ${path} de ${language} debe tener cinco lecciones.`);
    }
  }
}

async function main(): Promise<void> {
  for (const lesson of lessons) {
    await prisma.lesson.upsert({ where: { id: lesson.id }, create: lesson, update: lesson });
  }
  console.log(`Seeded ${lessons.length} lessons.`);
}

main().finally(() => prisma.$disconnect());
