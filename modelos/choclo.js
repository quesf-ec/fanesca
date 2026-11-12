/* ============================================================
   FANESCA — modelos/choclo.js
   Las piezas del choclo: el grano, la tusa, la hoja y los pelos.

   ------------------------------------------------------------
   LA MEDIDA MANDA, Y ESTÁ AQUÍ

   Este archivo define la GEOMETRÍA del choclo: cuántas hileras
   tiene, qué tan gordo es al medio, dónde cae cada grano. El
   nivel importa esas medidas y las usa para su lógica (la regla
   del vecino ausente, la cascada, dónde se esconde el gusanito).

   Está así a propósito: la forma y las posiciones son lo mismo.
   Si en Blender esculpes un grano más gordo, cambias PASO aquí y
   todo —el modelo, la rejilla y la lógica— se entera a la vez.
   Si estuvieran en dos sitios, un día no coincidirían y los
   granos se encimarían sin que nadie supiera por qué.

   ------------------------------------------------------------
   PARTES NOMBRADAS (para que un .glb encaje)

     grano-choclo → 'cuerpo'  (la que cambia de color y de escala)
     tusa         → una malla suelta, sin partes
     hoja-choclo  → 'lamina'
     pelos-choclo → pelo0 … peloN, 'agarre'
   ============================================================ */

import { registrar } from './registro.js';
import { COMIDA, mate, brillante } from './paleta.js';
import { abollar, formaVariada, forma } from './organico.js';
import { pintar, sstep, conBorde, aterciopelado, lienzo } from './pintura.js';

/* ---------- la rejilla: la medida compartida ---------- */

export const A = 14;             /* hileras alrededor de la tusa */
export const P = 9;              /* granos a lo largo de cada hilera */
export const R = 0.46;           /* radio de la mazorca */
export const PASO = 0.208;       /* separación entre granos a lo largo */
export const LARGO = P * PASO;

/* LA SILUETA. Una mazorca no es un tubo ni un barril: tiene la panza
   abajo, a un tercio de la altura, y de ahí se va afinando hasta la
   punta. Con el perfil simétrico de antes —igual de flaca arriba que
   abajo— el choclo se leía como un cilindro con granos; con la panza
   baja y la punta fina se lee como choclo desde la sombra.

   `v` es la ALTURA normalizada de la zona de granos: 0 en el primer
   grano, 1 en el último. Se deja evaluar un poco por fuera (la tusa y
   las hojas siguen la misma curva más allá de los granos). */
const V_PANZA = 0.30;
export const perfil = (v) => (v < V_PANZA
  ? 1 - 0.14 * Math.pow((V_PANZA - v) / V_PANZA, 2)
  : 1 - 0.40 * Math.pow((v - V_PANZA) / (1 - V_PANZA), 1.9));

/* LAS FILAS NO MIDEN LO MISMO. Donde la mazorca es flaca los granos
   son más chicos —en ancho porque la vuelta es más corta, y en alto
   para que sigan siendo redondos y no óvalos parados—, así que cada
   fila ocupa una altura proporcional a su radio. Se resuelve una vez:
   la altura de una fila depende del perfil a SU altura, y eso se
   asienta en pocas vueltas. */
const FILAS = (() => {
  let v = Array.from({ length: P }, (_, p) => (p + 0.5) / P);
  let w = [];
  for (let k = 0; k < 8; k++) {
    w = v.map(x => Math.pow(perfil(x), 0.8));
    const total = w.reduce((s, x) => s + x, 0);
    let acc = 0;
    v = w.map(x => { const c = (acc + x / 2) / total; acc += x; return c; });
  }
  const total = w.reduce((s, x) => s + x, 0);
  return v.map((x, p) => ({ v: x, alto: (w[p] / total) * LARGO }));
})();
const fila = (p) => FILAS[Math.max(0, Math.min(P - 1, p))];

/* la altura normalizada del grano p (0 abajo, 1 arriba) */
export const uDe = (p) => fila(p).v;

