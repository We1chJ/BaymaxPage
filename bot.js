/*!
 * Baymax face engine — extracted from bloub (https://github.com/jeremy-prt/bloub),
 * src/bot/ and src/ui/gaze.ts only, types stripped and bundled into one script.
 * Do not edit by hand: regenerate with: node tools/bundle-bloub.mjs <path-to-bloub-clone> bot.js
 *
 * MIT License
 * 
 * Copyright (c) 2026 Jérémy Perret
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(() => {
"use strict";
const __m = {};

// ---- bot/math.ts
__m["bot/math"] = (() => {
const TAU = Math.PI * 2

const clamp = (v        , lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v)
const lerp = (a        , b        , t        ) => a + (b - a) * t

                                          

/**
 * Mesure sur la video : les transitions sont des ease-out exponentiels, sans
 * depassement du corps. Les seuls effets de ressort sont locaux (le pop de la
 * pastille de notification, l'ouverture des yeux) et sont ecrits directement
 * dans l'etat concerne.
 */
const easings = {
  easeOutCubic: (t        ) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t        ) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutQuint: (t        ) => 1 - (1 - t) ** 5
}                                 

/** Bruit 1D periodique : boucle sans couture sur `period`, utile pour la derive du regard. */
function loopNoise(t        , period        , seed = 0)         {
  const p = (t / period) * TAU
  return (
    0.55 * Math.sin(p + seed) +
    0.3 * Math.sin(2 * p + seed * 1.7 + 1.1) +
    0.15 * Math.sin(3 * p + seed * 2.3 + 2.4)
  )
}

/** PRNG deterministe (mulberry32) : meme sequence a chaque lecture. */
function createRng(seed        ) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Arrondi court : divise par ~2 le poids des chaines de path generees a 60 fps. */
const r2 = (v        ) => Math.round(v * 100) / 100

return { TAU, clamp, lerp, easings, loopNoise, createRng, r2 };
})();

// ---- bot/decor.ts
__m["bot/decor"] = (() => {
const { TAU, clamp, createRng, r2 } = __m["bot/math"];/* ------------------------------------------------------------------ couleurs */

/**
 * Les anneaux ne sont pas des couleurs plates : la video montre une roue de
 * teintes complete a luminosite constante, avec un degrade le long de chaque
 * trace. Mesure : S 45-62 %, L 50-67 %.
 */
function wheel(hue        , s = 0.55, l = 0.62)         {
  const h = ((hue % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const hex = (v        ) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/* ------------------------------------------------------------- types de rendu */

                            
           
           
           
                 
                                                                     
                
     
                                                                               
                                                                      
     
                
     
                                                                               
                                                                           
                                                   
     
            
                                            
              
 

/**
 * Ce qu'un etat declare : la geometrie de l'arc reste en unites de rayon de
 * boule, c'est le moteur (seul a connaitre l'echelle du viewBox) qui la
 * rasterise. Sans ca les etats devraient connaitre le viewBox.
 */
                          
            
               
           
                 
 

                            
            
                                
               
                                                                                   
              
               
                 
                                           
                                                                           
 

/* --------------------------------------------------------- arc elliptique 3D */

                          
                                                    
           
                                                                                       
           
                                                    
              
                          
               
               
                                           
               
             
                 
               
            
            
 

/**
 * Projette un cercle 3D incline en orthographique.
 *
 * Le cercle vit dans le plan engendre par u (dans l'ecran) et v (qui plonge
 * dans la profondeur). La composante z sert a couper l'arc en deux : la moitie
 * arriere est dessinee avant le corps, donc occultee par lui. C'est ce vrai tri
 * en profondeur qui fait lire les anneaux comme des orbites et pas comme un
 * dessin plat.
 */
function arcRender(seed         , t        , scale        , id        , opacity = 1)            {
  const spin = seed.phase + t * seed.speed * TAU
  const cu = Math.cos(seed.tilt)
  const su = Math.sin(seed.tilt)
  const kz = Math.sqrt(Math.max(0, 1 - seed.k * seed.k))

  const N = 64
  const span = seed.sweep * TAU
  let front = ''
  let back = ''
  let prev                 = null

  for (let i = 0; i <= N; i++) {
    const th = spin + (i / N) * span
    const ct = Math.cos(th)
    const st = Math.sin(th)
    // u = (cos tilt, sin tilt, 0) ; v = (-sin tilt * k, cos tilt * k, kz)
    const x = seed.a * (ct * cu + st * -su * seed.k) + seed.cx
    const y = seed.a * (ct * su + st * cu * seed.k) + seed.cy
    const z = seed.a * st * kz

    const behind = z < 0
    const sx = r2(x * scale)
    const sy = r2(y * scale)
    const cmd = behind !== prev ? 'M' : 'L'
    if (behind) back += `${cmd}${sx} ${sy}`
    else front += `${cmd}${sx} ${sy}`
    prev = behind
  }

  const gx = Math.cos(seed.tilt) * seed.a * scale
  const gy = Math.sin(seed.tilt) * seed.a * scale
  return {
    id,
    front,
    back,
    width: seed.width * scale,
    opacity,
    grad: {
      x1: r2(seed.cx * scale - gx),
      y1: r2(seed.cy * scale - gy),
      x2: r2(seed.cx * scale + gx),
      y2: r2(seed.cy * scale + gy),
      stops: [wheel(seed.hue), wheel(seed.hue + seed.hueSpan * 0.5), wheel(seed.hue + seed.hueSpan)]
    }
  }
}

/* ---------------------------------------------------------------- anneaux */

const RING_RNG = createRng(0xa11ce)

/**
 * 6 anneaux, demi-grand axe 1.30-1.40 (donc nettement plus grands que la
 * boule), aplatissement toujours <= 0.45, epaisseur 0.055, ~3.3 tours/s.
 */
const RINGS            = Array.from({ length: 6 }, (_, i) => ({
  a: 1.3 + RING_RNG() * 0.1,
  k: 0.05 + RING_RNG() * 0.4,
  tilt: (i / 6) * Math.PI + RING_RNG() * 0.5,
  speed: 3 + RING_RNG() * 0.7,
  phase: RING_RNG() * TAU,
  sweep: 0.6 + RING_RNG() * 0.25,
  hue: (i * 360) / 6 + RING_RNG() * 30,
  hueSpan: 60 + RING_RNG() * 60,
  width: 0.05 + RING_RNG() * 0.012,
  cx: 0,
  cy: 0.1
}))

/**
 * Bouquet d'arcs emboites qui balaie le triangle juste avant les orbites.
 * Vus quasiment par la tranche (d'ou la forme en epingle a cheveux), rmax 1.37.
 */
const SWOOSH            = Array.from({ length: 4 }, (_, i) => ({
  a: 0.78 + i * 0.2,
  k: 0.05 + i * 0.02,
  tilt: -0.62 + i * 0.05,
  speed: 0.3,
  phase: 0.06 * i,
  sweep: 0.4,
  hue: 95 + i * 62,
  hueSpan: 100,
  width: 0.05,
  cx: 0,
  cy: -0.12
}))

/* ------------------------------------------------------------- 3 points */

/** x mesures : -0.557 / -0.013 / +0.532, y = 0. */
const DOT_X = [-0.557, -0.013, 0.532]         
const DOT_R = 0.165
const DOT_PEAK = 1.25

/* ------------------------------------------------------------ particules */

const P_RNG = createRng(0xbeef)

/** 5 particules, une nouvelle toutes les 0.2 s, duree de vie 0.55 s. */
const PARTICLES = Array.from({ length: 5 }, (_, i) => ({
  birth: i * 0.2,
  angle: P_RNG() * TAU,
  rho: 0.58 + P_RNG() * 0.18
}))

/**
 * Les particules ne partent pas en ligne droite : elles spiralent vers le
 * centre (rayon x0.75 par frame, angle +100 deg/s) en grossissant, et passent
 * derriere le noyau ou elles sont avalees.
 */
function particles(t        , scale        )              {
  const out              = []
  for (const p of PARTICLES) {
    const u = t - p.birth
    if (u < 0 || u > 0.62) continue
    const rho = p.rho * Math.pow(0.75, u * 10)
    const a = p.angle + (u * 100 * Math.PI) / 180
    out.push({
      x: Math.cos(a) * rho * scale,
      y: Math.sin(a) * rho * scale,
      r: (0.04 + 0.028 * clamp(u / 0.55)) * scale,
      depth: clamp(1 - rho / 0.8),
      opacity: clamp(u / 0.06) * clamp((0.62 - u) / 0.08)
    })
  }
  return out
}

/* ------------------------------------------------------------------ comete */

/**
 * Contrairement a l'intuition, le point ne traverse pas l'ecran : il reste au
 * centre et c'est la trainee qui l'orbite. Ellipse a = 0.85, b = 0.15,
 * grand axe incline de +34deg, 4 rubans, ~210 deg/s.
 */
const COMET_RNG = createRng(0xc0e7)
const COMET_RIBBONS            = Array.from({ length: 4 }, (_, i) => {
  const d = i - 1.5
  return {
    a: 0.85 * (1 + d * 0.03),
    // meme aplatissement a +-5 % pres : les rubans forment un faisceau serre
    k: (0.15 / 0.85) * (1 + d * 0.16),
    tilt: (34 * Math.PI) / 180 + d * 0.035,
    speed: 210 / 360,
    // dephasage mesure : 10 a 20 degres entre rubans, pas davantage
    phase: -i * 0.045 + COMET_RNG() * 0.012,
    sweep: 0.34,
    hue: i * 85 + COMET_RNG() * 20,
    hueSpan: 80,
    width: 0.095,
    cx: 0,
    cy: 0
  }
})

/** Rayon du point de la comete, mesure a 0.129. */
const COMET_DOT = 0.129

/* --------------------------------------------------- pastille notification */

/** Bleu releve au pixel. */
const NOTIF_BLUE = '#2496e8'
/** La pastille est posee exactement sur la circonference, a -42deg. */
const NOTIF_ANGLE = -42
const NOTIF_DIST = 1.003
/** Rayon au repos ; le pop culmine 14 % au-dessus. */
const NOTIF_R = 0.15
const NOTIF_POP = 1.14
/**
 * L'encoche est un disque concentrique a la pastille, soustrait du corps.
 * La marge est constante (0.054 R) et suit l'echelle du corps.
 */
const NOTIF_MARGIN = 0.054

return { arcRender, RINGS, SWOOSH, DOT_X, DOT_R, DOT_PEAK, particles, COMET_RIBBONS, COMET_DOT, NOTIF_BLUE, NOTIF_ANGLE, NOTIF_DIST, NOTIF_R, NOTIF_POP, NOTIF_MARGIN };
})();

// ---- bot/face.ts
__m["bot/face"] = (() => {
const { clamp, createRng, loopNoise } = __m["bot/math"];/**
 * Les yeux sont peints sur une sphere, pas poses a plat.
 *
 * Mesure sur la video : l'oeil le plus proche du bord fait 0.69 fois la largeur
 * de l'autre, et son aire 0.663 fois — exactement le facteur de profondeur
 * (z = 0.669) d'un point de sphere a cette distance du centre. On modelise donc
 * une vraie orientation de tete : chaque oeil recupere le repere tangent de la
 * sphere, projete en orthographique. La compression et l'inclinaison en
 * decoulent toutes seules, c'est ce qui donne le volume.
 *
 * Les constantes ci-dessous ne sont pas choisies a la main : elles sortent d'un
 * ajustement du modele sur les positions et tailles relevees image par image
 * (erreur residuelle ~1 px sur un rayon de 190 px).
 */

                                    

/** Demi-ecart des yeux sur la sphere, en degres (separation totale ~31deg). */
const EYE_SPLIT = 15.46
/** Taille de l'oeil au repos, en unites de rayon de boule. */
const EYE_W = 0.186
const EYE_H = 0.412

/** Orientation de tete au repos, ajustee sur les frames de reference. */
const REST_GAZE           = { yaw: 28.49, pitch: 28.62, roll: -13 }

                          
           
           
                                                                         
           
           
           
           
                                                        
               
 

                           
                                                  
             
                                                   
               
                                               
              
 

const deg = (d        ) => (d * Math.PI) / 180

/** Fait tourner deux vecteurs d'un repere orthonorme dans leur plan commun. */
function spin(u      , v      , angle        )               {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s]
  ]
}

/**
 * Repere de la tete puis des deux yeux.
 * Repere ecran : x a droite, y vers le bas, z vers le spectateur.
 * L'indice 0 est l'oeil interieur, l'indice 1 l'oeil exterieur.
 */
function eyePoses(gaze          , scale        , split = EYE_SPLIT)                     {
  let f       = [0, 0, 1]
  let right       = [1, 0, 0]
  let down       = [0, 1, 0]

  // lacet : forward bascule vers right
  ;[f, right] = spin(f, right, deg(gaze.yaw))
  // tangage : forward bascule vers le haut (donc a l'oppose de down)
  ;[down, f] = spin(down, f, deg(gaze.pitch))
  // roulis : la tete penche dans son propre plan
  ;[right, down] = spin(right, down, deg(gaze.roll))

  const build = (side        )          => {
    const [ef, er] = spin(f, right, deg(split * side))
    return {
      x: ef[0] * scale,
      y: ef[1] * scale,
      a: er[0],
      b: er[1],
      c: down[0],
      d: down[1],
      depth: ef[2]
    }
  }

  return [build(-1), build(1)]
}

/**
 * Vie au repos : derive lente du regard, saccades, clignements.
 *
 * Fonction pure du temps (aucun etat interne), donc pause, reprise et saut a
 * une date arbitraire donnent toujours la meme image. Les valeurs sont des
 * ECARTS a ajouter a la pose de l'etat courant.
 */
                             
              
                
               
                                                                         
             
                
                
                
 

const BLINK_RNG = createRng(0x5eed)
/** Calendrier de clignements pre-tire : deterministe et sans etat. */
const BLINKS           = (() => {
  const out           = []
  let t = 1.4
  while (t < 900) {
    out.push(t)
    // 1.9 a 4.6 s entre deux clignements, plus un double clignement parfois
    t += 1.9 + BLINK_RNG() * 2.7
    if (BLINK_RNG() < 0.18) {
      out.push(t)
      t += 0.24
    }
  }
  return out
})()

/** Mesure : 1 a 2 frames a 10 fps. */
const BLINK_DUR = 0.18

function blinkLid(t        )         {
  for (let i = 0; i < BLINKS.length; i++) {
    const start = BLINKS[i] 
    if (t < start) break
    const k = (t - start) / BLINK_DUR
    if (k >= 0 && k <= 1) {
      // fermeture rapide, reouverture un peu plus lente
      return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55
    }
  }
  return 1
}

                                    
                 
                 
                 
 

function liveliness(t        , opt                    = {})             {
  const { wander = 1, blink = true, float = true } = opt

  // Periodes premieres entre elles : la derive ne se repete jamais a l'oeil.
  return {
    dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
    dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander,
    dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
    lid: blink ? blinkLid(t) : 1,
    // Au repos la video est quasiment immobile (centre stable a +-0.003, rayon
    // constant) : toute la vie passe par le regard et les clignements. On garde
    // juste de quoi ne pas figer completement l'image.
    driftX: float ? loopNoise(t, 7.9, 1.9) * 0.006 : 0,
    driftY: float ? loopNoise(t, 5.3, 0.3) * 0.007 : 0,
    // La largeur est constante, seule la hauteur respire tres legerement.
    breath: float ? 1 + Math.sin((t / 3.4) * Math.PI * 2) * 0.005 : 1
  }
}

/**
 * Le clignement est un ecrasement VERTICAL en repere ecran autour du centre de
 * l'oeil (mesure : la largeur de bbox est conservee, la hauteur tombe a ~0.35),
 * pas un retrecissement le long de l'axe incline de la gelule. On le compose
 * donc apres la matrice tangente, en n'affectant que les sorties en y.
 */
function blinkScale(lid        )         {
  return 0.06 + 0.94 * clamp(lid)
}

return { EYE_SPLIT, EYE_W, EYE_H, REST_GAZE, eyePoses, liveliness, blinkScale };
})();

// ---- bot/expressions.ts
__m["bot/expressions"] = (() => {
const { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE } = __m["bot/face"];const { lerp } = __m["bot/math"];/**
 * Expression de repos du bot.
 *
 * Le visage ne tient qu'à deux gélules, donc tout se joue sur quatre leviers :
 * l'orientation de la tête, l'écart des yeux, leurs proportions, et
 * l'inclinaison propre de chaque œil. C'est ce dernier qui permet la colère et
 * la tristesse : elles demandent des inclinaisons EN MIROIR (les hauts qui
 * convergent ou divergent), impossible avec le seul roulis de tête qui incline
 * les deux yeux du même côté.
 *
 * Seul l'état de repos porte cette expression. Les états expressifs de la vidéo
 * (clin d'œil, yeux écarquillés, notification) gardent la leur : c'est elle
 * qu'on est venu reproduire.
 *
 * Les amplitudes s'appuient sur bible-strong-avatar-lab, qui expose le même
 * modèle (tête X/Y/Z, largeur et hauteur par œil, écart, angle par œil) : chez
 * eux la largeur va de 0,8 à 2,7 fois le neutre, la hauteur de 0,3 à 1,5, et
 * les angles jusqu'à ±80°. On reste dans cette enveloppe.
 */
/** Enumeres pour que la couche i18n verifie leurs traductions a la compilation. */
                          
            
              
             
            
             
            
            
            
             
             
            
             
          
            
           
               

                                
                  
                
               
                        
 

/** `tilt` en degrés, positif = le haut de la gélule part vers la droite. */
const eye = (w        , h        , tilt = 0, open = 1)         => ({ w, h, tilt, open })

/** Les deux yeux identiques, inclinaisons en miroir si `tilt` est fourni. */
const pair = (w        , h        , tilt = 0, open = 1)                   => [
  eye(w, h, tilt, open),
  eye(w, h, -tilt, open)
]

const EXPRESSIONS                  = [
  {
    // la pose relevée image par image sur la vidéo de référence
    id: 'neutre',
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: [eye(EYE_W, EYE_H), eye(EYE_W, EYE_H)]
  },
  {
    id: 'attentif',
    gaze: { yaw: 4, pitch: 5, roll: -4 },
    split: 16,
    eyes: pair(0.21, 0.44)
  },
  {
    id: 'surpris',
    gaze: { yaw: 3, pitch: -3, roll: 0 },
    split: 19,
    eyes: pair(0.45, 0.47)
  },
  {
    id: 'excite',
    gaze: { yaw: 6, pitch: -14, roll: 0 },
    split: 19.5,
    eyes: pair(0.4, 0.56, -10)
  },
  {
    // yeux plissés en arc : les hauts convergent légèrement
    id: 'heureux',
    gaze: { yaw: 5, pitch: 9, roll: 0 },
    split: 17,
    eyes: pair(0.27, 0.17, 14)
  },
  {
    id: 'hilare',
    gaze: { yaw: 4, pitch: 14, roll: 0 },
    split: 18,
    eyes: pair(0.34, 0.13, 20)
  },
  {
    // hauts des yeux qui convergent fort vers le centre + yeux étrécis
    id: 'colere',
    gaze: { yaw: 3, pitch: 7, roll: 0 },
    split: 17,
    eyes: pair(0.34, 0.15, 30)
  },
  {
    // l'inverse : les hauts divergent, et le regard tombe
    id: 'triste',
    gaze: { yaw: 3, pitch: -13, roll: 0 },
    split: 16,
    eyes: pair(0.22, 0.4, -28)
  },
  {
    id: 'effraye',
    gaze: { yaw: 2, pitch: -20, roll: 0 },
    split: 20.5,
    eyes: pair(0.4, 0.6)
  },
  {
    // un œil franchement plus fermé que l'autre
    id: 'mefiant',
    gaze: { yaw: 12, pitch: 6, roll: -6 },
    split: 16,
    eyes: [eye(0.21, 0.4), eye(0.22, 0.15)]
  },
  {
    // asymétrique sur les deux axes : tailles ET inclinaisons dépareillées.
    // L'œil plissé est volontairement plat (rapport 1,6) : à un rapport proche
    // de 1 il serait rond, et son inclinaison ne se verrait pas.
    id: 'confus',
    gaze: { yaw: -14, pitch: 3, roll: 8 },
    split: 16.5,
    eyes: [eye(0.2, 0.44, -18), eye(0.28, 0.17, 14)]
  },
  {
    // la tête penche : c'est le roulis qui porte la curiosité
    id: 'curieux',
    gaze: { yaw: 16, pitch: -9, roll: -15 },
    split: 16.5,
    eyes: [eye(0.24, 0.46, -8), eye(0.2, 0.38, -8)]
  },
  {
    id: 'fier',
    gaze: { yaw: 5, pitch: 17, roll: 0 },
    split: 17,
    eyes: pair(0.3, 0.15, 18)
  },
  {
    id: 'timide',
    gaze: { yaw: -19, pitch: -14, roll: -7 },
    split: 14,
    eyes: pair(0.17, 0.3)
  },
  {
    // fentes horizontales et regard qui part sur le côté
    id: 'blase',
    gaze: { yaw: -22, pitch: 2, roll: 0 },
    split: 16,
    eyes: pair(0.3, 0.12)
  },
  {
    // paupières à moitié tombées : on passe par `open`, donc l'écrasement
    // vertical à l'écran, le même mécanisme que le clignement
    id: 'somnolent',
    gaze: { yaw: 6, pitch: -9, roll: -3 },
    split: 16,
    eyes: pair(0.2, 0.42, 0, 0.42)
  }
]

const EXPRESSION_BY_ID = new Map                       (EXPRESSIONS.map((e) => [e.id, e]))
const DEFAULT_EXPRESSION = 'neutre'

const lerpEyeCfg = (a        , b        , t        )         => ({
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t),
  open: lerp(a.open, b.open, t)
})

/** Interpolation de deux expressions : le changement se fait en glissant. */
function blendExpression(a               , b               , t        )                {
  return {
    id: b.id,
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t)
    },
    split: lerp(a.split, b.split, t),
    eyes: [lerpEyeCfg(a.eyes[0], b.eyes[0], t), lerpEyeCfg(a.eyes[1], b.eyes[1], t)]
  }
}

