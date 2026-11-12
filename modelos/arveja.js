/* ============================================================
   FANESCA — modelos/arveja.js
   La vaina de arveja y su grano.

   La arveja se parece a la haba de lejos y no se parece en nada
   en la mano. La vaina es más flaca, más tiesa y más brillante, y
   sobre todo tiene el <b>hilo</b>: esa fibra que corre por la
   costura y que hay que jalar desde el rabito antes de que la
   vaina se deje abrir. Por eso el hilo es una pieza propia y no
   una raya pintada — el juego lo mueve.

   Los granos van pegados a la pared de arriba, en fila y tocándose,
   que es como vienen: por eso al correr el pulgar salen en cadena
   y no de a uno.

   PARTES NOMBRADAS (para que un .glb encaje)
     vaina-arveja → 'bisagra' (el grupo que rota al abrir)
                    'tapa', 'abajo', 'hilo', 'rabo'
                    bulto0 … bultoN (los granos que se marcan afuera)
     arveja       → 'cuerpo', 'cicatriz'
   ============================================================ */

import { registrar } from './registro.js';
import { COMIDA, mate } from './paleta.js';
import { abollar, curvar, entubar, formaVariada, forma } from './organico.js';
import { pintar, aterciopelado, mediaCascara, bultosEnFila } from './pintura.js';

const acotar = (v) => Math.max(-1, Math.min(1, v));

export const POR_VAINA = 5;
export const PASO_ARVEJA = 0.148;

/* ---------- LA FORMA DE LA VAINA, EN UN SOLO SITIO ----------

   UNA VAINA ES UN TUBO, NO UN LIMÓN. La media cáscara era media
   esfera escalada a lo largo, y una esfera se afila desde el mismo
   centro: la sección menguaba en todo el recorrido, las puntas
   acababan en pico y lo de dentro tenía que menguar y trepar con
   ella. En la pantalla se leía como un limón verde, y un jugador
   volvió a decirlo dos versiones seguidas: «las arvejas siguen
   fallando en su colocación versus en sus vainas».

   Ahora la sección se mantiene casi entera de punta a punta y sólo se
   afila en el último tramo (`entubar` con PERFIL). Con eso los cinco
   granos van del mismo tamaño y en fila —como van de verdad— en vez
   de encogerse y trepar por una curva.

   Y EL FORRO LLEVA LA MISMA FORMA Y EL MISMO ARCO. Es la superficie
   que se VE al abrir la vaina, y estaba sin arquear: los granos
   seguían el arco de la cáscara de fuera y el lecho de dentro iba
   recto, así que se salían del lecho hacia las puntas. Medido: 0.0067
   de desvío en z contra un lecho de 0.07 de medio ancho, y en el
   centro el grano atravesaba el forro por abajo.

   `perfilVaina(x)` contesta las tres cosas que hay que saber para
   meter algo dentro, y las contesta del LECHO —el forro— no de la
   cáscara: por dónde pasa el eje (el arco), cuánto mide de medio
   ancho y qué tan hondo es a esa altura. */
/* LAS PROPORCIONES SON LAS DE UNA VAINA DE VERDAD: unos 8 cm de
   largo por 1,2 de ancho, o sea SIETE VECES más larga que gruesa. La
   de aquí era cuatro veces —un tabique verde— y sobre un cuerpo tan
   grueso los cinco granos salían como pelotas en una bandeja. Un
   jugador lo dijo corto: «la arveja no debe de ser tan grande».

   Se adelgazó la vaina y se encogieron los granos CON ella, que es lo
   que mantiene la proporción de verdad: el grano mide dos tercios del
   ancho de su vaina. El gesto no se entera — los granos se recogen
   por cercanía al dedo (RADIO_DEDO, en el nivel), no por su tamaño en
   pantalla. */
export const VAINA = {
  largo: 0.47,    /* medio largo, en x */
  alto: 0.081,    /* hondura del vientre, en y */
  ancho: 0.088,   /* medio ancho, en z */
  arco: 0.1,      /* cuánto se arquea (ver curvar, en organico.js) */
  forro: 0.95,    /* el lecho va por dentro de la cáscara */
};