/* Dónde va el grano (a, p): ángulo, radio y altura.

   AL TRESBOLILLO. Las hileras impares van media posición más
   arriba. En un choclo de verdad los granos no forman una cuadrícula
   sino un damero encajado —cada grano se mete en el hueco de sus dos
   vecinos— y esa es LA señal que hace que el ojo lea "maíz" y no
   "burbujas en cuadrícula". Es medio renglón de código y cambia todo.

   Ojo: esto mueve el grano en pantalla, no en la rejilla. La lógica
   sigue hablando de (a, p) y la regla del vecino ausente no se
   entera — que es justamente por qué la rejilla es lógica y no
   geométrica. */
export const TRESBOLILLO = 0.5;   /* medio paso de desfase por hilera */

export function posicionDe(a, p) {
  const th = (a / A) * Math.PI * 2;
  const f = fila(p);
  const sube = a % 2 ? f.alto * TRESBOLILLO : 0;
  /* el radio se mide a la altura REAL del grano: las hileras impares
     van medio grano más arriba, donde la mazorca ya es más flaca */
  const r = R * perfil(f.v + sube / LARGO);
  const h = (f.v - 0.5) * LARGO + sube;
  return { th, r, h };
}

/* Cuánto sitio tiene el grano (a, p): el ancho de su hueco en la
   vuelta y el alto de su fila. El grano se esculpe a esta medida. */
export function huecoDe(a, p) {
  return { ancho: (2 * Math.PI * posicionDe(a, p).r) / A, alto: fila(p).alto };
}
/* el hueco de un grano del medio, para quien pide un grano suelto */
const HUECO_MEDIO = { ancho: (2 * Math.PI * R) / A, alto: PASO * 1.06 };

/* ---------- los dos temperamentos del choclo ----------
   No es solo color: el tierno cede casi solo pero revienta si
   pasas el dedo con fuerza; el duro no revienta nunca pero sus
   granos trabados aguantan el doble. La diferencia se ve —por eso
   vive con el modelo— y se juega —por eso el nivel la lee. */

export const MADUREZ = {
  tierno: {
    id: 'tierno', resistencia: 2, escala: 1.06,
    paleta: COMIDA.choclo_tierno,
    punta: COMIDA.choclo_tierno_punta,
    tusa: COMIDA.choclo_tierno_tusa,
    cascada: 0.038,
    presenta: 'Está <b>tierno</b>: cede solito, pero con fuerza el grano revienta.',
  },
  duro: {
    id: 'duro', resistencia: 5, escala: 0.94,
    paleta: COMIDA.choclo_duro,
    punta: COMIDA.choclo_duro_punta,
    tusa: COMIDA.choclo_duro_tusa,
    cascada: 0.08,
    presenta: 'Este está <b>duro</b>: no revienta, pero los trabados pelean.',
  },
  /* EL MAÍZ SECO. Ya no es choclo: es el maíz de la tonga, el que se
     guardó colgado hasta que perdió el agua. El grano se agarra a la
     tusa con todo y la cascada corre pesadísima — desgranarlo es de
     puño, no de dedo. Es el final de la temporada por algo. */
  seco: {
    id: 'seco', resistencia: 8, escala: 0.88,
    paleta: COMIDA.choclo_seco,
    punta: COMIDA.choclo_seco_punta,
    tusa: COMIDA.choclo_seco_tusa,
    cascada: 0.14,
    presenta: 'Este es <b>maíz seco</b>: se agarra con todo y la fila corre pesada.',
  },
};

/* ---------- el grano ----------
   REDONDITO, no realista. El grano de antes era una esfera abollada,
   achatada y metida en sus vecinas hasta hacerse caras planas: de
   lejos la mazorca se veía empedrada. Este es un cojín —una esfera
   con apenas hombros de cubo, para que encaje al tresbolillo sin
   dejar huecos— que asoma media panza y casi no se encima con el de
   al lado: cada grano se lee entero, como una cuenta.

   El color va por vértice: el lomo claro y la orilla más honda y más
   naranja. Es la sombra entre grano y grano pintada en la pieza, y
   es lo que hace que se vean blanditos sin subirle el brillo.

   Ejes locales: X el ancho en la vuelta, Y lo alto, Z lo que asoma. */