return { EXPRESSIONS, EXPRESSION_BY_ID, DEFAULT_EXPRESSION, blendExpression };
})();

// ---- bot/profiles.ts
__m["bot/profiles"] = (() => {
// Profils radiaux r(theta) releves au pixel sur la video de reference.
// theta = 0 pointe vers la droite et croit dans le sens horaire (y vers le bas).
// Unite : rayon de la boule au repos = 1.
//
// Genere par tools/extract-profiles.py — ne pas editer a la main.

const PROFILE_SAMPLES = 64

const PROFILES = {
  // oeuf : meme hauteur que la boule, retreci en largeur
  // image 164, empreinte mesuree 1.647 x 2.000
  egg: [0.8369,0.8424,0.8497,0.8585,0.8674,0.8775,0.8878,0.8983,0.9089,0.9185,0.9288,0.9374,0.9445,0.9504,0.9543,0.9559,0.9555,0.9519,0.9466,0.9389,0.9302,0.9193,0.9085,0.8969,0.8852,0.8734,0.8625,0.8513,0.8411,0.8325,0.8243,0.8179,0.8137,0.8112,0.8102,0.8128,0.8178,0.8262,0.8374,0.8518,0.8702,0.8922,0.9169,0.9446,0.9741,1.0023,1.0267,1.0433,1.0481,1.0393,1.0216,0.9970,0.9697,0.9418,0.9169,0.8949,0.8760,0.8604,0.8490,0.8394,0.8337,0.8314,0.8305,0.8326],
  // hexagone pointe en haut, coins tres arrondis
  // image 174, empreinte mesuree 1.826 x 2.011
  hexagon: [0.9210,0.9282,0.9441,0.9706,0.9984,1.0059,0.9896,0.9562,0.9290,0.9124,0.9047,0.9058,0.9157,0.9349,0.9642,0.9873,0.9882,0.9665,0.9336,0.9105,0.8968,0.8918,0.8955,0.9080,0.9293,0.9611,0.9820,0.9812,0.9590,0.9282,0.9089,0.8978,0.8964,0.9026,0.9189,0.9439,0.9778,0.9990,0.9964,0.9713,0.9439,0.9274,0.9196,0.9206,0.9308,0.9502,0.9799,1.0121,1.0226,1.0071,0.9752,0.9510,0.9366,0.9316,0.9351,0.9485,0.9711,1.0026,1.0213,1.0155,0.9863,0.9547,0.9347,0.9232],
  // triangle pointe en haut, coins tres arrondis
  // image 190, empreinte mesuree 1.995 x 1.884
  triangle: [0.7819,0.8211,0.8747,0.9440,1.0223,1.0960,1.1401,1.1340,1.0808,1.0047,0.9265,0.8603,0.8104,0.7730,0.7450,0.7273,0.7151,0.7118,0.7148,0.7245,0.7427,0.7680,0.8037,0.8518,0.9148,0.9876,1.0583,1.1073,1.1109,1.0667,0.9940,0.9164,0.8482,0.7948,0.7555,0.7261,0.7056,0.6925,0.6859,0.6869,0.6938,0.7084,0.7305,0.7615,0.8040,0.8595,0.9311,1.0092,1.0791,1.1171,1.1054,1.0501,0.9779,0.9050,0.8450,0.7990,0.7656,0.7413,0.7258,0.7160,0.7146,0.7204,0.7330,0.7528],
}         

                                               


return { PROFILE_SAMPLES, PROFILES };
})();

// ---- bot/shape.ts
__m["bot/shape"] = (() => {
const { TAU, lerp, r2 } = __m["bot/math"];const { PROFILES, PROFILE_SAMPLES } = __m["bot/profiles"];/**
 * Une silhouette = un profil radial r(theta) plus une pose.
 *
 * Tout passe par des profils echantillonnes au MEME nombre d'angles : deux
 * formes quelconques ont donc des points qui se correspondent un a un, et le
 * morphing se reduit a une interpolation lineaire des rayons. C'est ce qui
 * rend les transitions propres sans librairie de morphing de path.
 */
                             
                 
                                       
             
                                                        
            
            
                                                                    
            
            
 

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * TAU)
const COS = ANGLES.map(Math.cos)
const SIN = ANGLES.map(Math.sin)

function silhouette(name             , pose                      = {})             {
  return {
    radii: [...PROFILES[name]],
    rot: 0,
    cx: 0,
    cy: 0,
    sx: 1,
    sy: 1,
    ...pose
  }
}

/** Cercle parfait : sert de base neutre (point, bulle, cible de fondu). */
function circle(radius        , pose                      = {})             {
  return {
    radii: new Array(PROFILE_SAMPLES).fill(radius),
    rot: 0,
    cx: 0,
    cy: 0,
    sx: 1,
    sy: 1,
    ...pose
  }
}

/** Interpolation de deux silhouettes. `out` est reutilise pour eviter d'allouer a 60 fps. */
function blend(a            , b            , t        , out             )             {
  const dst = out ?? { radii: new Array        (PROFILE_SAMPLES), rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    dst.radii[i] = lerp(a.radii[i] ?? 1, b.radii[i] ?? 1, t)
  }
  // Rotation par le chemin le plus court : evite de faire un tour complet
  // quand on passe par exemple de +170deg a -170deg.
  let dRot = b.rot - a.rot
  while (dRot > Math.PI) dRot -= TAU
  while (dRot < -Math.PI) dRot += TAU
  dst.rot = a.rot + dRot * t
  dst.cx = lerp(a.cx, b.cx, t)
  dst.cy = lerp(a.cy, b.cy, t)
  dst.sx = lerp(a.sx, b.sx, t)
  dst.sy = lerp(a.sy, b.sy, t)
  return dst
}

/** Projette la silhouette en points ecran. `scale` = rayon de la boule en unites de viewBox. */
function toPoints(s            , scale        , out          = [])          {
  const cr = Math.cos(s.rot)
  const sr = Math.sin(s.rot)
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const r = s.radii[i] ?? 1
    const x = r * (COS[i] ?? 0)
    const y = r * (SIN[i] ?? 0)
    // rotation puis squash en repere ecran, puis translation
    const rx = x * cr - y * sr
    const ry = x * sr + y * cr
    const p = out[i] ?? { x: 0, y: 0 }
    p.x = (rx * s.sx + s.cx) * scale
    p.y = (ry * s.sy + s.cy) * scale
    out[i] = p
  }
  out.length = PROFILE_SAMPLES
  return out
}

/**
 * Polyligne fermee -> cubiques Catmull-Rom.
 *
 * Avec 64 points les tangentes centrees suffisent largement : le contour est
 * lisse au pixel pres meme affiche en 600 px, et la chaine reste courte.
 */
function closedPath(pts         , tension = 1 / 6)         {
  const n = pts.length
  if (n < 3) return ''
  const first = pts[0] 
  let d = `M${r2(first.x)} ${r2(first.y)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n] 
    const p1 = pts[i] 
    const p2 = pts[(i + 1) % n] 
    const p3 = pts[(i + 2) % n] 
    const c1x = p1.x + (p2.x - p0.x) * tension
    const c1y = p1.y + (p2.y - p0.y) * tension
    const c2x = p2.x - (p3.x - p1.x) * tension
    const c2y = p2.y - (p3.y - p1.y) * tension
    d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`
  }
  return `${d}Z`
}

/**
 * Polygone quelconque -> profil radial, par lancer de rayon depuis `center`.
 *
 * Sert a fabriquer les formes qui ne s'expriment pas naturellement en r(theta)
 * (la barre tronconique du "!"). Calcule une seule fois au chargement, jamais
 * dans la boucle de rendu.
 */