/* LA SECCIÓN A LO LARGO. Casi entera hasta bien pasada la mitad y
   luego un afilado corto: u⁵ no se despierta hasta el 60% y la raíz
   redondea la punta para que no acabe en pico.

   El exponente se probó mirando: con u⁸ la vaina salía recta como un
   sofá —los costados sin una curva y las puntas de golpe— y con u²
   volvía a ser el limón de antes. Cinco deja el lomo casi paralelo
   donde van los granos y una punta que se cierra en el último
   quinto, que es lo que hace una vaina. */
export const PERFIL = (u) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 5)), 0.32);

/* el bulto de un grano, para saber si cabe donde lo van a poner. Dos
   tercios del ancho de la vaina, que es lo que mide una arveja
   dentro de la suya. */
export const ARVEJA_R = { x: 0.063, y: 0.058, z: 0.060 };

/* EL HILO, EN EL FILO DE LA COSTURA.

   Medía 1.02 sobre una vaina de 1.00 y asomaba por las dos puntas
   como una hoja suelta; y sobre la vaina vieja —que se afilaba desde
   el centro— se despegaba del filo en todo el recorrido. Con la vaina
   hecha tubo el filo se queda quieto en z casi hasta la punta (lo que
   el afilado quita, el arco lo devuelve), así que un cilindro recto
   lo sigue sin despegarse. El largo se queda en el 80% para que
   termine ANTES que la vaina.

   El nivel lo lee para animar el tirón: el largo tiene que salir de
   un solo sitio o la cuenta del despegue se desincroniza del modelo. */
export const HILO = {
  largo: VAINA.largo * 1.6,
  grosor: 0.012,
  y: 0.004,
  z: VAINA.ancho * 0.985,
};

/* la cáscara por fuera: lo que hay que saber para posar algo ENCIMA
   (los bultos que marcan los granos) */
export function perfilCascara(x) {
  const u = Math.max(-1, Math.min(1, x / VAINA.largo));
  const r = PERFIL(u);
  return { z: u * u * VAINA.arco * VAINA.ancho, ancho: r * VAINA.ancho, alto: r * VAINA.alto };
}

/* el lecho por dentro: lo que hay que saber para meter algo */
export function perfilVaina(x) {
  const c = perfilCascara(x);
  return { z: c.z, ancho: c.ancho * VAINA.forro, hondo: c.alto * VAINA.forro };
}

/* media cáscara. Más honda y menos ancha que la de haba: la vaina de
   arveja es casi un tubo partido, y esa sección redonda es lo que
   hace que los granos rueden hacia afuera solos cuando se abre. */