function geoGrano(THREE, k) {
  const g = new THREE.SphereGeometry(1, 14, 10);
  const pos = g.attributes.position;
  const n = 2.7;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const m = Math.pow(Math.pow(Math.abs(x), n) + Math.pow(Math.abs(y), n) + Math.pow(Math.abs(z), n), 1 / n) || 1;
    pos.setXYZ(i, x / m, y / m, z / m);
  }
  abollar(g, { fuerza: 0.022, escala: 1.7, semilla: k });
  return pintar(THREE, g, (c, i, x, y, z) => {
    const t = sstep(-0.25, 0.85, z);
    const luz = 0.80 + 0.23 * t;
    c.setRGB(luz, luz * (0.90 + 0.10 * t), luz * (0.70 + 0.30 * t));
  });
}

function cuerpoDeGrano(THREE, opts, color, escala) {
  const geo = formaVariada('grano-choclo3', 6, opts.variante || 0, (k) => geoGrano(THREE, k));
  const cuerpo = new THREE.Mesh(geo, conBorde(
    brillante(THREE, color, { vertexColors: true, shininess: 24, specular: '#4a3d24' }),
    { color: '#fff3c4', fuerza: 0.16, potencia: 2.6 }));
  /* a la medida de SU hueco: los de la punta salen más chicos solos,
     porque ahí la mazorca es más flaca. Un grano pedido suelto (sin
     `p`) sale del tamaño de los del medio. */
  const hueco = opts.p != null ? huecoDe(opts.a || 0, opts.p) : HUECO_MEDIO;
  const e = escala * (opts.punta ? 0.93 : 1) * (0.97 + Math.random() * 0.06);
  cuerpo.scale.set(
    hueco.ancho * 0.53 * e,
    hueco.alto * 0.525 * e,
    0.118 * Math.sqrt(hueco.ancho / HUECO_MEDIO.ancho) * e,
  );
  cuerpo.rotation.z = (Math.random() - 0.5) * 0.06;
  cuerpo.name = 'cuerpo';
  return cuerpo;
}

registrar('grano-choclo', (THREE, opts = {}) => {
  const m = MADUREZ[opts.madurez] || MADUREZ.tierno;
  const variante = opts.variante || 0;
  const g = new THREE.Group();
  g.name = 'grano';
  /* módulo POSITIVO: la feria pide variantes negativas, y con un -1 el
     color salía undefined y el grano, blanco */
  const n = m.paleta.length;
  const color = opts.punta ? m.punta : m.paleta[((variante % n) + n) % n];
  g.add(cuerpoDeGrano(THREE, opts, color, m.escala));
  return g;
}, { variante: (o) => '-' + (MADUREZ[o.madurez] ? o.madurez : 'tierno') });

/* ---------- la papilla ----------
   El grano tierno reventado. Se queda pegado a la tusa, traba la
   hilera y hay que limpiarlo aparte: reventar no es un atajo, es
   el desvío. */

registrar('papilla-choclo', (THREE) => {
  const splat = new THREE.Mesh(
    forma('papilla-choclo2', () => abollar(new THREE.SphereGeometry(1, 12, 8), { fuerza: 0.16, escala: 2.4, semilla: 4 })),
    mate(THREE, COMIDA.choclo_papilla)
  );
  splat.scale.set(0.135, 0.04, 0.115);
  splat.name = 'papilla';
  return splat;
});

/* ---------- el grano podrido ----------
   Grano dañado, de color café oscuro. Es frágil: si lo tocas con
   fuerza se va a la olla y arruina el nivel. Requiere un toque
   delicado para removerse. Mismo molde que el grano sano: tiene que
   mezclarse en la rejilla. */

registrar('grano-podrido', (THREE, opts = {}) => {
  const g = new THREE.Group();
  g.name = 'grano-podrido';
  g.add(cuerpoDeGrano(THREE, opts, COMIDA.choclo_podrido, 1));
  /* Marcas de userData para el nivel: tipo y fragilidad */
  g.userData = {
    tipo: 'grano-podrido',
    fragil: true,
    velocidad_critica: 1200,  /* px/s — por encima, se daña */
  };
  return g;
});