function profileFromPolygon(poly         , cx        , cy        )           {
  const radii = new Array        (PROFILE_SAMPLES).fill(0)
  const n = poly.length
  for (let k = 0; k < PROFILE_SAMPLES; k++) {
    const dx = COS[k] ?? 0
    const dy = SIN[k] ?? 0
    let best = 0
    for (let i = 0; i < n; i++) {
      const a = poly[i] 
      const b = poly[(i + 1) % n] 
      const ex = b.x - a.x
      const ey = b.y - a.y
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-9) continue
      const px = a.x - cx
      const py = a.y - cy
      const t = (px * ey - py * ex) / den // distance le long du rayon
      const u = (px * dy - py * dx) / den // position sur le segment
      if (t > best && u >= 0 && u <= 1) best = t
    }
    radii[k] = best
  }
  return radii
}

/** Enveloppe convexe de deux cercles : la barre tronconique du "!" vertical. */
function hullOfCircles(
  x1        ,
  y1        ,
  r1        ,
  x2        ,
  y2        ,
  r2v        ,
  steps = 96
)          {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy) || 1e-6
  // angle des tangentes externes communes
  const base = Math.atan2(dy, dx)
  const spread = Math.acos(Math.max(-1, Math.min(1, (r1 - r2v) / dist)))
  const pts          = []
  // arc du grand cercle
  for (let i = 0; i <= steps / 2; i++) {
    const a = base + spread + ((TAU - 2 * spread) * i) / (steps / 2)
    pts.push({ x: x1 + Math.cos(a) * r1, y: y1 + Math.sin(a) * r1 })
  }
  // arc du petit cercle
  for (let i = 0; i <= steps / 2; i++) {
    const a = base - spread + ((2 * spread) * i) / (steps / 2)
    pts.push({ x: x2 + Math.cos(a) * r2v, y: y2 + Math.sin(a) * r2v })
  }
  return pts
}

/**
 * Rayon du profil dans une direction quelconque, par interpolation entre les
 * deux echantillons voisins.
 *
 * Sert a recaler ce qui est pose "sur" le corps (les yeux, la pastille de
 * notification) quand la silhouette n'est plus un cercle : sans ca, un oeil
 * place a 0.62 rayon sort d'une forme dont le bord est a 0.55 dans cette
 * direction, et le masque le rogne.
 */
function radiusAtAngle(radii          , angle        )         {
  const n = radii.length
  const t = ((((angle / TAU) % 1) + 1) % 1) * n
  const i = Math.floor(t)
  return lerp(radii[i % n] ?? 1, radii[(i + 1) % n] ?? 1, t - i)
}

/**
 * Superellipse : |x/sx|^n + |y/sy|^n = 1.
 * n = 2 donne une ellipse, n ~ 4 le squircle du personnalisateur.
 */
function superellipseProfile(n        , sx = 1, sy = 1)           {
  return ANGLES.map((_, i) => {
    const c = Math.abs((COS[i] ?? 0) / sx) ** n
    const s = Math.abs((SIN[i] ?? 0) / sy) ** n
    return (c + s) ** (-1 / n)
  })
}

/**
 * Profil radial de l'UNION de disques : r(theta) = la plus lointaine des
 * intersections rayon/cercle. Exact tant que l'origine est dans l'union — c'est
 * ce qui donne les bosses du nuage sans booleen de path.
 */
function unionOfCirclesProfile(circles                                            )           {
  const out = new Array        (PROFILE_SAMPLES).fill(0)
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const dx = COS[i] ?? 0
    const dy = SIN[i] ?? 0
    let best = 0
    for (const c of circles) {
      const b = dx * c.x + dy * c.y
      const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r)
      if (disc < 0) continue
      const t = b + Math.sqrt(disc)
      if (t > best) best = t
    }
    out[i] = best
  }
  return out
}

/**
 * Polygone a coins arrondis, par somme de Minkowski avec un disque : chaque
 * arete est poussee de `rc` vers l'exterieur, chaque sommet devient un arc de
 * rayon `rc`. Les sommets sont donc a poser au rayon voulu MOINS rc.
 * Attend un polygone en sens horaire (repere ecran, y vers le bas).
 */
function roundedPolygon(verts         , rc        , arcSteps = 10)          {
  const n = verts.length
  const out          = []
  const normal = (a       , b       ) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    // sens horaire + y vers le bas : la normale sortante est (dy, -dx)
    return Math.atan2(-dx / len, dy / len)
  }
  for (let i = 0; i < n; i++) {
    const prev = verts[(i - 1 + n) % n] 
    const cur = verts[i] 
    const next = verts[(i + 1) % n] 
    const a0 = normal(prev, cur)
    const a1 = normal(cur, next)
    let d = a1 - a0
    while (d > Math.PI) d -= TAU
    while (d < -Math.PI) d += TAU
    for (let k = 0; k <= arcSteps; k++) {
      const a = a0 + (d * k) / arcSteps
      out.push({ x: cur.x + Math.cos(a) * rc, y: cur.y + Math.sin(a) * rc })
    }
  }
  return out
}

/** Polygone regulier a coins arrondis, inscrit dans `radius`. */
function regularPolygonProfile(
  sides        ,
  radius        ,
  rc        ,
  rotationDeg = 0
)           {
  const rot = (rotationDeg * Math.PI) / 180
  const verts = Array.from({ length: sides }, (_, i) => {
    // sens horaire a l'ecran : theta croissant avec y vers le bas
    const a = rot + (i / sides) * TAU
    return { x: Math.cos(a) * (radius - rc), y: Math.sin(a) * (radius - rc) }
  })
  return profileFromPolygon(roundedPolygon(verts, rc), 0, 0)
}

/** Polyligne fermee exacte : garde les segments droits (contrairement a closedPath). */
function polyPath(pts         , scale = 1)         {
  if (pts.length < 3) return ''
  let d = ''
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i] 
    d += `${i === 0 ? 'M' : 'L'}${r2(p.x * scale)} ${r2(p.y * scale)}`
  }
  return `${d}Z`
}

/** Capsule (stade) centree sur l'origine : la forme exacte des yeux du bot. */
function capsulePath(w        , h        )         {
  const hw = Math.max(w, 0.01) / 2
  const hh = Math.max(h, 0.01) / 2
  const r = Math.min(hw, hh)
  return (
    `M${r2(-hw)} ${r2(-hh + r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw + r)} ${r2(-hh)}` +
    `L${r2(hw - r)} ${r2(-hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} ${r2(-hh + r)}` +
    `L${r2(hw)} ${r2(hh - r)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw - r)} ${r2(hh)}` +
    `L${r2(-hw + r)} ${r2(hh)}` +
    `A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} ${r2(hh - r)}Z`
  )
}

return { silhouette, circle, blend, toPoints, closedPath, profileFromPolygon, hullOfCircles, radiusAtAngle, superellipseProfile, unionOfCirclesProfile, regularPolygonProfile, polyPath, capsulePath };
})();

// ---- bot/skins.ts
__m["bot/skins"] = (() => {
const { PROFILE_SAMPLES } = __m["bot/profiles"];const { hullOfCircles, profileFromPolygon, regularPolygonProfile, superellipseProfile, unionOfCirclesProfile } = __m["bot/shape"];/**
 * Formes et couleurs proposees par le personnalisateur du bot.
 *
 * A la difference des silhouettes d'animation (`profiles.ts`), celles-ci ne sont
 * PAS relevees sur la video : elles sont construites analytiquement d'apres la
 * grille du personnalisateur d'origine. Deux sources distinctes, donc, et c'est
 * volontaire — les etats animes doivent rester fideles a la video, les formes de
 * base sont un choix d'utilisateur.
 */

/**
 * Les identifiants sont enumeres plutot que deduits du tableau : c'est ce qui
 * permet a la couche i18n de verifier A LA COMPILATION que chaque forme a bien
 * sa traduction dans les trois langues (`t(\`shapes.${id}\`)` ne compile que si
 * la cle existe). Un `as const` sur le tableau aurait le meme effet mais
 * rendrait `radii` en lecture seule, alors que le moteur le passe tel quel.
 */
                     
            
           
              
             
              
              
           
            

                           
             
                 
 

/** Ramene le rayon maximal a `max` pour que toutes les formes pesent pareil a l'oeil. */
function normalize(radii          , max = 1)           {
  const peak = Math.max(...radii)
  if (peak <= 0) return radii
  const k = max / peak
  return radii.map((r) => r * k)
}

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * Math.PI * 2)

/** Galet : cercle deforme par deux harmoniques basses, donc irregulier mais lisse. */
const pebble = normalize(
  ANGLES.map((a) => 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)),
  1.02
)

/** Nuage : union de bosses, large en bas, deux lobes en haut. */
const cloud = normalize(
  unionOfCirclesProfile([
    { x: -0.44, y: 0.2, r: 0.54 },
    { x: 0.46, y: 0.2, r: 0.5 },
    { x: 0.02, y: 0.3, r: 0.6 },
    { x: -0.24, y: -0.3, r: 0.48 },
    { x: 0.3, y: -0.24, r: 0.44 }
  ]),
  1.02
)