function mediaVaina(THREE, arriba) {
  /* LA MISMA RECETA QUE LA VAINA DE HABA: anillos densos a lo largo
     (mediaCascara), los granos marcados DESDE DENTRO de la cáscara
     (bultosEnFila) y la piel pintada por vértice. Antes los bultos
     eran cinco bolas pegadas encima de un casco liso de un solo
     verde, y la vaina se leía como un bloque con remaches. */
  const clave = 'media-vaina-arveja6:' + (arriba ? 'a' : 'b');
  const hacer = (conBultos) => () => {
    const g = mediaCascara(THREE, { arriba, segLargo: 36, segSeccion: 12 });
    abollar(g, { fuerza: 0.022, escala: 3.8, semilla: arriba ? 11 : 12 });
    entubar(g, { eje: 'x', perfil: PERFIL });
    if (conBultos) {
      bultosEnFila(g, {
        centros: [-2, -1, 0, 1, 2].map(i => i * PASO_ARVEJA / VAINA.largo),
        sigma: 0.072, alto: 0.4,
        /* gordos en el lomo y nada en el filo: la costura sigue recta */
        peso: (x, y, z) => Math.pow(Math.max(0, Math.min(1, y)), 1.2) * Math.exp(-z * z / 0.5),
      });
    }
    /* la vaina de arveja se arquea: nunca está recta sobre la mesa */
    return curvar(g, { eje: 'x', hacia: 'z', k: VAINA.arco });
  };
  const base = forma(clave, hacer(arriba));
  /* el forro va SIN bultos: escalado al 95 % de una cáscara con
     bultos asomaba en astillas claras por los valles entre grano y
     grano. Liso, queda siempre por dentro. */
  const baseForro = arriba ? forma(clave + ':lisa', hacer(false)) : base;
  /* la piel: el lomo y las panzas de los granos más claros, el canto y
     los valles entre grano y grano un pelo más hondos */
  const geoC = forma(clave + ':casc', () => pintar(THREE, base.clone(), (c, i, x, y, z) => {
    const yc = Math.abs(acotar(y));
    /* cada grano con su lucecita y el valle entre dos un pelo más
       hondo: así se CUENTAN desde fuera, que es media gracia */
    let g = 0;
    if (arriba) for (let j = -2; j <= 2; j++) { const d = x - j * PASO_ARVEJA / VAINA.largo; g += Math.exp(-d * d / (2 * 0.072 * 0.072)); }
    const lomo = arriba ? Math.pow(Math.max(0, Math.min(1, acotar(y))), 1.2) : 0;
    const k = 0.84 + 0.14 * Math.min(1.25, yc) + (g - 0.5) * 0.3 * lomo + 0.03 * Math.sin(19 * x + 5 * z);
    c.setRGB(k * 1.03, k, k * 0.92);
  }));
  const m = new THREE.Mesh(geoC, aterciopelado(THREE, COMIDA.vaina_arveja,
    { vertexColors: true, borde: { color: COMIDA.vaina_arveja_borde, fuerza: 0.24, potencia: 2.2 } }));
  m.scale.set(VAINA.largo, VAINA.alto, VAINA.ancho);
  /* EL FORRO ES LA MISMA MALLA, UN PELO MÁS CHICA: no hay dos formas
     que puedan dejar de coincidir. Pálido al fondo y más verde hacia
     el filo, como el de la haba. */
  const dentro = new THREE.Color(COMIDA.vaina_arveja_dentro), filo = new THREE.Color(COMIDA.vaina_arveja_filo);
  const geoF = forma(clave + ':forro', () => pintar(THREE, baseForro.clone(), (c, i, x, y) => {
    c.copy(dentro).lerp(filo, Math.pow(Math.max(0, 1 - Math.abs(acotar(y))), 2.5));
  }));
  const forro = new THREE.Mesh(geoF, mate(THREE, '#ffffff', { vertexColors: true, side: THREE.DoubleSide }));
  forro.scale.setScalar(VAINA.forro);
  forro.name = 'forro';
  forro.userData.ignorar = true;
  m.add(forro);
  return m;
}