/* ---------- la tusa ----------
   El corazón de la mazorca: sigue la misma silueta que los granos
   (panza abajo, punta fina y redonda) y lleva los ALVÉOLOS pintados
   —el hoyito que deja cada grano, al tresbolillo igual que ellos—,
   así que la tusa pelada no es un palo liso: se ve de dónde salió
   cada grano. El tallito va verde, de la mata. */

const TALLO_R = 0.105;
const TALLO_Y = -LARGO / 2 - 0.58;

registrar('tusa', (THREE, opts = {}) => {
  const m = MADUREZ[opts.madurez] || MADUREZ.tierno;
  const geo = forma('tusa3', () => {
    const pts = [];
    pts.push(new THREE.Vector2(0.004, TALLO_Y));
    pts.push(new THREE.Vector2(TALLO_R * 0.86, TALLO_Y + 0.015));
    pts.push(new THREE.Vector2(TALLO_R, TALLO_Y + 0.07));
    pts.push(new THREE.Vector2(TALLO_R * 1.06, -LARGO / 2 - 0.30));
    const N = 44, v0 = -0.10, v1 = 1.0;
    for (let i = 0; i <= N; i++) {
      const v = v0 + (v1 - v0) * (i / N);
      /* por dentro del grano, y más por dentro en la punta: que arriba
         asome grano y no un casquete de tusa */
      let r = R * perfil(v) * (0.90 - 0.14 * sstep(0.8, 1, v));
      /* el hombro: del tallo al cuerpo en una curva, no en un escalón */
      if (v < 0) r = TALLO_R * 1.06 + (r - TALLO_R * 1.06) * Math.sin(sstep(v0, 0, v) * Math.PI / 2);
      pts.push(new THREE.Vector2(r, (v - 0.5) * LARGO));
    }
    /* la punta: un domo, no un cono */
    const r1 = R * perfil(v1) * 0.76, y1 = (v1 - 0.5) * LARGO;
    for (let j = 1; j <= 7; j++) {
      const a = (j / 7) * Math.PI / 2;
      pts.push(new THREE.Vector2(Math.max(0.004, r1 * Math.cos(a)), y1 + 0.11 * Math.sin(a)));
    }
    const g = new THREE.LatheGeometry(pts, 56);
    return pintar(THREE, g, (c, i, x, y, z) => {
      /* el tallo: verde abajo, fundiéndose en el hombro */
      const verde = 1 - sstep(-LARGO / 2 - 0.06, -LARGO / 2 + 0.07, y);
      /* el alvéolo más cercano, con el mismo desfase que los granos */
      const af = (Math.atan2(x, z) / (Math.PI * 2)) * A;
      const a0 = Math.round(af);
      const par = ((a0 % A) + A) % A;
      let mejor = 9;
      for (let p = 0; p < P; p++) {
        const f = FILAS[p];
        const h = (f.v - 0.5) * LARGO + (par % 2 ? f.alto * TRESBOLILLO : 0);
        const dy = (y - h) / (f.alto / 2), da = (af - a0) * 2;
        mejor = Math.min(mejor, da * da + dy * dy);
      }
      const hoyo = Math.exp(-mejor * 1.5) * (1 - verde);
      c.setRGB(1 - 0.20 * hoyo, 1 - 0.26 * hoyo, 1 - 0.38 * hoyo);
      c.r *= 1 - 0.30 * verde; c.g *= 1 - 0.06 * verde; c.b *= 1 - 0.50 * verde;
    });
  });
  const t = new THREE.Mesh(geo, mate(THREE, m.tusa, { vertexColors: true }));
  t.name = 'tusa';
  return t;
}, { variante: (o) => '-' + (MADUREZ[o.madurez] ? o.madurez : 'tierno') });

/* ---------- las hojas ----------
   Siguen la panza del choclo, se recogen abajo hacia el tallo y
   arriba se cierran en un cuello del que asoman los pelos; de ahí
   cada hoja termina en su propia punta, un poco abierta, como un
   tulipán. Van POR FUERA del grano (que asoma hasta R·perfil +
   ~0.15): si no, los granos las atraviesan y el choclo nunca se ve
   cerrado. */