/** Goutte : gros disque en bas, pointe effilee en haut. */
const droplet = normalize(
  profileFromPolygon(hullOfCircles(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0),
  1.04
)

/** Capsule couchee : enveloppe de deux disques cote a cote. */
const capsule = profileFromPolygon(hullOfCircles(-0.42, 0, 0.62, 0.42, 0, 0.62), 0, 0)

const SHAPES             = [
  { id: 'cercle', radii: new Array(PROFILE_SAMPLES).fill(1) },
  { id: 'galet', radii: pebble },
  // 1.15 et pas 1.02 : sur une superellipse le rayon maximal est la diagonale,
  // donc normaliser dessus donne une forme qui parait plus petite que le cercle.
  { id: 'squircle', radii: normalize(superellipseProfile(4.2), 1.15) },
  { id: 'capsule', radii: capsule },
  // -90deg : un sommet vers le haut de l'ecran (y est oriente vers le bas)
  { id: 'triangle', radii: regularPolygonProfile(3, 1.12, 0.34, -90) },
  // 0deg : sommets a gauche et a droite, donc aretes du haut et du bas plates
  { id: 'hexagone', radii: regularPolygonProfile(6, 1.04, 0.26, 0) },
  { id: 'nuage', radii: cloud },
  { id: 'goutte', radii: droplet }
]

// Map indexee par `string` et non par `ShapeId` : les appelants interrogent avec
// une valeur relue du localStorage ou d'une prop, donc non validee.
const SHAPE_BY_ID = new Map                  (SHAPES.map((s) => [s.id, s]))
const DEFAULT_SHAPE = 'cercle'

                     
           
           
          
           
            
           
          
               
          
            
          
          

                           
             
             
 

/** Palette du personnalisateur d'origine. */
const COLORS             = [
  { id: 'encre', hex: '#0a0a0c' },
  { id: 'brun', hex: '#8b5e3c' },
  { id: 'rouge', hex: '#e8483f' },
  { id: 'orange', hex: '#f08a24' },
  { id: 'ambre', hex: '#f0b429' },
  { id: 'vert', hex: '#3ecf8e' },
  { id: 'turquoise', hex: '#2fbfa0' },
  { id: 'bleu', hex: '#3b93f0' },
  { id: 'violet', hex: '#8b5cf6' },
  { id: 'rose', hex: '#e152b0' },
  { id: 'gris', hex: '#a3a3a3' },
  { id: 'creme', hex: '#f1efe9' }
]

const COLOR_BY_ID = new Map                  (COLORS.map((c) => [c.id, c]))
const DEFAULT_COLOR = 'encre'

/** Melange deux couleurs hex. Sert a la brume de profondeur des particules. */
function mixHex(from        , to        , t        )         {
  const parse = (h        ) => {
    const v = parseInt(h.slice(1), 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }
  const a = parse(from)
  const b = parse(to)
  const c = a.map((x, i) => Math.round(x + (b[i]  - x) * t))
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

return { SHAPES, SHAPE_BY_ID, DEFAULT_SHAPE, COLORS, COLOR_BY_ID, DEFAULT_COLOR, mixHex };
})();

// ---- bot/states.ts
__m["bot/states"] = (() => {
const { COMET_DOT, COMET_RIBBONS, DOT_PEAK, DOT_R, DOT_X, NOTIF_ANGLE, NOTIF_DIST, NOTIF_MARGIN, NOTIF_POP, NOTIF_R, RINGS, SWOOSH, particles } = __m["bot/decor"];const { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE } = __m["bot/face"];const { TAU, clamp, easings } = __m["bot/math"];const { circle, hullOfCircles, polyPath, profileFromPolygon, silhouette } = __m["bot/shape"];const pair = (w        , h        )                   => [
  { w, h, open: 1 },
  { w, h, open: 1 }
]

function base(over                = {})       {
  return {
    sil: circle(1),
    offX: 0,
    offY: 0,
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: pair(EYE_W, EYE_H),
    eyeAlpha: 1,
    bodyAlpha: 1,
    dots: [],
    arcs: [],
    notif: null,
    dotsBehind: false,
    ...over
  }
}

/* --------------------------------------------------- formes non radiales */

/**
 * Barre du "!" vertical : enveloppe convexe de deux cercles.
 * Mesure : cercle haut (0, -0.505) r 0.132, cercle bas (0, +0.130) r 0.075,
 * flancs rectilignes. Elle est donc tronconique (rapport haut/bas 1.76).
 */
const BAR_UPRIGHT_CY = -0.1875
const BAR_UPRIGHT = profileFromPolygon(
  hullOfCircles(0, -0.505, 0.132, 0, 0.13, 0.075),
  0,
  BAR_UPRIGHT_CY
)

/** Barre du "!" penche : capsule pure (largeur constante 0.269, longueur 0.776). */
const BAR_ITALIC = profileFromPolygon(hullOfCircles(0, -0.2535, 0.1345, 0, 0.2535, 0.1345), 0, 0)

const barUpright = (pose                      = {})             => ({
  radii: [...BAR_UPRIGHT],
  rot: 0,
  cx: 0,
  cy: BAR_UPRIGHT_CY,
  sx: 1,
  sy: 1,
  ...pose
})

const barItalic = (pose                      = {})             => ({
  radii: [...BAR_ITALIC],
  rot: 0,
  cx: 0,
  cy: 0,
  sx: 1,
  sy: 1,
  ...pose
})

/**
 * Le point du "!" penche n'est pas un disque : c'est une goutte, bout rond
 * (r 0.118) du cote de la barre et pointe effilee a l'oppose, longueur 0.300
 * dans l'axe du glyphe. Centree sur le barycentre du bout rond.
 */
const TEAR = polyPath(hullOfCircles(0, 0, 0.118, 0, 0.172, 0.012))

/**
 * Le triangle ne tourne pas sur lui-meme : son centre decrit un cercle de
 * rayon 0.213 autour de l'origine (mesure). C'est ce decalage qui donne
 * l'impression qu'il bascule au lieu de pivoter sur place.
 */
const TRI_ORBIT = 0.213

function spinningTriangle(rot        )             {
  return silhouette('triangle', {
    rot,
    cx: -TRI_ORBIT * Math.sin(rot),
    cy: TRI_ORBIT * Math.cos(rot)
  })
}

/* ------------------------------------------------------------------ etats */

                     
          
              
          
          
           
            
             
           
         
             
          
           
           
           
                                                                                 
           

                           
             
                                                               
                  
     
                                                                             
                                                                               
                                                                             
                                                                       
     
                      
                                
               
                                                                           
                  
     
                                                                                
                                                                                
                                                                                  
                            
     
                   
     
                                                                                
                                                                                
                                                        
     
                   
                           
 

/** Onde de pulsation qui parcourt les trois points de gauche a droite. */
function dotPulse(t        , index        )         {
  const p = ((((t - index * 0.5) / 1.5) % 1) + 1) % 1
  const k = p < 0.5 ? 0.5 - 0.5 * Math.cos(p * TAU) : 0
  return clamp(k * 2)
}

const STATES             = [
  {
    id: 'idle',
    duration: 2.4,
    morph: 0.45,
    blinkIn: false,
    baseFace: true,
    baseBody: true,
    pose: () => base()
  },

  {
    id: 'thinking',
    duration: 2.6,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: (t) => {
      const mid = dotPulse(t, 1)
      // Les points lateraux sortent des flancs de la boule : dans la video ils
      // restent fusionnes avec elle 1-2 frames avant de se detacher.
      const emerge = 0.3 + 0.7 * easings.easeOutCubic(clamp(t / 0.3))
      return base({
        // la boule DEVIENT le point du milieu : le morph reste continu
        sil: circle(DOT_R * (1 + (DOT_PEAK - 1) * mid), { cx: DOT_X[1]  }),
        eyeAlpha: 0,
        dots: [0, 2].map((i) => {
          const k = dotPulse(t, i)
          return {
            x: DOT_X[i]  * emerge,
            y: 0,
            r: DOT_R * (1 + (DOT_PEAK - 1) * k),
            opacity: 0.55 + 0.45 * k
          }
        })
      })
    }
  },

  {
    id: 'wink',
    duration: 1.6,
    morph: 0.3,
    blinkIn: true,
    baseFace: false,
    baseBody: true,
    pose: () =>
      base({
        gaze: { yaw: -5.37, pitch: 4.55, roll: 6.7 },
        split: 16.25,
        // L'oeil ferme n'est pas l'oeil ouvert ecrase : c'est un tiret
        // horizontal PLUS LARGE que l'oeil ouvert (0.447 contre 0.236).
        eyes: [
          { w: 0.236, h: 0.464, open: 1 },
          { w: 0.447, h: 0.089, open: 1 }
        ]
      })
  },

  {
    id: 'wide',
    duration: 1.8,
    morph: 0.55,
    blinkIn: true,
    baseFace: false,
    baseBody: true,
    pose: () =>
      base({
        gaze: { yaw: 6.92, pitch: -21.96, roll: 11.6 },
        split: 18.43,
        eyes: pair(0.356, 0.875)
      })
  },

  {
    id: 'alert',
    duration: 2.4,
    // le "!" revient en place a 1.6 + 0.4
    minDuration: 2,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      // Course mesuree : -0.087 -> +0.732 en 1.5 s, ease-in-out, micro-overshoot.
      const p = clamp(t / 1.5)
      const travel = easings.easeInOutCubic(p) * 0.82 - 0.087
      const back = t > 1.6 ? clamp((t - 1.6) / 0.4) : 0
      const x = travel * (1 - back) + 0.1 * back
      // Vibration secondaire a 2.5 Hz, barre et point en opposition de phase.
      const buzz = Math.sin(t * 2.5 * TAU) * 0.005
      const tilt = (17.7 * Math.PI) / 180
      return base({
        sil: barItalic({ rot: tilt, cx: x, cy: -0.325 - buzz }),
        eyeAlpha: 0,
        dots: [
          {
            // le point suit l'axe du glyphe, a 0.580 du centre de la barre
            x: x - Math.sin(tilt) * 0.58,
            y: -0.325 + Math.cos(tilt) * 0.58 + buzz * 2.8,
            r: 0.118,
            d: TEAR,
            rot: (tilt * 180) / Math.PI,
            opacity: 1
          }
        ]
      })
    }
  },

  {
    id: 'notify',
    duration: 2.2,
    morph: 0.5,
    blinkIn: true,
    baseFace: false,
    baseBody: true,
    pose: (t) => {
      // Pop du point bleu : pic a +14 % vers 0.3 s puis stabilisation.
      const p = clamp(t / 0.45)
      const pop = 1 + (NOTIF_POP - 1) * Math.sin(p * Math.PI) * (1 - p * 0.35)
      const r = NOTIF_R * (p < 1 ? pop : 1)
      const a = (NOTIF_ANGLE * Math.PI) / 180
      return base({
        // le regard part a l'oppose de la pastille
        gaze: { yaw: -21.94, pitch: -5.82, roll: -12.2 },
        split: 18.89,
        eyes: pair(0.505, 0.498),
        notif: {
          x: Math.cos(a) * NOTIF_DIST,
          y: Math.sin(a) * NOTIF_DIST,
          r,
          notch: r + NOTIF_MARGIN
        }
      })
    }
  },

  {
    id: 'exclaim',
    duration: 2,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: () =>
      base({
        sil: barUpright(),
        eyeAlpha: 0,
        dots: [{ x: -0.012, y: 0.526, r: 0.113, opacity: 1 }]
      })
  },

  {
    id: 'sleep',
    duration: 2.4,
    morph: 0.5,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) =>
      base({
        // Rebond vertical mesure : +-0.19 autour de +0.11, periode 0.6 s.
        sil: circle(0.1585, { cy: 0.11 + Math.sin(t * (TAU / 0.6)) * 0.19 }),
        eyeAlpha: 0
      })
  },

  {
    id: 'egg',
    duration: 1.8,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: () =>
      base({
        sil: silhouette('egg'),
        gaze: { yaw: 19.97, pitch: 26.01, roll: -17.1 },
        // les yeux se resserrent comme le corps
        split: 11.07,
        eyes: pair(0.164, 0.385)
      })
  },

  {
    id: 'hexagon',
    duration: 1.6,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: () =>
      base({
        sil: silhouette('hexagon'),
        gaze: { yaw: 23.11, pitch: 24.42, roll: -13.3 },
        split: 13.37,
        eyes: pair(0.177, 0.411)
      })
  },

  {
    id: 'play',
    duration: 2,
    morph: 0.5,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: (t) => {
      // Le triangle reste quasi immobile pendant que le bouquet le traverse.
      const fade = clamp(t / 0.35) * clamp((2.2 - t) / 0.5)
      return base({
        sil: spinningTriangle(0),
        gaze: { yaw: 12, pitch: -8, roll: -6 },
        split: 15,
        eyes: pair(0.18, 0.34),
        // le bouquet balaie de la droite vers la gauche par-dessus le triangle
        arcs: SWOOSH.map((s, i) => ({
          id: `sw${i}`,
          seed: { ...s, cx: 0.45 - t * 0.42 },
          t,
          opacity: fade
        }))
      })
    }
  },

  {
    id: 'orbit',
    duration: 3.4,
    // le corps a fini de se relacher du triangle vers la boule a 1.6 + 0.9
    minDuration: 2.5,
    morph: 0.6,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      // Rotation mesuree : rampe sur 0.35 s puis 1.25 tour/s (sens antihoraire).
      const ramp = easings.easeInOutCubic(clamp(t / 0.35))
      const rot = -TAU * 1.25 * t * ramp
      // Le corps se relache du triangle vers la boule pendant l'orbite.
      const back = easings.easeInOutCubic(clamp((t - 1.6) / 0.9))
      const tri = spinningTriangle(rot)
      const ball = circle(1, { rot })
      const sil             = {
        radii: tri.radii.map((r, i) => r + (ball.radii[i]  - r) * back),
        rot,
        cx: tri.cx * (1 - back),
        cy: tri.cy * (1 - back),
        sx: 1,
        sy: 1
      }
      const fade = clamp(t / 0.8) * clamp((3.6 - t) / 0.9)
      return base({
        sil,
        // les yeux filent autour de la sphere ~3x plus vite que la silhouette
        gaze: {
          yaw: REST_GAZE.yaw + Math.sin(t * 6.5) * 65 * (1 - back),
          pitch: -4 + back * 32,
          roll: -13
        },
        eyes: pair(0.18, 0.34 + back * 0.07),
        // les anneaux entrent un par un sur 0.8 s
        arcs: RINGS.map((s, i) => ({
          id: `rg${i}`,
          seed: s,
          t,
          opacity: fade * clamp((t - i * 0.13) / 0.3)
        }))
      })
    }
  },

  {
    /**
     * Entree dans la vue des reglages.
     *
     * SEUL etat qui n'est pas releve sur la video : il est CHOISI, comme la
     * couleur `--ink`. Il emprunte le vocabulaire d'`orbit` — les memes anneaux,
     * avec leurs parametres mesures — mais coupe court : 1 s au lieu de 3,4, la
     * moitie des anneaux, et aucun triangle.
     *
     * Les deux drapeaux a `true` sont tout l'interet de cet etat :
     *
     * - `baseBody` laisse la forme choisie remplacer le corps, donc la vue peut
     *   imposer le cercle et le galet ou la goutte y MORPHENT au lieu de sauter ;
     * - `baseFace` fait porter le visage de repos, donc le suivi du curseur
     *   s'applique des cette entree. Un etat qui aurait sa propre pose de regard
     *   (comme `orbit`) rendrait la main a l'etat suivant en pleine course, et
     *   les yeux sauteraient d'un coup a la reprise.
     *
     * Il n'est volontairement PAS dans `SEQUENCE` : ce n'est pas une animation du
     * catalogue, c'est une transition d'interface.
     */
    id: 'swirl',
    // un peu plus que le tour du regard (`TURN_TIME`, 1,1 s) : les yeux doivent
    // etre poses a gauche avant que les anneaux ne s'effacent
    duration: 1.3,
    minDuration: 1.3,
    morph: 0.3,
    baseFace: true,
    baseBody: true,
    // le morph de forme est masque par un clignement, comme partout ailleurs
    blinkIn: true,
    pose: (t) =>
      base({
        // trois anneaux sur les six d'`orbit` : la moitie du bouquet suffit a le
        // reconnaitre, et c'est autant d'arcs en moins a rasteriser par image
        arcs: RINGS.slice(0, 3).map((s, i) => ({
          id: `sw${i}`,
          seed: s,
          t,
          // ils entrent l'un apres l'autre puis s'effacent avant la fin du bloc,
          // pour que la reprise au repos se fasse sur une image deja propre
          opacity: clamp((t - i * 0.06) / 0.14) * clamp((1.22 - t) / 0.34)
        }))
      })
  },

  {
    id: 'burst',
    duration: 2.6,
    // le corps est recompose a 1.7 + 0.7
    minDuration: 2.4,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      // Effondrement mesure : 1.0 -> 0.166 en 0.7 s, ease-out, sans rebond.
      const collapse = 1 - 0.834 * easings.easeOutQuint(clamp(t / 0.7))
      const regrow = easings.easeOutQuint(clamp((t - 1.7) / 0.7))
      return base({
        sil: circle(collapse + (1 - collapse) * regrow),
        eyeAlpha: clamp((t - 1.85) / 0.4),
        dots: particles(t, 1),
        dotsBehind: true
      })
    }
  },

  {
    id: 'comet',
    duration: 2.4,
    // le point se recompose a 1.85 + 0.6 = 2.45, soit 0.05 s apres la coupe de
    // la video : ce reliquat se termine pendant le fondu suivant, comme dans la
    // reference. On ne descend donc pas sous la duree mesuree.
    minDuration: 2.4,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      const collapse = 1 - (1 - COMET_DOT) * easings.easeOutQuint(clamp(t / 0.55))
      const regrow = easings.easeOutQuint(clamp((t - 1.85) / 0.6))
      const fade = clamp((t - 0.15) / 0.25) * clamp((1.95 - t) / 0.3)
      return base({
        // Le point derive de 0.035 vers le bas puis remonte (wobble mesure).
        sil: circle(collapse + (1 - collapse) * regrow, {
          cy: Math.sin(clamp(t / 1.7) * Math.PI) * 0.035
        }),
        eyeAlpha: clamp((t - 2) / 0.35),
        arcs: COMET_RIBBONS.map((s, i) => ({ id: `cm${i}`, seed: s, t, opacity: fade }))
      })
    }
  }
]

const STATE_BY_ID = new Map(STATES.map((s) => [s.id, s]))

/** Ordre de lecture de la sequence complete, calque sur la video de reference. */
/**
 * Date, en temps local, ou chaque etat est le plus lisible : c'est la pose que
 * montrent les vignettes et la planche. Rendu deterministe, donc comparable
 * d'une execution a l'autre. Le type force a couvrir tout nouvel etat.
 */
const POSES                          = {
  idle: 1,
  thinking: 1.1,
  wink: 0.8,
  wide: 0.8,
  alert: 0.75,
  notify: 0.9,
  exclaim: 0.8,
  sleep: 0.45,
  egg: 0.8,
  hexagon: 0.8,
  play: 0.9,
  orbit: 1.2,
  swirl: 0.5,
  burst: 0.45,
  comet: 1.15
}

const SEQUENCE            = [
  'idle',
  'thinking',
  'wink',
  'wide',
  'alert',
  'notify',
  'exclaim',
  'sleep',
  'egg',
  'hexagon',
  'play',
  'orbit',
  'burst',
  'comet'
]

return { STATES, STATE_BY_ID, POSES, SEQUENCE };
})();

