import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ReactionBurst Component
 * 
 * Renders a burst of custom image particles that spawn in a circle and float up.
 * 
 * @param {number} x - The x coordinate of the burst center (relative to parent)
 * @param {number} y - The y coordinate of the burst center (relative to parent)
 * @param {string} imageSrc - The URL of the custom image to use for particles
 * @param {number} count - Number of particles (default: 12)
 * @param {boolean} isActive - Whether the burst is active
 * @param {function} onComplete - Callback when animation completes
 */
const ReactionBurst = ({ 
  x, 
  y, 
  imageSrc, 
  count = 8, 
  isActive, 
  onComplete 
}) => {
  // Generate particles with random angles
  const particles = React.useMemo(() => {
    if (!isActive) return [];
    
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * 2 * Math.PI; // Uniform distribution
      // Add slight randomness to radius and float distance for natural look
      const radius = 30 + Math.random() * 10; 
      const floatDistance = 40 + Math.random() * 20;
      
      return {
        id: i,
        angle,
        radius,
        floatDistance,
        // Random slight rotation for the image itself
        rotation: Math.random() * 30 - 15, 
      };
    });
  }, [isActive, count]);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isActive && (
        <div
          style={{
            position: 'fixed',
            left: x,
            top: y,
            pointerEvents: 'none', // Pass clicks through
            zIndex: 9999,
            width: 0,
            height: 0,
            overflow: 'visible'
          }}
        >
          {particles.map((particle) => (
            <motion.img
              key={particle.id}
              src={imageSrc}
              alt=""
              initial={{ 
                x: 0, 
                y: 0, 
                scale: 0, 
                opacity: 1,
                rotate: 0 
              }}
              animate={{
                x: particle.radius * Math.cos(particle.angle),
                y: (particle.radius * Math.sin(particle.angle)) - particle.floatDistance,
                scale: [0, 1.2, 0.8], // Pop effect
                opacity: [1, 1, 0],   // Fade out at the end
                rotate: particle.rotation
              }}
              transition={{
                duration: 0.8,
                ease: "easeOut",
                times: [0, 0.2, 1] // Keyframe timing
              }}
              onAnimationComplete={() => {
                // Trigger onComplete when the last particle finishes
                if (particle.id === count - 1 && onComplete) {
                  onComplete();
                }
              }}
              style={{
                position: 'absolute',
                width: '20px', // Adjust size as needed
                height: '20px',
                transformOrigin: 'center center',
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReactionBurst;