export const HOJAS = 10;
/* Sobresale del choclo lo justo para taparlo con margen y hacer el
   cuello. Más larga y, al abrirse, la punta se acuesta encima de
   los cuencos. */
export const LARGO_HOJA = LARGO + 1.12;
export const BASE_HOJA = -LARGO / 2 - 0.42;   /* de dónde nace la hoja */

/* Dónde deja la hoja de tapar choclo y empieza a cerrarse. Se
   calcula, no se elige a ojo: es la altura del último grano (los de
   las hileras impares suben medio grano más) traducida a la
   coordenada de la hoja. El cierre NO puede empezar antes, o la hoja
   se mete por dentro de los granos de arriba y los deja asomando con
   el choclo todavía cerrado. */
const Y_CIERRE = LARGO / 2 + 0.08;
export const U_PUNTA = (Y_CIERRE - BASE_HOJA) / LARGO_HOJA;
const HOLGURA = 0.19;      /* aire entre el eje del grano y la hoja */
const CUELLO = 0.11;      /* radio del cuello, por donde salen los pelos */
const T_CUELLO = 0.5;     /* en qué punto del tramo final está el cuello */

/* de dónde nacen los pelos: justo bajo el cuello, sobre la punta de la tusa */
export const Y_PELOS = LARGO / 2 + 0.14;

export function radioHoja(u) {
  const y = BASE_HOJA + u * LARGO_HOJA;
  if (u >= U_PUNTA) {
    const t = (u - U_PUNTA) / (1 - U_PUNTA);
    const r0 = R * perfil((Y_CIERRE + LARGO / 2) / LARGO) + HOLGURA;
    /* se cierra en hombro redondo hasta el cuello… */
    const cierra = CUELLO + (r0 - CUELLO) * Math.pow(Math.cos(Math.min(1, t / T_CUELLO) * Math.PI / 2), 1.2);
    /* …y de ahí las puntas se abren apenas */
    const abre = 0.10 * Math.pow(Math.max(0, (t - T_CUELLO) / (1 - T_CUELLO)), 1.5);
    return cierra + abre;
  }
  const v = (y + LARGO / 2) / LARGO;
  /* la culata: por debajo del primer grano las hojas se recogen hacia
     el tallo en redondo. Sin esto el choclo se apoya en un faldón
     —la silueta de un jarrón, no la de una mazorca. */
  if (v < 0) {
    const t = Math.min(1, (-v * LARGO) / 0.42);
    return (R * perfil(0) + HOLGURA) * (1 - 0.70 * Math.pow(t, 2.2));
  }
  return R * perfil(v) + HOLGURA;
}

/* Cuántos NUDOS tiene la hoja. Una hoja de choclo no se abre como
   una tapa con bisagra: se va curvando, y la punta siempre va más
   abierta que la base. Con tres eslabones encadenados, cada uno
   girando un poco menos que el anterior, la hoja se enrolla hacia
   afuera y el gesto pasa de "se abrió una compuerta" a "la estoy
   pelando". */
export const NUDOS = 3;

const SEG_A = 12;   /* a lo ancho de la hoja */
const SEG_H = 8;    /* a lo largo, por banda */

/* LA HOJA SE ESCULPE ENTERA Y LUEGO SE CORTA en sus tres bandas. Antes
   cada banda calculaba sus normales por su cuenta y en cada nudo
   quedaba un pliegue de luz —la hoja se veía de tres placas aun
   cerrada—; con las normales de la hoja entera, el corte no se ve. */