// ---- bot/eyefit.ts
__m["bot/eyefit"] = (() => {
/**
 * Ou poser le visage sur une forme du personnalisateur.
 *
 * Les yeux vivent sur une sphere, et `radiusAtAngle` les recolle au contour reel au
 * prorata du rayon local. Ce prorata place bien leur CENTRE, mais l'oeil a une taille :
 * la marge qui lui reste devant le bord est multipliee par le meme facteur, donc une
 * silhouette etroite dans sa direction le pousse contre le bord jusqu'a ce que le
 * masque l'ouvre vers l'exterieur. La gelule apparaissait comme une encoche dans le
 * corps sur `capsule`, `triangle`, `nuage` et `goutte`.
 *
 * Ce module resout le probleme UNE FOIS, au chargement, et rend une table de decalages.
 * Ce choix est l'essentiel du correctif, bien plus que la geometrie qui suit :
 *
 * Resolue dans la boucle de rendu, la correction reagit a tout ce qui bouge a soixante
 * images par seconde — la derive du regard, le pointeur, l'expression en cours de
 * morph, le bord le plus proche qui change, l'oeil le plus contraint qui change. Sept
 * variantes ont ete ecrites ainsi et toutes produisaient un artefact de mouvement
 * visible : tremblement permanent, saut de direction de 26 unites quand le bord de
 * reference basculait, grossissement brusque quand la taille entrait dans le calcul.
 * Le defaut n'etait dans aucune de leurs geometries, il etait dans le fait de resoudre
 * par image.
 *
 * Le reste du moteur ne travaille pas comme ca : les poses sont DECLAREES et il ne fait
 * que les interpoler avec des courbes connues. Un decalage tabule rentre dans ce moule.
 * Il ne bouge pas quand le regard derive ni quand le pointeur bouge, et sur un changement
 * de forme ou d'expression il ne fait qu'aller d'une entree de table a l'autre, sur la
 * courbe de ce morph. Le tremblement devient impossible par construction, au lieu d'etre
 * repousse : interpoler entre deux constantes est monotone, alors que re-resoudre le
 * probleme sur un regard en cours d'interpolation ne l'est pas.
 *
 * Corollaire agreable : le solveur n'a plus aucune contrainte de continuite, puisqu'il ne
 * tourne pas pendant l'animation. Il peut donc sonder tout un faisceau de directions et
 * couvrir le pire cas de la derive du regard, ce qu'une version par image ne pouvait pas
 * se permettre.
 *
 * La table est une constante de module, batie a l'import a partir de donnees pures :
 * meme nature que le calendrier de clignements de `face.ts`, deterministe et sans etat,
 * donc sans effet sur la purete de `engine.sample(t)`.
 */

const { EXPRESSIONS } = __m["bot/expressions"];const { eyePoses } = __m["bot/face"];const { radiusAtAngle, toPoints } = __m["bot/shape"];const { SHAPES } = __m["bot/skins"];const { STATES } = __m["bot/states"];/** Rayon de reference du solveur. Le decalage rendu est en unites de ce rayon. */
const R = 100

/**
 * Amplitudes maximales de la vie au repos, lues sur `liveliness` : `loopNoise` est
 * borne a 1 en valeur absolue, donc ces sommes sont des bornes exactes et non des
 * estimations.
 *
 * Il faut les couvrir, sinon la correction est juste sur la pose nominale et fausse une
 * seconde plus tard : 7 degres de lacet deplacent l'oeil d'une douzaine d'unites sur une
 * boule de rayon 100. C'est precisement ce qui faisait deborder `capsule` + `effraye`
 * alors qu'une mesure a un seul instant le declarait bon.
 */
const DERIVE_YAW = 5.5 + 1.6
const DERIVE_PITCH = 4.2 + 1.3
/** Flottement du centre, en unites de rayon de boule. */
const DERIVE_X = 0.006
const DERIVE_Y = 0.007

/** Le visage d'une pose, ce dont le solveur a besoin pour placer ses gelules. */
                  
                    
               
                    
 

/**
 * Une gelule prete a etre mesuree : le segment de son axe, et de quoi calculer le rayon
 * a degager DANS UNE DIRECTION donnee.
 *
 * Une gelule est exactement un segment epaissi d'un disque de rayon `r`. Son image par la
 * matrice tangente est donc un segment epaissi d'une ELLIPSE, et le rayon a degager
 * depend de la direction : c'est la fonction d'appui de cette ellipse, `r * |A^T u|`.
 *
 * Prendre a la place sa plus grande valeur singuliere serait conservateur mais faux dans
 * la seule direction qui compte, et ca se paie cher : la marge de reference sur le cercle
 * ressortait NEGATIVE, donc la demande devenait sans dents et 34 combinaisons
 * continuaient de deborder.
 */
                     
                                     
           
           
                              
            
            
                                                    
           
                                                                  
                                     
 

/**
 * Empreintes des deux yeux d'un visage, posees sur un profil.
 *
 * Une gelule est exactement un segment epaissi d'un disque de rayon `r`. Son image par
 * la matrice tangente est donc un segment epaissi d'une ELLIPSE, et un disque du rayon
 * de son grand axe la couvre : d'ou la plus grande valeur singuliere. La mesure reste
 * ainsi conservatrice au sens strict, une marge positive garantissant que la gelule est
 * dedans.
 *
 * Le clignement n'y est pas : un oeil ferme n'a pas besoin qu'on lui fasse de la place.
 */
function empreintes(visage        , sil             , radii          )              {
  const out              = []
  const poses = eyePoses(visage.gaze, R, visage.split)
  for (let i = 0; i < 2; i++) {
    const e = poses[i] 
    if (e.depth <= 0.02) continue
    const cfg = visage.eyes[i] 
    const phi = ((cfg.tilt ?? 0) * Math.PI) / 180
    const cp = Math.cos(phi)
    const sp = Math.sin(phi)
    const ax = e.a * cp + e.c * sp
    const ay = e.b * cp + e.d * sp
    const cx = -e.a * sp + e.c * cp
    const cy = -e.b * sp + e.d * cp

    const hw = Math.max(cfg.w * R, 0.01) / 2
    const hh = Math.max(cfg.h * R, 0.01) / 2
    const r = Math.min(hw, hh)
    // l'axe est celui de la plus grande dimension
    const long = hh > hw
    const demi = long ? hh - r : hw - r
    // le prorata du rayon local, exactement comme le fait le moteur
    const fit = radiusAtAngle(radii, Math.atan2(e.y, e.x) - sil.rot)
    out.push({
      x: e.x * fit,
      y: e.y * fit,
      ax: (long ? cx : ax) * demi,
      ay: (long ? cy : ay) * demi,
      r,
      m: [ax, ay, cx, cy]
    })
  }
  return out
}

/**
 * Approche la plus courte entre un contour et un segment : la distance, et le vecteur
 * qui va du contour vers le segment — le sens qui degage.
 *
 * Les deux sortent de la MEME passe. Les calculer separement doublait le seul vrai cout
 * de ce module, qui est ce balayage.
 */
function approche(pts         , x0        , y0        , x1        , y1        ) {
  const sx = x1 - x0
  const sy = y1 - y0
  const len2 = sx * sx + sy * sy
  let best = Infinity
  let vx = 0
  let vy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i] 
    let t = len2 > 0 ? ((p.x - x0) * sx + (p.y - y0) * sy) / len2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const ex = x0 + t * sx - p.x
    const ey = y0 + t * sy - p.y
    const d2 = ex * ex + ey * ey
    if (d2 < best) {
      best = d2
      vx = ex
      vy = ey
    }
  }
  const d = Math.sqrt(best)
  return { d, ux: d > 1e-9 ? vx / d : 0, uy: d > 1e-9 ? vy / d : 0 }
}

/** Une epreuve : des gelules a faire tenir dans un contour, et le contour de reference. */
                   
                         
                        
                  
                     
 

/**
 * Flottement du centre au repos, en unites de viewBox. Il est ajoute au rayon de la
 * gelule : moins d'une unite, donc l'absorber ainsi coute moins cher que de multiplier les
 * epreuves par ses quatre coins.
 */
const FLOTTEMENT = Math.hypot(DERIVE_X, DERIVE_Y) * R

/** Marge de la gelule la plus serree, et le sens qui la degage. */
function pire(pts         , emps             , tx        , ty        ) {
  let marge = Infinity
  let ux = 0
  let uy = 0
  for (const e of emps) {
    const x = e.x + tx
    const y = e.y + ty
    const a = approche(pts, x - e.ax, y - e.ay, x + e.ax, y + e.ay)
    // fonction d'appui de l'ellipse dans la direction de l'approche
    const [m0, m1, m2, m3] = e.m
    const rayon =
      e.r * Math.hypot(m0 * a.ux + m1 * a.uy, m2 * a.ux + m3 * a.uy) + FLOTTEMENT
    if (a.d - rayon < marge) {
      marge = a.d - rayon
      ux = a.ux
      uy = a.uy
    }
  }
  return { marge, ux, uy }
}

/**
 * Directions sondees et pas de la dichotomie. Le produit des deux est le cout de
 * construction de la table, seul chiffre a surveiller ici.
 */
const DIRECTIONS = 12
const DICHOTOMIE = 8

/**
 * Le decalage a poser sur les deux yeux pour cette forme, cet etat et cette expression.
 *
 * Une TRANSLATION commune aux deux yeux, donc une isometrie : ecart entre les yeux,
 * tailles et inclinaisons sont conserves au pixel. Le visage est seulement pose un peu
 * plus bas sur un corps qui n'a pas de place en haut, ce qui est le geste qu'on ferait a
 * la main. Les variantes qui bornaient chaque oeil separement ecartaient la paire, et
 * celles qui mettaient le visage a l'echelle rapetissaient les yeux — visiblement.
 *
 * La marge visee est celle du profil D'ORIGINE, pas un degagement strict : sur le cercle
 * l'oeil exterieur frole deja le bord, 17,3 unites pour une boule de rayon 100, et c'est
 * voulu, c'est ce qui donne le volume. Elle est plafonnee par ce que la forme offre en son
 * centre, sinon la demande est intenable sur un corps plat.
 *
 * RECHERCHE DIRECTIONNELLE et non descente. On cherche la translation de plus petite
 * norme qui tient, donc on sonde une couronne de directions et on dichotomie la distance
 * le long de chacune. Une descente de gradient a ete ecrite d'abord et elle ne converge
 * pas : degager la paire d'un bord la rapproche de l'autre, si bien qu'elle tatonne et ne
 * fait que garder son meilleur essai — passer ses tours de 40 a 18 suffisait a faire
 * reapparaitre 34 debordements. Ici le resultat ne depend pas d'une convergence : chaque
 * direction est resolue exactement, au pas de dichotomie pres.
 */
function resous(epreuves           )                           {
  if (!epreuves.length) return { x: 0, y: 0 }

  /** La marge la plus serree sur toutes les epreuves, pour une translation donnee. */
  const marge = (tx        , ty        ) => {
    let m = Infinity
    for (const ep of epreuves) m = Math.min(m, pire(ep.contour, ep.empreintes, tx, ty).marge)
    return m
  }

  // Marge exigee : la plus serree que le profil d'origine tolere, sur toutes les
  // epreuves. Puis plafonnee par le plus degage que la forme puisse offrir a la paire,
  // son centre.
  let requis = Infinity
  for (const ep of epreuves) {
    requis = Math.min(requis, pire(ep.calContour, ep.reference, 0, 0).marge)
  }
  /*
   * La course doit pouvoir atteindre le centre du corps : `wide` a des gelules de 87
   * unites de long, et sur un triangle elles ne tiennent que vers le milieu, a une
   * cinquantaine d'unites de leur place nominale. Une course fixe les laissait dehors.
   */
  let mx = 0
  let my = 0
  const emps = epreuves[0] .empreintes
  for (const e of emps) {
    mx -= e.x / emps.length
    my -= e.y / emps.length
  }
  const course = Math.max(0.35 * R, Math.hypot(mx, my) * 1.25)

  // Plafond de la demande : ce que la forme offre en son centre, toujours atteignable.
  requis = Math.min(requis, marge(mx, my))

  /*
   * Deja bon : le cas du cercle, et de toute forme assez large. La gelule doit RENTRER
   * en plus de n'etre pas plus serree que sur le profil d'origine — sans cette seconde
   * condition, une forme ou rien ne rentre satisfait la premiere de facon degeneree et
   * on abandonnait. `wide` a des gelules de 87 unites de long, `notify` de 50 de
   * diametre : sur un triangle ou une goutte elles debordent quoi qu'on fasse, et il
   * faut alors viser le moins pire, pas renoncer.
   */
  const depart = marge(0, 0)
  if (depart >= requis && depart >= 0) return { x: 0, y: 0 }
  const cible = Math.max(requis, 0)

  let meilleurX = 0
  let meilleurY = 0
  let meilleureNorme = Infinity
  // repli quand rien ne rentre : la translation qui degage le plus, sondee au passage
  let secoursX = 0
  let secoursY = 0
  let secours = depart

  for (let d = 0; d < DIRECTIONS; d++) {
    const a = (d / DIRECTIONS) * Math.PI * 2
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    if (marge(ux * course, uy * course) < cible) {
      // cette direction ne mene nulle part ; on garde quand meme le meilleur degagement
      // pas de solution par la, mais peut-etre un meilleur degagement
      for (const k of [0.3, 0.6, 1]) {
        const m = marge(ux * course * k, uy * course * k)
        if (m > secours) {
          secours = m
          secoursX = ux * course * k
          secoursY = uy * course * k
        }
      }
      continue
    }
    // la plus courte distance qui tient, le long de cette direction
    let bas = 0
    let haut = course
    for (let i = 0; i < DICHOTOMIE; i++) {
      const mid = (bas + haut) / 2
      if (marge(ux * mid, uy * mid) >= cible) haut = mid
      else bas = mid
    }
    if (haut < meilleureNorme) {
      meilleureNorme = haut
      meilleurX = ux * haut
      meilleurY = uy * haut
    }
  }

  const x = meilleureNorme === Infinity ? secoursX : meilleurX
  const y = meilleureNorme === Infinity ? secoursY : meilleurY
  // rendu en unites de RAYON DE BOULE : le moteur le remet a son echelle
  return { x: +(x / R).toFixed(6), y: +(y / R).toFixed(6) }
}

/**
 * Le visage a couvrir : celui de l'expression si l'etat l'accepte, le sien sinon.
 *
 * UNE entree de table par expression, et non un pire cas commun a toutes. Un pire cas
 * paraissait plus sur — un decalage constant ne peut pas bouger quand l'expression change
 * — mais il est intenable : sur une capsule, `neutre` a les yeux hauts et demande a
 * descendre quand `effraye` les a bas et demande a monter. Aucune translation unique ne
 * satisfait les deux, et la mesure le confirme (4 debordements de 4,8 unites).
 *
 * Une entree par expression n'est pas moins fluide pour autant : le moteur interpole
 * entre DEUX CONSTANTES, ce qui est monotone par construction. Ce qui tremblait, c'etait
 * de re-resoudre le probleme sur un regard en cours d'interpolation.
 */
function visageDe(def          , pose      , expr                      )         {
  if (def.baseFace && expr) return { gaze: expr.gaze, split: expr.split, eyes: expr.eyes }
  return { gaze: pose.gaze, split: pose.split, eyes: pose.eyes }
}

/** Les dates a echantillonner dans un etat : une seule si sa pose ne bouge pas. */
function dates(def          )           {
  /** Tout ce dont le solveur se sert : si rien ne bouge, une date suffit. */
  const signature = (p      ) =>
    JSON.stringify([p.gaze, p.split, p.eyes, p.sil.rot, p.sil.cx, p.sil.cy, p.sil.sx, p.sil.sy])
  if (signature(def.pose(0)) === signature(def.pose(def.duration))) return [0]
  const n = 3
  return Array.from({ length: n }, (_, i) => (i / (n - 1)) * def.duration)
}

/** Le decalage d'une forme sur un etat et une expression, derive comprise. */
function decalagePour(
  def          ,
  radii          ,
  expr                      
)                           {
  const epreuves            = []
  for (const t of dates(def)) {
    const pose = def.pose(t)
    const contour = toPoints({ ...pose.sil, radii }, R)
    const calContour = toPoints(pose.sil, R)
    const v = visageDe(def, pose, expr)
    // Les quatre coins de la derive bornent la pose nominale, qui est leur centre : la
    // tester en plus ne changerait aucune marge et coute une epreuve sur cinq.
    const coins           = []
    for (const dy of [-DERIVE_YAW, DERIVE_YAW]) {
      for (const dp of [-DERIVE_PITCH, DERIVE_PITCH]) {
        coins.push({
          ...v,
          gaze: { yaw: v.gaze.yaw + dy, pitch: v.gaze.pitch + dp, roll: v.gaze.roll }
        })
      }
    }
    for (const c of coins) {
      epreuves.push({
        empreintes: empreintes(c, pose.sil, radii),
        reference: empreintes(c, pose.sil, pose.sil.radii),
        contour,
        calContour
      })
    }
  }
  return resous(epreuves)
}

