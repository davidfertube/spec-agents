"use client";

import { motion } from "framer-motion";
import { FileText, Database, ShieldCheck, Zap } from "lucide-react";

export function NetworkVisualization() {
    // Documents scattered around the center
    const nodes = [
        { id: 1, x: 20, y: 20, icon: FileText, delay: 0 },
        { id: 2, x: 80, y: 30, icon: FileText, delay: 0.2 },
        { id: 3, x: 25, y: 80, icon: FileText, delay: 0.4 },
        { id: 4, x: 85, y: 75, icon: FileText, delay: 0.6 },
        { id: 5, x: 50, y: 10, icon: FileText, delay: 0.8 },
        { id: 6, x: 50, y: 90, icon: FileText, delay: 1.0 },
    ];

    return (
        <div className="w-full h-full min-h-[400px] flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-white rounded-3xl border border-slate-100 overflow-hidden relative">

            <div className="relative w-full h-full max-w-lg aspect-square">
                {/* Animated Connection Lines */}
                <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
                    {nodes.map((node) => (
                        <motion.line
                            key={node.id}
                            x1="50%"
                            y1="50%"
                            x2={`${node.x}%`}
                            y2={`${node.y}%`}
                            stroke="#22c55e" // Green-500
                            strokeWidth="2"
                            strokeOpacity="0.3"
                            initial={{ pathLength: 0, opacity: 0 }}
                            whileInView={{ pathLength: 1, opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{
                                duration: 1.5,
                                delay: node.delay,
                                ease: "easeInOut"
                            }}
                        />
                    ))}
                    {/* Pulsing particles moving along lines */}
                    {nodes.map((node) => (
                        <motion.circle
                            key={`p-${node.id}`}
                            r="3"
                            fill="#22c55e"
                        >
                            <animateMotion
                                path={`M 250 250 L ${node.x * 5} ${node.y * 5}`} // Approximate coordinate mapping for 500x500 viewBox
                                dur="3s"
                                repeatCount="indefinite"
                            />
                        </motion.circle>
                    ))}
                </svg>

                {/* Central Core Agent Node */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                    <motion.div
                        initial={{ scale: 0 }}
                        whileInView={{ scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-200 ring-8 ring-green-50 z-20 relative"
                    >
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </motion.div>

                    {/* Radial Pulse Effect */}
                    <motion.div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full bg-green-500 z-10"
                        animate={{ scale: [1, 2.5], opacity: [0.3, 0] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                    />
                </div>

                {/* Satellite Nodes (Documents) */}
                {nodes.map((node) => (
                    <motion.div
                        key={node.id}
                        initial={{ scale: 0, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: node.delay, duration: 0.5 }}
                        style={{ left: `${node.x}%`, top: `${node.y}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                    >
                        <div className="w-12 h-12 bg-white rounded-xl shadow-md border border-slate-100 flex items-center justify-center hover:scale-110 transition-transform">
                            <node.icon className="w-5 h-5 text-slate-500" />
                        </div>
                    </motion.div>
                ))}

            </div>
        </div>
    );
}
