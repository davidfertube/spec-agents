"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Database, User, BrainCircuit, ShieldCheck, FileJson } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Animated Beam Component ---
// Calculates path between two refs and animates a gradient beam
function AnimatedBeam({
    fromRef,
    toRef,
    containerRef,
    curvature = 0,
    reverse = false,
    duration = 2,
    delay = 0,
    pathColor = "rgba(0, 0, 0, 0.1)", // Faint gray for track
    gradientStartColor = "#22c55e", // Green-500
    gradientStopColor = "#16a34a",  // Green-600
}: {
    fromRef: React.RefObject<HTMLDivElement | null>;
    toRef: React.RefObject<HTMLDivElement | null>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    curvature?: number;
    reverse?: boolean;
    duration?: number;
    delay?: number;
    pathColor?: string;
    gradientStartColor?: string;
    gradientStopColor?: string;
}) {
    const [pathD, setPathD] = useState("");

    useEffect(() => {
        const updatePath = () => {
            if (!fromRef.current || !toRef.current || !containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            const fromRect = fromRef.current.getBoundingClientRect();
            const toRect = toRef.current.getBoundingClientRect();

            const fromX = fromRect.left - containerRect.left + fromRect.width / 2;
            const fromY = fromRect.top - containerRect.top + fromRect.height / 2;
            const toX = toRect.left - containerRect.left + toRect.width / 2;
            const toY = toRect.top - containerRect.top + toRect.height / 2;

            // Calculate Control Points for Bezier Curve
            const midX = (fromX + toX) / 2;
            const midY = (fromY + toY) / 2;

            const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));

            // Adjust curvature based on relative positions
            // Simplistic approach: curve perpendicular to the line connecting points
            // For this specific visualization (mostly horizontal/radial), somewhat specialized

            let d = `M ${fromX} ${fromY}`;

            // Simple quadratic bezier for curvature
            // We want to curve mainly vertically if items are apart horizontally
            const controlX = midX;
            const controlY = midY + curvature;

            d += ` Q ${controlX} ${controlY} ${toX} ${toY}`;

            setPathD(d);
        };

        updatePath();
        window.addEventListener("resize", updatePath);
        return () => window.removeEventListener("resize", updatePath);
    }, [fromRef, toRef, containerRef, curvature]);


    const id = React.useId();

    return (
        <svg
            fill="none"
            width="100%"
            height="100%"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-0"
        >
            <path
                d={pathD}
                stroke={pathColor}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
            />
            <path
                d={pathD}
                stroke={`url(#${id})`}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
            />
            <defs>
                <motion.linearGradient
                    id={id}
                    gradientUnits="userSpaceOnUse"
                    initial={{
                        x1: "0%",
                        x2: "0%",
                        y1: "0%",
                        y2: "0%",
                    }}
                    animate={{
                        x1: reverse ? ["90%", "-10%"] : ["10%", "110%"],
                        x2: reverse ? ["100%", "0%"] : ["0%", "100%"],
                        y1: ["0%", "0%"],
                        y2: ["0%", "0%"],
                    }}
                    transition={{
                        delay,
                        duration,
                        ease: "linear",
                        repeat: Infinity,
                    }}
                >
                    <stop stopColor={gradientStartColor} stopOpacity="0" />
                    <stop stopColor={gradientStartColor} />
                    <stop offset="32.5%" stopColor={gradientStopColor} />
                    <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
                </motion.linearGradient>
            </defs>
        </svg>
    );
}

// --- Node Component ---
const Circle = React.forwardRef<
    HTMLDivElement,
    { className?: string; children?: React.ReactNode; color?: string }
>(({ className, children, color = "bg-white" }, ref) => {
    return (
        <div
            ref={ref}
            className={cn(
                "z-10 flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 shadow-md backdrop-blur-sm transition-transform hover:scale-110",
                color,
                className
            )}
        >
            {children}
        </div>
    );
});
Circle.displayName = "Circle";


export function NetworkVisualization() {
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs for nodes
    const agentRef = useRef<HTMLDivElement>(null);
    const userRef = useRef<HTMLDivElement>(null);
    const pdf1Ref = useRef<HTMLDivElement>(null);
    const pdf2Ref = useRef<HTMLDivElement>(null);
    const dbRef = useRef<HTMLDivElement>(null);
    const jsonRef = useRef<HTMLDivElement>(null);

    return (
        <div
            className="w-full h-full min-h-[400px] flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-white rounded-3xl border border-slate-100 overflow-hidden relative"
            ref={containerRef}
        >
            <div className="relative flex w-full max-w-lg flex-col items-center justify-between gap-16">

                {/* Top Row: Inputs (Files/Data) */}
                <div className="flex flex-row items-center justify-between w-full px-8">
                    <Circle ref={pdf1Ref} className="border-red-100 bg-red-50">
                        <FileText className="h-6 w-6 text-red-500" />
                    </Circle>
                    <Circle ref={dbRef} className="border-orange-100 bg-orange-50">
                        <Database className="h-6 w-6 text-orange-500" />
                    </Circle>
                    <Circle ref={pdf2Ref} className="border-blue-100 bg-blue-50">
                        <FileText className="h-6 w-6 text-blue-500" />
                    </Circle>
                    <Circle ref={jsonRef} className="border-purple-100 bg-purple-50">
                        <FileJson className="h-6 w-6 text-purple-500" />
                    </Circle>
                </div>

                {/* Middle: The AI Agent */}
                <div className="relative">
                    <Circle ref={agentRef} className="h-24 w-24 bg-black border-none shadow-xl shadow-green-500/20">
                        <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping opacity-20" />
                        <BrainCircuit className="h-10 w-10 text-green-400" />
                    </Circle>
                </div>

                {/* Bottom: The User / Output */}
                <div className="flex flex-row items-center justify-center">
                    <Circle ref={userRef} className="h-16 w-16 border-green-200 bg-green-50">
                        <User className="h-8 w-8 text-green-700" />
                    </Circle>
                </div>

            </div>

            {/* --- Connect Beams --- */}

            {/* Inputs -> Agent */}
            <AnimatedBeam containerRef={containerRef} fromRef={pdf1Ref} toRef={agentRef} curvature={-30} duration={3} />
            <AnimatedBeam containerRef={containerRef} fromRef={dbRef} toRef={agentRef} curvature={-15} duration={3} delay={0.5} />
            <AnimatedBeam containerRef={containerRef} fromRef={pdf2Ref} toRef={agentRef} curvature={15} duration={3} delay={1} />
            <AnimatedBeam containerRef={containerRef} fromRef={jsonRef} toRef={agentRef} curvature={30} duration={3} delay={1.5} />

            {/* Agent -> User (Bidirectional/Answer) */}
            <AnimatedBeam
                containerRef={containerRef}
                fromRef={agentRef}
                toRef={userRef}
                curvature={0}
                duration={1.5}
                gradientStartColor="#22c55e"
                gradientStopColor="#3b82f6"
            />

        </div>
    );
}