/** Zero, la valeur commune a tout ce qui n'a rien a corriger. */
const NUL = { x: 0, y: 0 }         

/** Clef d'une entree : l'etat, et l'expression quand l'etat l'accepte. */
const clef = (state         , expr               ) => `${state}|${expr ?? ''}`

/**
 * Table des decalages, batie a l'import : une entree par (forme, etat a corps de base,
 * expression). Seuls `idle` et `swirl` portent le visage de repos, donc seuls eux se
 * declinent par expression — les trois autres etats a corps de base ont un visage releve
 * sur la video et une seule entree.
 *
 * Clef par REFERENCE du tableau de rayons, ce qui est deja la convention du moteur : ses
 * gardes `radii === this.shape` et `expression === this.expr` reposent sur la meme
 * stabilite. Un profil inconnu, ou `null`, ne corrige rien — l'API accepte n'importe quel
 * tableau et le moteur n'a pas a dependre de la prudence de ses appelants.
 */
function batir()                                                       {
  return new Map(
  SHAPES.map((forme) => {
    const par = new Map                                  ()
    for (const def of STATES) {
      if (!def.baseBody) continue
      const expressions = def.baseFace ? [null, ...EXPRESSIONS] : [null]
      for (const expr of expressions) {
        par.set(clef(def.id, expr?.id ?? null), decalagePour(def, forme.radii, expr))
      }
    }
    return [forme.radii, par]
  })
  )
}

const DECALAGES = batir()

/**
 * Decalage a appliquer aux deux yeux pour cette forme sur cet etat, en unites de rayon
 * de boule — le moteur le remet a son echelle.
 *
 * Vaut zero des que la forme n'est pas au catalogue, ce qui couvre `null` et le cercle :
 * sur le cercle les deux profils sont le meme, donc la marge est deja celle exigee et la
 * descente sort au premier tour. La forme relevee sur la video ne bouge donc pas, sans
 * cas particulier.
 */
function decalageDesYeux(
  radii                 ,
  state         ,
  expr               
)                           {
  if (!radii) return NUL
  const par = DECALAGES.get(radii)
  if (!par) return NUL
  // un etat sans visage de repos n'a qu'une entree, quelle que soit l'expression
  return par.get(clef(state, expr)) ?? par.get(clef(state, null)) ?? NUL
}

/** Pour les tests : de quoi verifier la table sans refaire la geometrie. */
/** Pour les tests : de quoi chronometrer la construction de la table. */
const POUR_TESTS = { batir }

return { decalageDesYeux, POUR_TESTS };
})();

// ---- bot/engine.ts
__m["bot/engine"] = (() => {
const { arcRender } = __m["bot/decor"];const { blendExpression } = __m["bot/expressions"];const { decalageDesYeux } = __m["bot/eyefit"];const { blinkScale, eyePoses, liveliness } = __m["bot/face"];const { clamp, easings, lerp, r2 } = __m["bot/math"];const { blend, capsulePath, closedPath, radiusAtAngle, toPoints } = __m["bot/shape"];const { STATE_BY_ID } = __m["bot/states"];/**
 * Ou le bot porte son regard quand quelque chose d'exterieur le pilote — le
 * pointeur de la souris, aujourd'hui.
 *
 * `yaw` et `pitch` sont des directions ABSOLUES, qui remplacent celles de la pose
 * a mesure que `mix` monte. Deux raisons, chacune un piege deja tombe :
 *
 * - c'est le MOTEUR qui doit faire ce melange, pas l'appelant, parce que lui seul
 *   connait la pose A CET INSTANT. Un appelant qui compenserait l'orientation de
 *   l'expression lirait sa valeur d'arrivee pendant que le morph est encore en
 *   cours, et les yeux sautaient a chaque changement d'humeur ;
 * - et il faut que ce soit absolu sur les DEUX axes. En relatif, la hauteur des
 *   yeux suivait celle de chaque expression — « neutre » regarde a +28,6deg quand
 *   les autres sont entre -9 et +9 — donc les yeux tombaient d'un coup au premier
 *   changement d'humeur. Ce qui fait le caractere d'une expression pendant le
 *   suivi, c'est la FORME de ses yeux (plisses, ronds, dissymetriques), pas
 *   l'endroit ou elle regarde : celui-la, c'est le curseur qui le decide.
 *
 * `mix` dit a quel point l'exterieur commande la DIRECTION (0 = pas du tout).
 *
 * `wander` dit, separement, ce qui reste de derive automatique. Les deux ne se
 * confondent pas : quand le pointeur bouge, la derive doit s'eteindre — cumulees,
 * le bot aurait l'air de chercher le curseur sans jamais le tenir. Mais quand il
 * n'y a PAS de pointeur (arrivee au clavier, au tactile, ou souris sortie de la
 * fenetre), la tete doit rester tournee ET continuer de vivre. Les confondre
 * figeait le regard des que la vue s'ouvrait.
 *
 * `spin` est un tour a parcourir EN CHEMIN, en degres, qu'on fait fondre vers 0
 * avec l'arrivee. Comme les yeux vivent sur une sphere, un tour les fait passer
 * derriere la boule et revenir de l'autre cote — et `-360deg` etant le meme
 * angle que `0`, il ne change rien a l'endroit ou ils se posent.
 */
                       
             
               
             
              
                
 

const NO_LOOK       = { yaw: 0, pitch: 0, mix: 0, spin: 0, wander: 1 }

const lerpLook = (a      , b      , t        )       => ({
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  mix: lerp(a.mix, b.mix, t),
  spin: lerp(a.spin, b.spin, t),
  wander: lerp(a.wander, b.wander, t)
})

const lerpEye = (a                      , b                      , t        ) => ({
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  open: lerp(a.open, b.open, t),
  tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t)
})

/** Interpolation de deux poses. Le decor se croise en opacite, pas en geometrie. */
function blendPose(a      , b      , t        )       {
  const out = 1 - t
  return {
    sil: blend(a.sil, b.sil, t),
    offX: lerp(a.offX, b.offX, t),
    offY: lerp(a.offY, b.offY, t),
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t)
    },
    split: lerp(a.split, b.split, t),
    eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
    eyeAlpha: lerp(a.eyeAlpha, b.eyeAlpha, t),
    bodyAlpha: lerp(a.bodyAlpha, b.bodyAlpha, t),
    dots: [
      ...a.dots.map((d) => ({ ...d, opacity: d.opacity * out })),
      ...b.dots.map((d) => ({ ...d, opacity: d.opacity * t }))
    ],
    arcs: [
      ...a.arcs.map((r) => ({ ...r, id: `a${r.id}`, opacity: r.opacity * out })),
      ...b.arcs.map((r) => ({ ...r, id: `b${r.id}`, opacity: r.opacity * t }))
    ],
    // la pastille appartient a un seul des deux etats, elle ne se melange pas
    notif: t < 0.5 ? a.notif : b.notif,
    dotsBehind: t < 0.5 ? a.dotsBehind : b.dotsBehind
  }
}

/**
 * Moteur sans horloge : `sample(t)` est une fonction pure du temps.
 *
 * Consequence pratique : pause, reprise, ralenti et saut a une date arbitraire
 * donnent exactement la meme image, et le rendu est testable sans DOM.
 */
class BotEngine {
  /** rayon de la boule au repos, en unites de viewBox */
           scale        

          cur         
          prev                 = null
  /**
   * Pose de depart FIGEE, posee seulement quand un changement d'etat arrive alors qu'un
   * fondu est deja en cours. Cf. `setState`.
   */
          departFige              = null
          tCur = 0
          tPrev = 0
          blinkAt = -10
          pts          = []
          shape                  = null
          shapePrev                  = null
          shapeAt = -10
          expr                       = null
          exprPrev                       = null
          exprAt = -10
          look       = NO_LOOK
          lookPrev       = NO_LOOK
          lookAt = -10
  /** duree de rattrapage en cours ; voir `LOOK_MORPH`, sa valeur par defaut */
          lookMorph = 0.24

  /** duree du morph quand on change la forme du corps */
  static          SHAPE_MORPH = 0.45

  /**
   * Duree de rattrapage du regard vers la cible. Plus court que `SHAPE_MORPH` :
   * un regard qui suit doit paraitre attentif, pas visqueux. Comme la cible est
   * reposee a chaque mouvement de souris, c'est cette duree qui donne au suivi
   * son inertie — le regard n'atteint jamais tout a fait un curseur qui bouge.
   */
  static          LOOK_MORPH = 0.24

  constructor(
    scale = 100,
    initial          = 'idle',
    shape                  = null,
    expression                       = null
  ) {
    this.scale = scale
    this.cur = initial
    this.shape = shape
    this.expr = expression
  }

  /**
   * Expression de repos choisie dans le personnalisateur. Comme la forme, elle
   * glisse vers la nouvelle valeur au lieu de sauter.
   */
  setExpression(expression                      , now = 0) {
    if (expression === this.expr) return
    this.exprPrev = this.expr
    this.expr = expression
    this.exprAt = now
  }

  /** Expression effective a l'instant `now`, morph en cours compris. */
          exprAtTime(now        )                       {
    const to = this.expr
    const from = this.exprPrev
    if (!to || !from) return to
    const k = (now - this.exprAt) / BotEngine.SHAPE_MORPH
    if (k >= 1) return to
    return blendExpression(from, to, easings.easeOutQuint(clamp(k)))
  }

  /**
   * Forme choisie dans le personnalisateur. Elle ne remplace le corps que sur
   * les etats au repos (`baseBody`) : sur les autres, la silhouette EST
   * l'animation et ne doit pas etre ecrasee.
   *
   * Le changement se fait en morph, pas d'un coup : comme toutes les formes sont
   * echantillonnees aux memes angles, il suffit d'interpoler les rayons.
   */
  setShape(radii                 , now = 0) {
    if (radii === this.shape) return
    this.shapePrev = this.shape
    this.shape = radii
    this.shapeAt = now
  }

  /**
   * Forme effective a l'instant `now`, morph en cours compris.
   *
   * Ne remet PAS `shapePrev` a null en fin de morph : `sample` doit rester une
   * fonction pure du temps, donc relire une date passee doit redonner l'image
   * intermediaire. On garde juste une reference de plus.
   */
          shapeAtTime(now        )                  {
    const to = this.shape
    const from = this.shapePrev
    if (!to || !from) return to
    const k = (now - this.shapeAt) / BotEngine.SHAPE_MORPH
    if (k >= 1) return to
    const t = easings.easeOutQuint(clamp(k))
    // alloue seulement pendant le morph ; hors morph on rend le tableau tel quel
    return to.map((r, i) => lerp(from[i] ?? r, r, t))
  }

  /**
   * Nouvelle cible de regard, `null` pour revenir a celui de l'etat.
   *
   * Elle repart de la valeur COURANTE, et non de la cible precedente comme
   * `setShape` : cette methode est appelee a chaque mouvement de pointeur, et
   * repartir de l'ancienne cible ferait reculer le regard d'un cran avant
   * chaque rattrapage — le suivi tremblerait au lieu de glisser.
   *
   * Meme contrat que `setShape` par ailleurs : l'etat externe entre par un
   * setter horodate, jamais par une variable lue pendant `sample`, sinon le
   * moteur cesse d'etre une fonction pure du temps.
   */
  setLook(look             , now        , morph = BotEngine.LOOK_MORPH) {
    /*
     * Une cible non finie est refusee. Le moteur GARDE la derniere : un `NaN`
     * pose une seule fois se propagerait a chaque image et le bot ne se
     * reposerait plus jamais. C'est arrive pour de vrai — un
     * `getBoundingClientRect` sur une boite de taille nulle donne `0 / 0` chez
     * l'appelant. Celui-la est corrige, mais le moteur n'a pas a dependre de la
     * prudence de ses appelants pour rester rejouable.
     */
    if (look && !Number.isFinite(look.yaw + look.pitch + look.mix + look.spin + look.wander)) {
      return
    }
    this.lookPrev = this.lookAtTime(now)
    this.look = look ?? NO_LOOK
    this.lookAt = now
    this.lookMorph = morph
  }

  /** Regard effectif a l'instant `now`, rattrapage en cours compris. */
          lookAtTime(now        )       {
    const k = (now - this.lookAt) / this.lookMorph
    if (k >= 1) return this.look
    return lerpLook(this.lookPrev, this.look, easings.easeOutQuint(clamp(k)))
  }

          posed(
    def          ,
    t        ,
    shape                 ,
    expr                      
  )       {
    let pose = def.pose(t)
    if (def.baseBody && shape) {
      // on garde la pose (rotation, decalage, squash) et on n'echange que le profil
      pose = { ...pose, sil: { ...pose.sil, radii: shape } }
    }
    if (def.baseFace && expr) {
      pose = { ...pose, gaze: expr.gaze, split: expr.split, eyes: expr.eyes }
    }
    return pose
  }

  /**
   * Decalage des yeux a l'instant `now` pour un etat donne, en unites de rayon de boule.
   *
   * Il est LU dans une table et interpole, jamais recalcule : `eyefit.ts` explique
   * pourquoi cette distinction est tout le correctif. Ici il ne reste qu'a l'interpoler
   * sur l'axe de la forme, avec exactement la courbe et la duree du morph de silhouette
   * — c'est la meme cause, donc ce doit etre le meme mouvement.
   *
   * On interroge la table sur les BORNES du morph (`shapePrev` et `shape`) et non sur le
   * profil que rend `shapeAtTime` : celui-la est un tableau neuf alloue a chaque image,
   * donc sans identite, et il n'existe dans aucune table.
   */
          decalageAtTime(now        , state         )                           {
    /**
     * Un axe de morph : on lit la table sur ses deux BORNES et on interpole avec sa
     * courbe. Jamais sur la valeur interpolee — celle-la n'a pas d'identite et n'existe
     * dans aucune table, et c'est en la lui donnant a manger que les versions
     * precedentes tremblaient.
     */
    const surAxe = (
      debut        ,
      duree        ,
      a                          ,
      b                          
    ) => {
      if (a === b) return b
      const k = (now - debut) / duree
      if (k >= 1) return b
      const t = easings.easeOutQuint(clamp(k))
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
    }

    // axe de l'expression, pour chacune des deux formes en presence
    const parForme = (radii                 ) =>
      surAxe(
        this.exprAt,
        BotEngine.SHAPE_MORPH,
        decalageDesYeux(radii, state, this.exprPrev?.id ?? null),
        decalageDesYeux(radii, state, this.expr?.id ?? null)
      )

    // puis axe de la forme
    return surAxe(
      this.shapeAt,
      BotEngine.SHAPE_MORPH,
      parForme(this.shapePrev),
      parForme(this.shape)
    )
  }

