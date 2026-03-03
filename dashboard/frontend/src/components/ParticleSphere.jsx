import React, { useEffect, useRef } from 'react';

const ParticleSphere = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Configure canvas size
        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        // Sphere properties
        const numDots = 4000; // Increased density significantly
        // To see the complete sphere, diameter should fit in screen.
        // Expanding radius to fill out horizontal layout more dynamically
        const radius = width * 0.45;
        let particles = [];

        // Mouse properties
        let mouseX = width / 2;
        let mouseY = height / 2;
        let isMouseOver = false;

        // Generate points on a sphere using Fibonacci spiral
        for (let i = 0; i < numDots; i++) {
            const phi = Math.acos(-1 + (2 * i) / numDots);
            const theta = Math.sqrt(numDots * Math.PI) * phi;

            // Base 3D coordinates
            const x3d = radius * Math.cos(theta) * Math.sin(phi);
            const y3d = radius * Math.sin(theta) * Math.sin(phi);
            const z3d = radius * Math.cos(phi);

            particles.push({
                xRef: x3d, // Original reference x
                yRef: y3d, // Original reference y
                zRef: z3d, // Original reference z
                x: x3d,    // Current visual x
                y: y3d,    // Current visual y
                z: z3d,    // Current visual z
            });
        }

        // Slow idle rotation variables
        let angleX = 0;
        let angleY = 0;

        const render = () => {
            ctx.clearRect(0, 0, width, height);

            // Advance idle rotation (10x slower)
            angleY += 0.0001;
            // Optionally add a tiny bit of X rotation for more organic feel
            angleX += 0.00005;

            // Calculate center of screen
            const cx = width / 2;
            const cy = height / 2;

            // Render each particle
            particles.forEach(p => {
                // Apply 3D Rotation Matrix to Reference points (static rotation for now)
                let rx = p.xRef * Math.cos(angleY) - p.zRef * Math.sin(angleY);
                let rz = p.xRef * Math.sin(angleY) + p.zRef * Math.cos(angleY);
                let ry = p.yRef * Math.cos(angleX) - rz * Math.sin(angleX);
                let currentZ = p.yRef * Math.sin(angleX) + rz * Math.cos(angleX);

                // Interaction: Mouse Gravity / Repulsion
                let targetX = rx + cx;
                let targetY = ry + cy;

                if (isMouseOver) {
                    const dx = mouseX - targetX;
                    const dy = mouseY - targetY;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // localized tightly to cursor (e.g. 80px / 2cm radial pull)
                    const pullRadius = 120;
                    if (dist < pullRadius) {
                        // Force exponential decay so dots closer to center pull faster
                        const force = Math.pow((pullRadius - dist) / pullRadius, 2);
                        // Pull strongly towards mouse
                        targetX += dx * force * 0.95;
                        targetY += dy * force * 0.95;
                        currentZ += force * 150; // Pop heavily toward the camera lens
                    }
                }

                // Smoothly move current drawn X/Y towards target (Spring Physics)
                p.x += (targetX - p.x) * 0.15;
                p.y += (targetY - p.y) * 0.15;

                // Perspective Projection 
                const perspective = radius * 3; // Dynamically scale camera distance
                const scaleProjected = perspective / (perspective - currentZ);

                // Do not render if too far behind camera lens
                if (scaleProjected > 0) {
                    // Center the projection properly
                    const projX = cx + (p.x - cx) * scaleProjected;
                    const projY = cy + (p.y - cy) * scaleProjected;

                    // Color mapping: deeper Z = darker/smaller
                    const zNorm = (currentZ + radius) / (radius * 2);
                    const opacity = Math.max(0.05, zNorm * 0.8);
                    const size = Math.max(0.5, zNorm * 2.5);

                    // Color tinting (Navy Base, Khaki/Gold highlights, subtle Green/Red clusters)
                    // Default subtle institutional blue/gold
                    let r = 212, g = 175, b = 55; // --accent-primary Khaki Base

                    if (projX > cx + 100 && projY < cy - 100) { r = 16; g = 185; b = 129; } // Green Top Right
                    if (projX < cx - 100 && projY > cy + 100) { r = 239; g = 68; b = 68; }  // Red Bottom Left

                    ctx.beginPath();
                    ctx.arc(projX, projY, size, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                    ctx.fill();
                }
            });

            requestAnimationFrame(render);
        };

        render();

        // Event Listeners
        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        // Smooth cursor tracking to avoid jittering
        let targetMouseX = width / 2;
        let targetMouseY = height / 2;

        const handleMouseMove = (e) => {
            targetMouseX = e.clientX;
            targetMouseY = e.clientY;
            isMouseOver = true;
        };

        const handleMouseLeave = () => {
            isMouseOver = false;
        };

        // Intercept mouse move logic into a sub-loop for smooth interpolation
        const interpolateMouse = () => {
            mouseX += (targetMouseX - mouseX) * 0.3;
            mouseY += (targetMouseY - mouseY) * 0.3;
            requestAnimationFrame(interpolateMouse);
        };
        interpolateMouse();

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseout', handleMouseLeave);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseout', handleMouseLeave);
        };
    }, []);

    return (
        <div className="particle-wrapper">
            <canvas ref={canvasRef} style={{ display: 'block' }} />
        </div>
    );
};

export default ParticleSphere;
