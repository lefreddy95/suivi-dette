import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PizzaTruckAnimation — Barre de progression animée du paiement du camion pizza.
 *
 * 🎬 Effets :
 *   - Camion 🚚 qui roule de gauche à droite au fur et à mesure des paiements
 *   - Roues qui tournent en continu (animation CSS)
 *   - Fumée qui sort du pot d'échappement en continu (boucle CSS)
 *   - Pizzas 🍕 qui sortent de l'arrière du camion périodiquement
 *     (toutes les 2.5s), trajectoire en cloche vers l'arrière
 *   - Route pointillée animée (effet "moving road")
 *   - Camion démarre à 3% (juste devant la maison 🏠, sans la chevaucher)
 *   - Camion finit à 97% (juste avant l'arrivée 🏁)
 *   - Animation de vibration réaliste (translateY 1px) pendant la marche
 *
 * Props : `progressPercent` (0-100)
 */

interface PizzaTruckAnimationProps {
  progressPercent: number; // 0-100
}

const PIZZA_INTERVAL_MS = 2500; // Une pizza toutes les 2.5s
const TRUCK_START = 3;          // % à gauche (devant la maison)
const TRUCK_END = 97;          // % à droite (avant l'arrivée)

const PizzaTruckAnimation: React.FC<PizzaTruckAnimationProps> = ({ progressPercent }) => {
  // Position du camion, clampée entre TRUCK_START et TRUCK_END
  const truckX = Math.max(TRUCK_START, Math.min(TRUCK_END, progressPercent));
  // Le camion regarde vers la droite (sens de la marche)
  const truckRotation = 0; // on le dessine face à droite, pas de rotation
  // État pour les pizzas en vol (chacune a un id unique)
  const [pizzas, setPizzas] = useState<Array<{ id: number; x: number; launchedAt: number }>>([]);
  // Refs pour les valeurs qu'on lit dans le timer sans les redéclencher
  const truckXRef = useRef(truckX);
  truckXRef.current = truckX;
  const counterRef = useRef(0);

  // Émission périodique de pizzas (un seul setInterval, pas recréé à chaque render)
  useEffect(() => {
    if (progressPercent < 5) return; // pas de pizza tant qu'on a pas commencé
    const interval = setInterval(() => {
      counterRef.current += 1;
      setPizzas((prev) => [
        ...prev,
        {
          id: counterRef.current,
          x: truckXRef.current, // part de la position actuelle du camion
          launchedAt: Date.now(),
        },
      ]);
    }, PIZZA_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [progressPercent > 5]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nettoyage des vieilles pizzas (après 3s) — utilise setTimeout par pizza
  useEffect(() => {
    if (pizzas.length === 0) return;
    const timeouts = pizzas.map((p) => {
      const remaining = 3000 - (Date.now() - p.launchedAt);
      if (remaining > 0) {
        return setTimeout(() => {
          setPizzas((prev) => prev.filter((x) => x.id !== p.id));
        }, remaining);
      }
      return null;
    });
    return () => {
      timeouts.forEach((t) => t && clearTimeout(t));
    };
  }, [pizzas]);

  // Pourcentage de paiement atteint (0-1)
  const progressFraction = progressPercent / 100;
  // Y a-t-il déjà du progrès ?
  const isMoving = progressPercent > 0;

  return (
    <div className="relative w-full h-24 sm:h-28 select-none">
      {/* === ROUTE (fond) === */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-gray-300 rounded-full overflow-hidden">
        {/* Route pointillée animée (effet "ça roule") */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0, transparent 12px, #fff 12px, #fff 24px)',
            backgroundSize: '24px 100%',
            animation: isMoving ? 'pizza-road-move 0.8s linear infinite' : 'none',
          }}
        />
      </div>

      {/* === MAISON (à gauche) === */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 text-3xl sm:text-4xl z-10 select-none">
        <div className="relative">
          🏠
          {/* Petite fumée de cheminée */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs opacity-60">
            <span style={{ animation: 'pizza-smoke-rise 3s ease-in-out infinite' }}>💨</span>
          </div>
        </div>
      </div>

      {/* === ARRIVÉE (à droite) === */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 text-3xl sm:text-4xl z-10 select-none">
        <div className="relative">
          🏁
          {/* Confettis qui attendent l'arrivée */}
          {progressPercent >= 99 && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs">
              🎉
            </div>
          )}
        </div>
      </div>

      {/* === CAMION PIZZA + FUMÉE === */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 z-20"
        style={{
          left: `${truckX}%`,
          transform: `translate(-50%, -50%) rotate(${truckRotation}deg)`,
        }}
        animate={{
          y: isMoving ? [-1, 1, -1] : 0, // vibration pendant la marche
        }}
        transition={{
          duration: 0.3,
          repeat: isMoving ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        {/* Fumée qui sort (à l'arrière-gauche du camion) */}
        <div className="absolute -left-2 sm:-left-3 top-0 w-6 h-6 sm:w-8 sm:h-8 pointer-events-none">
          <span
            className="absolute text-sm sm:text-base opacity-70"
            style={{
              animation: 'pizza-truck-smoke 1.5s ease-out infinite',
              left: '0',
              top: '0',
            }}
          >
            💨
          </span>
          <span
            className="absolute text-xs sm:text-sm opacity-50"
            style={{
              animation: 'pizza-truck-smoke 1.5s ease-out infinite',
              animationDelay: '0.5s',
              left: '4px',
              top: '2px',
            }}
          >
            💨
          </span>
        </div>

        {/* Le camion emoji (avec animation de roulement interne) */}
        <div
          className="text-4xl sm:text-5xl"
          style={{
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))',
            animation: isMoving ? 'pizza-truck-bounce 0.5s ease-in-out infinite' : 'none',
            // L'emoji 🚚 de base a la cabine à gauche, on flippe pour
            // que la cabine pointe vers la droite (sens de la marche)
            transform: 'scaleX(-1)',
            userSelect: 'none',
          }}
        >
          🚚
        </div>

        {/* Badge de progression au-dessus du camion */}
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
          {Math.round(progressPercent)}%
        </div>
      </motion.div>

      {/* === PIZZAS EN VOL (qui sortent de l'arrière du camion) === */}
      <AnimatePresence>
        {pizzas.map((pizza) => (
          <motion.div
            key={pizza.id}
            className="absolute top-1/2 text-2xl sm:text-3xl pointer-events-none z-10"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
            }}
            initial={{
              x: `${pizza.x}%`,
              y: -20,
              rotate: -10,
              opacity: 0,
              scale: 0.5,
            }}
            animate={{
              // Trajectoire en cloche vers l'ARRIÈRE du camion (vers la gauche)
              x: `${Math.max(0, pizza.x - 18 - Math.random() * 8)}%`,
              y: [
                -30,         // pic en l'air
                0,           // redescend au niveau route
                8,           // petit rebond
                -5,
                20,          // disparaît en bas
              ],
              rotate: [-10, 20, -15, 25, 30],
              opacity: [0, 1, 1, 0.8, 0],
              scale: [0.5, 1, 1, 0.9, 0.7],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2.5,
              ease: [0.34, 1.56, 0.64, 1], // easeOutBack-like
              times: [0, 0.2, 0.5, 0.8, 1],
            }}
            // Le cleanup est géré par le useEffect ci-dessus (setTimeout 3s)
          >
            🍕
          </motion.div>
        ))}
      </AnimatePresence>

      {/* === Indicateur d'animation désactivée (si 0%) === */}
      {!isMoving && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-gray-500 italic">
          🚚 En attente du premier paiement pour démarrer le voyage...
        </div>
      )}
    </div>
  );
};

export default PizzaTruckAnimation;