  get state()          {
    return this.cur
  }

  /**
   * Repart sur `id` SANS etat precedent, comme un moteur neuf pose sur cet etat.
   *
   * C'est ce que veut dire « rembobiner » pour ce moteur. `setState` seul ne peut pas le
   * faire : il garde l'etat quitte pour le fondre, ce qui est exactement son role en
   * lecture, et exactement ce qu'il ne faut pas quand on revient au debut d'une sequence.
   * Rejouer l'image 0 apres une passe complete melangeait le premier etat avec le DERNIER,
   * et l'export GIF s'ouvrait sur une boule sans yeux — la comete a un `eyeAlpha` nul.
   *
   * `sample` reste une fonction pure du temps : comme `setState`, ceci est un setter DATE,
   * appele par le pilote de la sequence, jamais pendant un echantillonnage.
   */
  reset(id         , now        ) {
    this.cur = id
    this.prev = null
    this.departFige = null
    this.tCur = now
    this.tPrev = now
    this.blinkAt = -10
  }

  /**
   * Origine du fondu en cours : la pose figee s'il y en a une, sinon l'etat quitte evalue
   * a son propre temps ecoule — donc encore en train de s'animer, ce qui est voulu.
   */
          origine(
    now        ,
    shape                 ,
    expr                      
  )              {
    if (this.departFige) return this.departFige
    if (!this.prev) return null
    const prevDef = STATE_BY_ID.get(this.prev) 
    return this.posed(prevDef, Math.max(0, now - this.tPrev), shape, expr)
  }

  /**
   * Pose composite a l'instant `now`, fondu en cours compris : exactement ce que `sample`
   * melange, avant la couche de vie au repos et de regard. Extraite pour que `setState`
   * puisse la figer.
   */
          poseComposee(now        )       {
    const def = STATE_BY_ID.get(this.cur) 
    const shape = this.shapeAtTime(now)
    const expr = this.exprAtTime(now)
    const pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr)
    const since = now - this.tCur
    if (since >= def.morph) return pose
    const origine = this.origine(now, shape, expr)
    if (!origine) return pose
    return blendPose(origine, pose, easings.easeOutQuint(clamp(since / def.morph)))
  }

  /**
   * Changement d'etat, date.
   *
   * Le moteur ne garde qu'UNE case d'historique, donc un changement qui arrive pendant un
   * fondu remplacait l'origine du melange par la pose PLEINE de l'etat qu'on quittait, au
   * lieu de l'image partiellement melangee qui etait a l'ecran. Mesure sur
   * `idle -> wide -> idle` a 100 ms : 35,9 px de saut contre 8,0 px de mouvement normal.
   *
   * On fige donc la pose composite courante et on melange depuis elle. Continu par
   * construction, quel que soit le nombre de changements enchaines.
   *
   * Et SEULEMENT dans ce cas. Figer a chaque changement arreterait net l'animation de
   * l'etat qu'on quitte pendant tout le fondu — le « ! » d'`alert` se figerait en pleine
   * course — alors qu'il n'y a rien a corriger hors morph : l'etat quitte y est deja
   * exactement l'image affichee. La lecture d'un montage, dont les blocs durent au moins
   * le plus long fondu (`MIN_BLOCK`), ne fige donc jamais rien et rend au bit ce qu'elle
   * rendait.
   */
  setState(id         , now        ) {
    if (id === this.cur) return
    const morph = STATE_BY_ID.get(this.cur) .morph
    const enPleinFondu = this.prev !== null && now - this.tCur < morph
    this.departFige = enPleinFondu ? this.poseComposee(now) : null
    this.prev = this.cur
    this.tPrev = this.tCur
    this.cur = id
    this.tCur = now
    // Dans la video, chaque changement de forme est masque par un clignement.
    if (STATE_BY_ID.get(id)?.blinkIn) this.blinkAt = now
  }

  sample(now        )           {
    const R = this.scale
    const def = STATE_BY_ID.get(this.cur) 
    const shape = this.shapeAtTime(now)
    const expr = this.exprAtTime(now)
    let pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr)
    let decalage = this.decalageAtTime(now, this.cur)

    // --- transition -------------------------------------------------------
    const since = now - this.tCur
    // L'etat precedent n'est jamais purge : `since < def.morph` suffit a
    // l'ignorer une fois le fondu passe, et l'oublier rendrait le moteur non
    // rejouable — relire une date d'avant la fin du fondu ne le retrouverait
    // plus. C'est l'optimisation qui parait innocente et qui casse tout.
    const origine = since < def.morph ? this.origine(now, shape, expr) : null
    if (origine) {
      // Ease-out exponentiel : c'est la courbe mesuree sur la video. Le corps
      // n'a pas d'overshoot (seuls la pastille et l'ouverture des yeux en ont).
      // Le ratio est borne : relire une date ANTERIEURE au changement d'etat
      // donnerait un ratio negatif, que l'ease-out extrapole — la silhouette
      // part alors trente fois trop loin.
      const ratio = easings.easeOutQuint(clamp(since / def.morph))
      pose = blendPose(origine, pose, ratio)
      // Le decalage des yeux suit la MEME courbe que la silhouette qui le motive. Il vient
      // de l'etat quitte, que `setState` renseigne toujours en meme temps que l'origine —
      // le test est la pour le typage, pas pour un cas reel.
      const quitte = this.prev
      if (quitte) {
        const avant = this.decalageAtTime(now, quitte)
        decalage = {
          x: lerp(avant.x, decalage.x, ratio),
          y: lerp(avant.y, decalage.y, ratio)
        }
      }
    }

    // --- vie au repos -----------------------------------------------------
    const alive = pose.eyeAlpha > 0.01
    const look = this.lookAtTime(now)
    const life = liveliness(now, { wander: alive ? look.wander : 0, blink: alive })

    const gaze = {
      // Les deux visees REMPLACENT celles de la pose au lieu de s'y ajouter (voir
      // `Look`), et le tour se retranche en chemin. La derive s'ajoute APRES le
      // melange, sinon la cible l'annulerait en meme temps que la pose — or elle
      // doit survivre a une tete tournee sans pointeur.
      yaw: lerp(pose.gaze.yaw, look.yaw, look.mix) + life.dYaw - look.spin,
      pitch: lerp(pose.gaze.pitch, look.pitch, look.mix) + life.dPitch,
      // le roulis, lui, ne suit rien : la tete du bot est penchee de -13deg dans
      // la video, et la faire rouler avec le curseur casse cette signature
      roll: pose.gaze.roll + life.dRoll
    }

    // clignement declenche par le changement d'etat, en plus du calendrier
    const forced = clamp((now - this.blinkAt) / 0.2)
    const forcedLid = forced < 1 ? Math.abs(forced * 2 - 1) : 1
    const lid = Math.min(life.lid, forcedLid)

    const offX = pose.offX + life.driftX
    const offY = pose.offY + life.driftY

    // --- corps ------------------------------------------------------------
    const sil             = {
      ...pose.sil,
      cx: pose.sil.cx + offX,
      cy: pose.sil.cy + offY,
      sy: pose.sil.sy * life.breath
    }
    const bodyPath = closedPath(toPoints(sil, R, this.pts))

    // --- yeux -------------------------------------------------------------
    // Les yeux vivent sur une sphere de rayon 1 ; des que la silhouette n'est
    // plus un cercle, on les ramene au prorata du rayon reel dans leur
    // direction, sinon ils debordent et le masque les coupe.
    const bodyRadius = (x        , y        ) =>
      radiusAtAngle(pose.sil.radii, Math.atan2(y, x) - pose.sil.rot)

    const eyes                = []
    if (pose.eyeAlpha > 0.01) {
      const poses = eyePoses(gaze, R, pose.split)
      for (let i = 0; i < 2; i++) {
        const e = poses[i] 
        if (e.depth <= 0.02) continue
        const cfg = pose.eyes[i] 
        const fit = bodyRadius(e.x, e.y)
        // Inclinaison propre de l'oeil : on compose le repere tangent avec une
        // rotation dans le plan de l'oeil (Basis x Rot). C'est ce qui permet des
        // inclinaisons en miroir entre les deux yeux.
        const phi = ((cfg.tilt ?? 0) * Math.PI) / 180
        const cp = Math.cos(phi)
        const sp = Math.sin(phi)
        const ax = e.a * cp + e.c * sp
        const ay = e.b * cp + e.d * sp
        const cx2 = -e.a * sp + e.c * cp
        const cy2 = -e.b * sp + e.d * cp
        // Le clignement s'applique APRES tout ca : c'est un ecrasement vertical
        // a l'ecran, pas le long de l'axe de la gelule.
        const k = blinkScale(Math.min(lid, cfg.open))
        eyes.push({
          d: capsulePath(cfg.w * R, cfg.h * R),
          matrix: `matrix(${r2(ax)},${r2(ay * k)},${r2(cx2)},${r2(cy2 * k)},${r2(e.x * fit + (offX + decalage.x) * R)},${r2(e.y * fit + (offY + decalage.y) * R)})`,
          alpha: pose.eyeAlpha * clamp(e.depth / 0.12)
        })
      }
    }

    // --- decor ------------------------------------------------------------
    const dots = pose.dots
      .filter((p) => p.opacity > 0.01 && p.r > 0.0005)
      .map((p) => ({ ...p, x: (p.x + offX) * R, y: (p.y + offY) * R, r: p.r * R }))

    // la pastille est posee sur le contour : elle suit donc la forme aussi
    const nFit = pose.notif ? bodyRadius(pose.notif.x, pose.notif.y) : 1
    const nx = pose.notif ? (pose.notif.x * nFit + offX) * R : 0
    const ny = pose.notif ? (pose.notif.y * nFit + offY) * R : 0
    const notif = pose.notif ? { x: nx, y: ny, r: pose.notif.r * R } : null
    const notch = pose.notif ? { x: nx, y: ny, r: pose.notif.notch * R } : null

    return {
      bodyPath,
      bodyAlpha: pose.bodyAlpha,
      eyes,
      dots,
      dotsBehind: pose.dotsBehind,
      // Les etats declarent des arcs en unites de rayon de boule ; le moteur
      // est le seul a connaitre l'echelle du viewBox, donc c'est lui qui trace.
      arcs: pose.arcs
        .filter((a) => a.opacity > 0.01)
        .map((a) => arcRender(a.seed, a.t, R, a.id, a.opacity)),
      notif,
      notch
    }
  }
}


return { BotEngine };
})();