function geosDeHoja(THREE, arc) {
  const filas = NUDOS * SEG_H + 1, cols = SEG_A + 1;
  const P3 = new Float32Array(filas * cols * 3);
  const N3 = new Float32Array(filas * cols * 3);
  const UV = new Float32Array(filas * cols * 2);
  for (let j = 0; j < filas; j++) {
    const u = j / (filas - 1);
    const tp = u < U_PUNTA ? 0 : (u - U_PUNTA) / (1 - U_PUNTA);
    /* EL ANCHO. Mientras tapa choclo la hoja apenas se afina: las
       hojas tienen que solaparse (con el traslape de 1.46, el piso es
       1/1.46 ≈ 0.69 del arco) o se abren rendijas y se ven los granos
       con el choclo cerrado. Pasado el cuello ya no tapa nada y
       termina en punta, que es lo que la hace hoja y no placa. */
    const sc = Math.min(1, tp / T_CUELLO), sp = Math.max(0, (tp - T_CUELLO) / (1 - T_CUELLO));
    const ancho = Math.max(0.02, (1 - 0.14 * sstep(0.35, U_PUNTA, u)) * (1 - 0.19 * sc * sc) * (1 - Math.pow(sp, 2.2)));
    for (let i = 0; i < cols; i++) {
      const lado = -1 + (2 * i) / SEG_A;
      /* el lomo: la nervadura central levantada separa una hoja de la
         siguiente; sin ella se funden en una vaina lisa */
      const nervio = 1 + Math.cos(Math.abs(lado) * Math.PI / 2) * 0.05;
      /* EN TEJA: cada hoja levanta su borde derecho un 8 % y se monta
         sobre el izquierdo de la siguiente. Tiene que ganarle al lomo
         del 5 %, o el borde de la vecina atraviesa la hoja. */
      const teja = 1 + 0.08 * (lado + 1) / 2;
      const r = radioHoja(u) * nervio * teja;
      const a2 = lado * (arc / 2) * ancho;
      const k = (j * cols + i) * 3;
      P3[k] = Math.sin(a2) * r; P3[k + 1] = u * LARGO_HOJA; P3[k + 2] = Math.cos(a2) * r;
      UV[(j * cols + i) * 2] = i / SEG_A; UV[(j * cols + i) * 2 + 1] = u;
    }
  }
  /* normales de la rejilla entera, por diferencias con los vecinos */
  const a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
  const leer = (v, j, i) => { const k = (Math.max(0, Math.min(filas - 1, j)) * cols + Math.max(0, Math.min(cols - 1, i))) * 3; return v.set(P3[k], P3[k + 1], P3[k + 2]); };
  for (let j = 0; j < filas; j++) for (let i = 0; i < cols; i++) {
    leer(a, j, i + 1).sub(leer(n, j, i - 1));
    leer(b, j + 1, i).sub(leer(n, j - 1, i));
    n.crossVectors(a, b).normalize();
    if (!(n.lengthSq() > 0.5)) n.set(0, 0, 1);
    const k = (j * cols + i) * 3;
    N3[k] = n.x; N3[k + 1] = n.y; N3[k + 2] = n.z;
  }
  const geos = [];
  for (let nd = 0; nd < NUDOS; nd++) {
    const j0 = nd * SEG_H, y0 = (nd / NUDOS) * LARGO_HOJA;
    const cnt = (SEG_H + 1) * cols;
    const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), uv = new Float32Array(cnt * 2);
    for (let q = 0; q < cnt; q++) {
      const src = j0 * cols + q;
      pos[q * 3] = P3[src * 3]; pos[q * 3 + 1] = P3[src * 3 + 1] - y0; pos[q * 3 + 2] = P3[src * 3 + 2];
      nor[q * 3] = N3[src * 3]; nor[q * 3 + 1] = N3[src * 3 + 1]; nor[q * 3 + 2] = N3[src * 3 + 2];
      uv[q * 2] = UV[src * 2]; uv[q * 2 + 1] = UV[src * 2 + 1];
    }
    const idx = [];
    for (let j = 0; j < SEG_H; j++) for (let i = 0; i < SEG_A; i++) {
      const p0 = j * cols + i, p1 = p0 + 1, p2 = p0 + cols, p3 = p2 + 1;
      idx.push(p0, p1, p2, p1, p3, p2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    geos.push(g);
  }
  return geos;
}

/* Todas las hojas de un choclo tienen la misma geometría —solo
   cambian de color y de ángulo—: tres bandas por cada cantidad de
   hojas, calculadas una vez. */
const hojasHechas = new Map();
function bandaDeHoja(THREE, n, total, arc) {
  return forma('hoja-choclo3:' + total + ':' + n, () => {
    if (!hojasHechas.has(total)) hojasHechas.set(total, geosDeHoja(THREE, arc));
    return hojasHechas.get(total)[n];
  });
}

/* LA PIEL DE LA HOJA: las venas a lo largo, la base más pálida —la
   parte que no vio el sol— y la orilla un punto más honda. Es más
   fina que la malla, así que va en un lienzo; una sola textura en
   gris claro que el color de cada hoja tiñe. */
const pielDeHoja = (THREE) => lienzo(THREE, 'hoja-choclo', [128, 256], (ctx, W, H) => {
  /* y = H es la base de la hoja, y = 0 la punta */
  const g = ctx.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, '#fffbd0'); g.addColorStop(0.18, '#f3f4d2'); g.addColorStop(0.45, '#e2e3d8');
  g.addColorStop(0.82, '#e6e8d2'); g.addColorStop(1, '#fbf5b6');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const [x0, x1] of [[0, W * 0.2], [W, W * 0.8]]) {
    const o = ctx.createLinearGradient(x0, 0, x1, 0);
    o.addColorStop(0, 'rgba(40,70,20,0.26)'); o.addColorStop(1, 'rgba(40,70,20,0)');
    ctx.fillStyle = o; ctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
  }
  const VENAS = 11;
  for (let k = 1; k < VENAS; k++) {
    const x = (k / VENAS) * W, centro = k * 2 === VENAS - 1 || k * 2 === VENAS + 1;
    ctx.fillStyle = 'rgba(45,75,25,0.16)'; ctx.fillRect(x + 1.6, 0, 1.2, H);
    ctx.fillStyle = centro ? 'rgba(255,255,236,0.42)' : 'rgba(255,255,236,0.30)';
    ctx.fillRect(x - 1.2, 0, centro ? 3.4 : 2.4, H);
  }
});