registrar('vaina-arveja', (THREE) => {
  const v = new THREE.Group();
  v.name = 'vaina';

  const abajo = mediaVaina(THREE, false);
  abajo.name = 'abajo';
  v.add(abajo);

  const bisagra = new THREE.Group();
  bisagra.name = 'bisagra';
  bisagra.position.z = -0.085;
  const tapa = mediaVaina(THREE, true);
  tapa.name = 'tapa';
  tapa.position.z = 0.085;

  /* LOS BULTOS, Y QUE SE CUENTEN. La vaina de arveja marca sus granos
     mucho más que la de haba: se cuentan desde afuera antes de
     abrirla, y ésa es media gracia del mesón.

     Estaban HUNDIDOS DENTRO de la tapa. Iban a una altura fija
     (y = 0.055) cuando el lomo de la cáscara está a 0.128, así que
     cuatro de los cinco no asomaban y el quinto se leía como una
     verruga suelta. Ahora se posan SOBRE el lomo —su centro en la
     superficie, media bola fuera— y siguen el arco y el afilado como
     los granos que están marcando. */
  /* Ahora los bultos son parte de la cáscara (ver mediaVaina). Quedan
     como marcas vacías con su nombre de siempre, porque el nivel las
     recorre al abrir. */
  for (let i = 0; i < POR_VAINA; i++) {
    const b = new THREE.Object3D();
    const x = (i - (POR_VAINA - 1) / 2) * PASO_ARVEJA;
    const c = perfilCascara(x);
    b.position.set(x, c.alto * 0.86, c.z + 0.085);
    b.name = 'bulto' + i;
    bisagra.add(b);
  }
  bisagra.add(tapa);
  v.add(bisagra);

  /* EL HILO. No es adorno: es el primer gesto del nivel. Va tenso por
     toda la costura y sale del rabito, y el juego lo estira y lo tira
     a la composta cuando el jugador lo jala. Por eso es una malla
     larga y fina de verdad, no una línea pintada sobre la vaina: hay
     que poder verlo despegarse. */
  /* EL HILO VA POR LA COSTURA, y la costura se arquea. Recto y de
     largo 1.02 sobre una vaina de largo 1.00 se despegaba del filo
     hacia las puntas y asomaba por los dos extremos como una hoja
     suelta. Se dobla siguiendo el mismo arco y se queda un pelo
     dentro de la vaina, que es donde va un hilo. */
  /* una cápsula y no un cilindro: las puntas redondas, que el hilo
     cortado a escuadra era lo más duro de la vaina. Va a lo largo de
     su Y local (el nivel le escribe scale.y al jalarlo). */
  const hilo = new THREE.Mesh(
    forma('hilo-arveja2', () => new THREE.CapsuleGeometry(HILO.grosor * 0.8, HILO.largo - HILO.grosor * 1.6, 3, 8)),
    mate(THREE, COMIDA.hilo_arveja_suave)
  );
  hilo.rotation.z = Math.PI / 2;
  hilo.position.set(0, HILO.y, HILO.z);
  hilo.name = 'hilo';
  v.add(hilo);

  /* el rabito: gordito, curvo y con su gorrito (el cáliz) */
  const rabo = new THREE.Group();
  const tallo = new THREE.Mesh(
    forma('rabo-arveja2', () => curvar(new THREE.CapsuleGeometry(0.014, 0.085, 3, 8, 6), { eje: 'y', hacia: 'z', k: 6 })),
    mate(THREE, COMIDA.hilo_arveja));
  const caliz = new THREE.Mesh(
    forma('caliz-arveja', () => new THREE.SphereGeometry(0.034, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1)),
    mate(THREE, COMIDA.hilo_arveja));
  caliz.position.y = -0.062;
  rabo.add(tallo, caliz);
  rabo.rotation.z = Math.PI / 2.5;
  rabo.position.set(-0.46, 0.022, 0.012);
  rabo.name = 'rabo';
  v.add(rabo);

  return v;
});

registrar('arveja', (THREE, opts = {}) => {
  const a = new THREE.Group();
  a.name = 'arveja';
  /* casi esférica, pero no del todo: la arveja se aplana un poco
     donde apretaba contra sus vecinas dentro de la vaina */
  const sombra = new THREE.Color(COMIDA.arveja_sombra), luz = new THREE.Color(COMIDA.arveja);
  const geo = formaVariada('arveja2', 4, opts.variante || 0, (k) => pintar(THREE,
    abollar(new THREE.SphereGeometry(1, 16, 11), { fuerza: 0.05, escala: 2.2, semilla: k + 21 }),
    (c, i, x, y, z, nx, ny) => { c.copy(sombra).lerp(luz, Math.pow(Math.max(0, Math.min(1, ny * 0.5 + 0.62)), 1.2)); }));
  const cuerpo = new THREE.Mesh(geo, aterciopelado(THREE, '#ffffff',
    { vertexColors: true, borde: { color: COMIDA.arveja_borde, fuerza: 0.3, potencia: 2.2 } }));
  cuerpo.scale.set(ARVEJA_R.x, ARVEJA_R.y, ARVEJA_R.z);
  cuerpo.name = 'cuerpo';
  /* la cicatriz: el puntito claro por donde iba pegada a la vaina */
  const cicatriz = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), mate(THREE, COMIDA.arveja_cicatriz));
  cicatriz.position.set(0, -0.05, 0.02);
  cicatriz.scale.set(1, 0.5, 1);
  cicatriz.name = 'cicatriz';
  cicatriz.userData.ignorar = true;
  a.add(cuerpo, cicatriz);
  return a;
});