// ---- bot/cycles.ts
__m["bot/cycles"] = (() => {
const { SEQUENCE, STATES, STATE_BY_ID } = __m["bot/states"];/**
 * Un cycle est un montage : une suite de blocs, chacun un etat tenu pendant une
 * duree choisie. C'est la partie "editeur" du dossier, et elle en garde les
 * regles — donnees pures, aucune horloge, aucun import Vue : le meme cycle doit
 * pouvoir etre relu par les tests, par le lecteur et par la timeline.
 *
 * Un bloc n'a pas d'identifiant : c'est une position dans une liste, la cle de
 * rendu est l'index. Ca garde le JSON du localStorage lisible et les tests
 * deterministes.
 */
                        
                
                  
 

                        
            
              
                 
 

/**
 * Plancher commun a tous les blocs. Le moteur ne garde qu'une case d'historique
 * (`BotEngine.setState` ecrase `prev`), donc un bloc plus court que le fondu d'entree du
 * bloc suivant saute a l'image au lieu de se fondre.
 *
 * DERIVE du catalogue et non ecrit a la main. La valeur etait 0,6, ce qui marchait
 * uniquement parce que 0,6 se trouvait etre le plus long `morph` du catalogue — celui
 * d'`orbit`. Rien ne le garantissait : ajouter un etat qui morphe en 0,8 s aurait fait
 * trembler l'editeur sans qu'aucun test ne bronche. Maintenant le plancher suit.
 */
const MIN_BLOCK = Math.max(...STATES.map((s) => s.morph))

/**
 * Garde-fou d'editeur, pas une mesure : allonger un bloc est sans risque (les
 * etats saturent leurs rampes et tiennent leur pose finale), mais une piste de
 * blocs d'une minute n'est plus lisible.
 */
const MAX_BLOCK = 10

/**
 * Combien de blocs et de montages on accepte, a l'edition comme a la relecture.
 *
 * Ce ne sont pas des limites de produit mais des bornes contre un stockage hostile, qui
 * est modifiable et tient quelques megaoctets alors que rien en aval n'est dimensionne
 * pour ca : un seul cycle de 150 000 blocs, soit environ 4 Mo de JSON, donne 1 500 000 s
 * de duree, autant de graduations a allouer et une piste de 29 700 000 px de large.
 * L'onglet figeait en entrant dans la vue Animations.
 *
 * 200 blocs font une demi-heure de montage, largement au-dela de tout usage.
 */
const MAX_BLOCS = 200
const MAX_CYCLES = 50

/** Pas de la molette et du redimensionnement, en secondes. */
const STEP = 0.1

const DEFAULT_CYCLE_ID = 'defaut'

/** Duree minimale d'un bloc : le plancher moteur, ou la mesure de l'etat. */
function minDurationOf(state         )         {
  return Math.max(MIN_BLOCK, STATE_BY_ID.get(state)?.minDuration ?? MIN_BLOCK)
}

/** Ramene une duree dans ses bornes et sur le pas, sans trainee de flottants. */
function clampDuration(state         , seconds        )         {
  const snapped = Math.round(seconds / STEP) * STEP
  const bounded = Math.min(MAX_BLOCK, Math.max(minDurationOf(state), snapped))
  return Math.round(bounded * 100) / 100
}

function makeBlock(state         )        {
  // la duree de reference est celle relevee sur la video pour cet etat
  return { state, duration: clampDuration(state, STATE_BY_ID.get(state)?.duration ?? 2) }
}

/**
 * Le montage releve sur la video : l'ordre de `SEQUENCE`, chaque etat tenu sa
 * duree mesuree. Il sert d'amorce au premier lancement, puis il appartient a
 * l'utilisateur — il s'edite et se stocke comme les autres. La reference, elle,
 * reste dans le code : vider le stockage la fait revenir.
 */
function defaultCycle()        {
  return {
    /**
     * Nom vide = « jamais nomme par l'utilisateur », donc affiche dans la langue
     * courante. Ecrire ici « Cycle par defaut » l'aurait fige : le nom part au
     * localStorage des la premiere visite et redevient une donnee utilisateur,
     * que changer de langue ne retraduirait plus.
     */
    name: '',
    id: DEFAULT_CYCLE_ID,
    blocks: SEQUENCE.map(makeBlock)
  }
}

function totalDuration(blocks         )         {
  return blocks.reduce((sum, b) => sum + b.duration, 0)
}

/** Date de debut d'un bloc dans le montage. */
function offsetOf(blocks         , index        )         {
  let acc = 0
  for (let i = 0; i < index && i < blocks.length; i++) acc += blocks[i] .duration
  return acc
}

/**
 * Bloc joue a la date `t` et temps ecoule dedans. Au-dela du dernier bloc on
 * retombe au debut : la lecture boucle. L'appelant verifie que le montage n'est
 * pas vide.
 */
function blockAt(blocks         , t        )                                     {
  const total = totalDuration(blocks)
  if (!blocks.length || total <= 0) return { index: 0, elapsed: 0 }
  // le modulo n'est applique que s'il sert : sur une date deja dans le cycle il
  // n'ajouterait qu'une trainee de flottants au temps ecoule
  const wrapped = t >= 0 && t < total ? t : ((t % total) + total) % total
  let acc = 0
  for (let i = 0; i < blocks.length; i++) {
    const end = acc + blocks[i] .duration
    if (wrapped < end) return { index: i, elapsed: wrapped - acc }
    acc = end
  }
  return { index: blocks.length - 1, elapsed: 0 }
}

/**
 * Ajoute une animation a la fin du montage (palette de droite ou carte « + »).
 *
 * Plafonnee a `MAX_BLOCS`, comme la relecture. Sans ca l'editeur laissait construire un
 * montage plus grand que ce que le stockage rend au rechargement, et le travail
 * disparaissait en silence — une borne de relecture qui n'est pas aussi une borne d'edition
 * est un piege, pas une protection.
 */
function blocksWith(blocks         , state         )          {
  if (blocks.length >= MAX_BLOCS) return blocks
  return [...blocks, makeBlock(state)]
}

/** Deplace un bloc, en rendant une nouvelle liste (les etats Vue sont remplaces). */
function moveBlock(blocks         , from        , to        )          {
  const next = blocks.slice()
  const [moved] = next.splice(from, 1)
  if (!moved) return blocks
  next.splice(Math.min(Math.max(to, 0), next.length), 0, moved)
  return next
}

/** `Mon cycle`, `Mon cycle 2`, `Mon cycle 3`... — jamais deux fois le meme nom. */
function uniqueName(base        , cycles         )         {
  const taken = new Set(cycles.map((c) => c.name))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

/** Identifiant sans collision, y compris avec un localStorage bricole a la main. */
function nextCycleId(cycles         )         {
  const taken = new Set(cycles.map((c) => c.id))
  let n = 1
  while (taken.has(`c${n}`)) n++
  return `c${n}`
}

/* ------------------------------------------------------- lecture du stockage */

function parseBlock(raw         )               {
  if (typeof raw !== 'object' || raw === null) return null
  const { state, duration } = raw                                           
  /*
   * Valide contre SEQUENCE et non contre `STATE_BY_ID` : ce dernier contient `swirl`, qui
   * est deliberement hors du catalogue — c'est la transition d'entree des reglages, un
   * test la verrouille hors de la palette et de la planche. Un montage utilisateur ne se
   * construit qu'a partir de la palette, donc un `swirl` ne peut y arriver que par un
   * stockage bricole a la main, et il n'y a aucune raison de l'y tolerer quand on l'exclut
   * partout ailleurs.
   */
  if (typeof state !== 'string' || !SEQUENCE.includes(state           )) return null
  if (typeof duration !== 'number' || !Number.isFinite(duration)) return null
  return { state: state           , duration: clampDuration(state           , duration) }
}

function parseCycle(raw         , seen         )               {
  if (typeof raw !== 'object' || raw === null) return null
  const { id, name, blocks } = raw                                                      
  if (typeof id !== 'string' || !id) return null
  // le nom peut etre vide — c'est le montage d'amorce, qui suit la langue
  if (typeof name !== 'string') return null
  if (!Array.isArray(blocks)) return null
  // on tronque AVANT de relire : valider 150 000 blocs pour n'en garder que 200 serait
  // faire le travail qu'on cherche justement a eviter
  const kept = blocks
    .slice(0, MAX_BLOCS)
    .map(parseBlock)
    .filter((b)             => b !== null)
  if (!kept.length) return null
  if (seen.some((c) => c.id === id)) return null
  return { id, name, blocks: kept }
}

/**
 * Le localStorage est modifiable a la main : on ne lui fait pas confiance, meme
 * regle que pour le hash de l'URL. Tout ce qui ne se relit pas est jete
 * silencieusement plutot que de casser l'application au demarrage.
 */
function parseCycles(raw               )          {
  if (!raw) return []
  let data         
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out          = []
  for (const item of data.slice(0, MAX_CYCLES)) {
    const cycle = parseCycle(item, out)
    if (cycle) out.push(cycle)
  }
  return out
}

return { MIN_BLOCK, MAX_BLOCK, MAX_BLOCS, MAX_CYCLES, STEP, minDurationOf, clampDuration, makeBlock, defaultCycle, totalDuration, offsetOf, blockAt, blocksWith, moveBlock, uniqueName, nextCycleId, parseCycles };
})();

// ---- bot/repere.ts
__m["bot/repere"] = (() => {
/**
 * Le repere de tout ce que le moteur rend.
 *
 * `engine.sample()` sort des coordonnees en unites de viewBox, et ces deux nombres en sont
 * la definition : sans eux, une sortie du moteur ne veut rien dire. Ils vivaient dans
 * `BloubBot.vue`, donc hors d'atteinte — un `<script setup>` n'exporte rien — et
 * `export.ts` en redisait un a la main avec le commentaire qui nommait le probleme.
 *
 * Ils sont ici parce que `src/bot/` est ce qui se lit et se consomme du dehors : le
 * composant Vue est UN client du moteur, pas sa definition.
 */

/**
 * Rayon de la boule au repos, en unites de viewBox. C'est le `scale` que le composant
 * passe a `BotEngine`.
 *
 * Choisi et non mesure : c'est l'unite de travail. Tout le reste du dossier s'exprime en
 * fractions de ce rayon, ce qui rend les mesures relevees sur la video independantes de la
 * taille d'affichage.
 */
const RAYON = 100

/**
 * Demi-cote du viewBox affiche. La marge au-dela du rayon loge les anneaux.
 *
 * Ce n'est pas une valeur libre : les anneaux de l'orbite et le swoosh de la comete montent
 * a 1,4 fois le rayon, soit 140. Rien ne les borne au runtime — c'est le reglage a la main
 * des tableaux `RINGS` et `SWOOSH` (`decor.ts`) qui les tient sous 158, et un test le
 * verrouille.
 */
const DEMI_VIEWBOX = 158

return { RAYON, DEMI_VIEWBOX };
})();

// ---- ui/gaze.ts
__m["ui/gaze"] = (() => {
                                        
                                                     
const { clamp, easings } = __m["bot/math"];/**
 * Ou le bot regarde quand il suit le curseur. Pur, comme `src/ui/timeline.ts` :
 * la position du pointeur entre en coordonnees deja normalisees, donc la regle
 * se teste sans DOM — et elle a besoin de l'etre, parce que deux signes s'y
 * trompent facilement.
 */

/**
 * Angles en degres d'orientation de tete. CHOISIS, pas releves : la video de
 * reference ne montre aucun suivi de curseur. Assez amples pour se distinguer de
 * la derive au repos (±7deg de lacet, ±5,5 de tangage), assez retenus pour
 * qu'aucun oeil ne parte derriere le limbe de la sphere.
 */
const YAW_MAX = 16
const PITCH_MAX = 13

/**
 * Hauteur a laquelle le regard se tient, curseur au centre. CHOISIE : legerement
 * au-dessus de l'equateur, ce qui donne un bot attentif plutot qu'absent.
 *
 * C'est une valeur ABSOLUE, et c'est tout le point : en relatif, la hauteur des
 * yeux suivait celle de chaque expression, et comme « neutre » regarde a
 * +28,6deg quand les humeurs sont entre -9 et +9, les yeux tombaient d'un coup
 * au premier changement d'humeur.
 */
const PITCH = 10

/**
 * Direction ou la tete se pose dans la vue des reglages : le bot cesse de regarder en haut a
 * droite (sa pose de repos) pour regarder a GAUCHE, du cote du panneau.
 *
 * Ce n'est pas un miroir de l'image : les yeux font vraiment le tour de la
 * sphere, donc ils gardent leur inclinaison en `\\` et leur compression de
 * profondeur. Retourner l'image les aurait couches en `//`.
 */
const TURN = 26

/**
 * Tour complet parcouru EN CHEMIN : les yeux ne glissent pas en travers du
 * visage, ils font le tour de la boule avant d'arriver.
 *
 * C'est gratuit parce que les yeux vivent sur une sphere : passe 90deg de lacet
 * ils franchissent le limbe, le moteur les retire de l'image, puis ils
 * reapparaissent de l'autre cote. Le tourbillon n'est donc pas un effet pose
 * par-dessus, c'est la meme projection orthographique poussee d'un tour.
 *
 * Et surtout : il ATTERRIT JUSTE par construction, `-360deg` etant le meme angle
 * que `0`. C'est ce qui le distingue d'une pose de regard ecrite dans un etat,
 * qui laisse les yeux la ou sa courbe se termine.
 */
const SPIN = 360

/**
 * Duree du tour. Un peu plus courte que le bloc d'entree (`swirl`) : les yeux
 * doivent etre poses a gauche avant que les anneaux ne s'effacent.
 */
const TURN_TIME = 1.1

/**
 * Humeurs que le bot traverse pendant qu'il suit le curseur.
 *
 * Toutes ont un ROULIS NUL, et c'est le critere de selection. Le lacet et le
 * tangage sont neutralises par le suivi (ils sont absolus), mais pas le roulis —
 * il fait pencher la tete, donc il deplace les yeux verticalement, et une humeur
 * a -15deg suivie d'une a +8 les fait sauter. Ce qui reste pour distinguer les
 * humeurs, c'est la FORME des yeux : ronds, plisses, ecarquilles, aplatis. C'est
 * largement suffisant, et c'est ce qui se lit.
 *
 * Ce n'est donc pas une liste de gouts : y ajouter « curieux » (roulis -15deg)
 * ramenerait le saut.
 */
const HUMEURS                          = [
  'surpris',
  'heureux',
  'hilare',
  'excite',
  'fier',
  'blase'
]

/* ------------------------------------------------ regards de l'arrivee */

/**
 * Un regard SCRIPTE : evalue a chaque image avec le temps ecoule depuis le debut
 * de l'arrivee, en secondes. Le script porte donc sa propre horloge et peut
 * enchainer plusieurs mouvements — le composant ne fait que l'evaluer et n'a
 * aucune duree a connaitre.
 *
 * REGLE, et c'est elle qui rend un script sans entretien : il doit FINIR a
 * `mix: 0`, ou la pose de l'etat commande seule. Il n'y a alors jamais rien a
 * relacher, et ce relachement — qui se verrait sous la forme d'un dernier
 * glissement des yeux, juste quand tout devrait etre pose — n'existe pas.
 *
 * Le type reste general alors qu'il n'y a qu'un script aujourd'hui : quatre ont
 * ete ecrits et compares cote a cote avant d'en garder un, et c'est cette forme
 * qui a permis de les essayer sans toucher au moteur.
 */
                                            

/**
 * « Le tour » : la boule a l'air de tourner sur elle-meme.
 *
 * `mix` reste a ZERO du debut a la fin : aucune direction n'est imposee, seul
 * `spin` fond, ce qui fait passer les yeux DERRIERE la boule avant de les
 * ramener exactement la ou l'expression choisie les met.
 *
 * Ease-in-OUT et non l'ease-out exponentiel du reste du projet : ce n'est pas une
 * valeur qui se pose, c'est un objet qui tourne. En ease-out, les deux tiers du
 * tour etaient avales en 0,3 s — un a-coup, pas une rotation.
 *
 * Il est VIF au passage du limbe — 20 px entre deux images sur une boule de 100
 * de rayon — et ce n'est pas un defaut de reglage : pres du bord, un petit angle
 * devient un grand deplacement a l'ecran, et l'oeil disparait puis reparait de
 * l'autre cote. Ralentir n'y change rien, c'est la trajectoire qui veut ca, et
 * c'est justement ce qui fait l'effet. Ne pas chercher a l'adoucir.
 *
 * Corollaire indispensable : ce tour ne se joue que sur un CERCLE. Les yeux sont
 * recolles au contour reel (`radiusAtAngle`), donc sur une forme non circulaire
 * ils suivent le profil en tournant et sautillent. Voir `forme` dans `App.vue`.
 */
const TOUR_TIME = 1.5

const tourLook             = (t) => ({
  yaw: 0,
  pitch: 0,
  mix: 0,
  spin: SPIN * (1 - easings.easeInOutCubic(clamp(t / TOUR_TIME))),
  wander: 1
})

                      
                                                                                
            
                                                                      
            
                                       
              
                                                                              
                  
 

/**
 * Cible de regard.
 *
 * `tour` mene tout : il fait monter l'emprise sur la pose (`mix`) et fondre le
 * tour parcouru (`spin`) en meme temps. A 0 la pose de l'etat commande seule ; a
 * 1 la tete est posee a gauche et suit le curseur.
 *
 * Rien ici ne compense l'expression affichee : c'est le moteur qui melange,
 * parce que lui seul connait la pose a l'instant t. Le faire ici obligerait a
 * lire le lacet d'ARRIVEE de l'expression pendant que le moteur, lui, morphe
 * encore — et les yeux sautaient a chaque changement d'humeur.
 */
function lookTarget({ nx, ny, tour, pointer }     )       {
  return {
    yaw: -TURN + nx * YAW_MAX,
    // tangage positif = regard vers le haut, alors que le y de l'ecran descend
    pitch: PITCH - ny * PITCH_MAX,
    mix: tour,
    spin: SPIN * (1 - tour),
    // Sans pointeur la tete reste tournee vers le panneau, mais on lui rend sa
    // derive : sinon le bot fixe un point mort, et arriver au clavier ou au
    // tactile donnait un avatar completement immobile.
    wander: pointer ? 0 : 1
  }
}

return { YAW_MAX, PITCH_MAX, PITCH, TURN, SPIN, TURN_TIME, HUMEURS, TOUR_TIME, tourLook, lookTarget };
})();

window.BloubBot = { BotEngine: __m["bot/engine"].BotEngine, STATE_BY_ID: __m["bot/states"].STATE_BY_ID, SEQUENCE: __m["bot/states"].SEQUENCE, defaultCycle: __m["bot/cycles"].defaultCycle, DEMI_VIEWBOX: __m["bot/repere"].DEMI_VIEWBOX, RAYON: __m["bot/repere"].RAYON, mixHex: __m["bot/skins"].mixHex, NOTIF_BLUE: __m["bot/decor"].NOTIF_BLUE, EXPRESSION_BY_ID: __m["bot/expressions"].EXPRESSION_BY_ID, DEFAULT_EXPRESSION: __m["bot/expressions"].DEFAULT_EXPRESSION, clamp: __m["bot/math"].clamp, easings: __m["bot/math"].easings, tourLook: __m["ui/gaze"].tourLook, TOUR_TIME: __m["ui/gaze"].TOUR_TIME, YAW_MAX: __m["ui/gaze"].YAW_MAX, PITCH_MAX: __m["ui/gaze"].PITCH_MAX };
})();