registrar('hoja-choclo', (THREE, opts = {}) => {
  const i = opts.indice || 0;
  /* con traslape holgado: las hojas se tapan entre sí como en el
     choclo real. El arco sale de CUÁNTAS HOJAS TIENE ESTE CHOCLO, no
     de la constante: los niveles reparten cinco, seis, ocho o diez, y
     con el arco de diez un choclo de cinco enseñaba columnas de
     granos entre hoja y hoja. */
  const total = opts.total || HOJAS;
  const arc = (Math.PI * 2 / total) * 1.46;

  /* VERDES TODAS, y alternadas. Antes la segunda mitad de la vuelta
     iba casi blanca —"las de adentro"— y como todas van en un mismo
     círculo el choclo salía mitad verde y mitad hueso, como dos
     choclos pegados. Ahora una de cada dos es la hoja tierna, de un
     verde limón más claro, y el manojo se lee de capas. Con cinco o
     seis hojas son todas de afuera. */
  const tierna = total >= 8 && i % 2 === 1;
  const tonos = tierna ? COMIDA.hoja_choclo_tierna : COMIDA.hoja_choclo;
  const color = tonos[(i >> (tierna ? 1 : 0)) % tonos.length];
  /* terciopelo apenas: la hoja de choclo es mate y con pelusa */
  const material = aterciopelado(THREE, color, {
    map: pielDeHoja(THREE), side: THREE.DoubleSide,
    borde: { color: COMIDA.hoja_choclo_borde, fuerza: 0.16, potencia: 2.6 },
  });

  /* la cadena: nudo0 en la base, y cada nudo cuelga del anterior */
  const raizHoja = new THREE.Group();
  raizHoja.name = 'lamina';
  let padre = raizHoja;
  for (let n = 0; n < NUDOS; n++) {
    const nudo = new THREE.Group();
    nudo.name = 'nudo' + n;
    /* el primero nace en la base; los demás, donde acabó el anterior */
    if (n > 0) nudo.position.y = LARGO_HOJA / NUDOS;
    const banda = new THREE.Mesh(bandaDeHoja(THREE, n, total, arc), material);
    banda.name = 'banda' + n;
    nudo.add(banda);
    padre.add(nudo);
    padre = nudo;
  }
  return raizHoja;
});

/* ---------- los pelos ----------
   Un mechón, no un manojo de palillos. Cada hebra es un hilo gordito
   que sale por el cuello de las hojas, se levanta y se vence hacia
   afuera por su propio peso; las de fuera son más largas y caen más,
   y todas rematan en un rizo. Rubias al nacer y tostadas en la punta,
   como el pelo de choclo de verdad cuando ya está de cosecha. */

const PELOS = 26;
const FORMAS_PELO = 6;

function geoPelo(THREE, k) {
  const f = k / (FORMAS_PELO - 1);          /* 0 la del centro, 1 la de fuera */
  const largo = 0.78 + 0.34 * f;
  const M = 14, pts = [];
  let y = 0, z = 0;
  for (let s = 0; s <= M; s++) {
    const t = s / M;
    pts.push(new THREE.Vector3(0.03 * t * Math.sin(t * 6 + k * 1.7), y, z));
    /* el ángulo con la vertical: sale casi recta y se va venciendo;
       al final, el rizo */
    /* la primera mitad va por dentro del cuello: derecha */
    const d = Math.max(0, (t - 0.42) / 0.58);
    const phi = 0.02 + (1.3 + 1.5 * f) * Math.pow(d, 1.2) + Math.max(0, t - 0.8) * 3;
    y += Math.cos(phi) * largo / M; z += Math.sin(phi) * largo / M;
  }
  const curva = new THREE.CatmullRomCurve3(pts);
  const SEG = 22, RAD = 5;
  const g = new THREE.TubeGeometry(curva, SEG, 1, RAD, false);
  /* el tubo sale de radio 1: aquí se afina de la raíz a la punta */
  const pos = g.attributes.position, c = new THREE.Vector3();
  const col = new Float32Array(pos.count * 3);
  for (let j = 0; j <= SEG; j++) {
    const t = j / SEG;
    curva.getPointAt(t, c);
    const r = 0.026 * (1 - 0.6 * t);
    const tono = Math.pow(t, 1.25);
    for (let i = 0; i <= RAD; i++) {
      const q = j * (RAD + 1) + i;
      pos.setXYZ(q, c.x + (pos.getX(q) - c.x) * r, c.y + (pos.getY(q) - c.y) * r, c.z + (pos.getZ(q) - c.z) * r);
      col[q * 3] = 1.12 - 0.32 * tono; col[q * 3 + 1] = 1.10 - 0.46 * tono; col[q * 3 + 2] = 0.98 - 0.52 * tono;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

registrar('pelos-choclo', (THREE) => {
  const g = new THREE.Group();
  g.name = 'pelos';
  const paleta = COMIDA.pelo_choclo;

  for (let i = 0; i < PELOS; i++) {
    const k = i % FORMAS_PELO;
    const geo = formaVariada('pelo-choclo5', FORMAS_PELO, k, (q) => geoPelo(THREE, q));
    /* cada hebra cuelga de su propio nodo girado: así la curva (que va
       hacia +Z) se vence siempre hacia afuera. El ángulo áureo reparte
       sin alinearse nunca: enredado, no peinado. */
    const nodo = new THREE.Group();
    nodo.rotation.y = i * 2.39996;
    nodo.position.y = Y_PELOS + (Math.random() - 0.5) * 0.04;

    const h = new THREE.Mesh(geo, mate(THREE, paleta[i % paleta.length], { vertexColors: true }));
    h.position.z = 0.006 + 0.022 * (k / (FORMAS_PELO - 1));
    h.rotation.x = (Math.random() - 0.5) * 0.16;
    h.rotation.z = (Math.random() - 0.5) * 0.2;
    h.name = 'pelo' + i;
    nodo.add(h);
    g.add(nodo);
  }

  /* ---- el agarre ----
     Las hebras dejan más aire que pelo: el dedo cae entre dos y no
     pasa nada. Esta campana invisible le da al penacho el blanco que
     su silueta promete. No se pinta (opacidad cero) pero SÍ la ve el
     rayo. Sin `ignorar`, a propósito: es el objetivo, no decoración. */
  const agarre = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  agarre.position.y = LARGO / 2 + 0.72;
  agarre.scale.set(1, 0.85, 1);
  agarre.name = 'agarre';
  g.add(agarre);

  return g;
});
