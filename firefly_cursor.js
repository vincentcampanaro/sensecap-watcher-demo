console.log("Firefly cursor script loaded");

import * as Shox from "https://cdn.jsdelivr.net/npm/shox@1.1.3/src/Shox.js"
import Olon from "https://cdn.jsdelivr.net/npm/olon@0.2.4/dist/Olon.min.js"
import { UPDATE_VERT, UPDATE_FRAG, RENDER_VERT, RENDER_FRAG } from "./shader.js"
import { random, min } from "./tools.js"

const COLS = 80;
const ROWS = 80;
const MAX_AMOUNT = COLS * ROWS;
const MIN_AGE = 0;
const MAX_AGE = 30;
const SPEED = 0.5;
let BORN_AMOUNT = 0;

let ol;

async function initFireflyCursor() {
    console.log("Starting initFireflyCursor function");
    const canvas = document.getElementById('firefly-canvas');
    console.log("Canvas element:", canvas);
    if (!canvas) {
        console.error("Firefly canvas not found");
        return;
    }
    
    try {
        // Ensure Olon is loaded
        if (typeof Olon !== 'function') {
            throw new Error("Olon library not loaded properly");
        }

        ol = Olon(canvas);
        if (!ol) {
            throw new Error("Failed to initialize Olon");
        }
        console.log("Olon initialized");

        // Check if necessary methods exist
        if (typeof ol.blend !== 'function' || typeof ol.enableBlend !== 'function' || typeof ol.createProgram !== 'function') {
            throw new Error("Olon object is missing required methods");
        }

        ol.blend({ sfactor: ol.SRC_ALPHA, dfactor: ol.ONE });
        ol.enableBlend();
        console.log("Blend mode set");

        console.log("Creating shader programs");
        const TFV = ["vPosition", "vAge", "vLife", "vVel"];
        const updateProgram = ol.createProgram(UPDATE_VERT, UPDATE_FRAG, TFV);
        const renderProgram = ol.createProgram(RENDER_VERT, RENDER_FRAG);
        console.log("Shader programs created successfully");

        console.log("Setting up attributes and buffers");
        const aPosition = { name: "aPosition", unit: "f32", size: 2 };
        const aAge = { name: "aAge", unit: "f32", size: 1 };
        const aLife = { name: "aLife", unit: "f32", size: 1 };
        const aVel = { name: "aVel", unit: "f32", size: 2 };
        const aCoord = { name: "aCoord", unit: "f32", size: 2 };
        const aTexCoord = { name: "aTexCoord", unit: "f32", size: 2 };

        const updateAttribs = [aPosition, aAge, aLife, aVel];
        const renderAttribs = [aPosition, aAge, aLife];
        const quadAttribs = [aCoord, aTexCoord];

        const particleData = [];
        for (let i = 0; i < MAX_AMOUNT; i++) {
            const LIFE = random(MIN_AGE, MAX_AGE);
            particleData.push(0, 0, LIFE + 1, LIFE, 0, 0);
        }
        const initData = ol.Data(particleData);
        const quadData = ol.quadData();

        const buffer0 = ol.createBuffer(initData, ol.STREAM_DRAW);
        const buffer1 = ol.createBuffer(initData, ol.STREAM_DRAW);
        const quadBuffer = ol.createBuffer(quadData, ol.STATIC_DRAW);
        console.log("Buffers created successfully");

        const VAOConfig = (buffer, stride, attributes, divisor) => ({ buffer, stride, attributes, divisor });
        const updateVAO0 = ol.createVAO(updateProgram, [VAOConfig(buffer0, 4 * 6, updateAttribs)]);
        const updateVAO1 = ol.createVAO(updateProgram, [VAOConfig(buffer1, 4 * 6, updateAttribs)]);
        const renderVAO0 = ol.createVAO(renderProgram, [
            VAOConfig(buffer0, 4 * 6, renderAttribs, 1),
            VAOConfig(quadBuffer, 4 * 4, quadAttribs),
        ]);
        const renderVAO1 = ol.createVAO(renderProgram, [
            VAOConfig(buffer1, 4 * 6, renderAttribs, 1),
            VAOConfig(quadBuffer, 4 * 4, quadAttribs),
        ]);
        console.log("VAOs created successfully");

        const buffers = [buffer0, buffer1];
        const updateVAOs = [updateVAO0, updateVAO1];
        const renderVAOs = [renderVAO0, renderVAO1];
        let [read, write] = [0, 1];

        let mouseX = 0;
        let mouseY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX / window.innerWidth * 2 - 1;
            mouseY = -(e.clientY / window.innerHeight * 2 - 1);
        });

        console.log("Starting render loop");
        ol.render(() => {
            BORN_AMOUNT = min(MAX_AMOUNT, BORN_AMOUNT + 10);

            ol.clearColor(0, 0, 0, 0);
            ol.clearDepth();

            ol.use({
                program: updateProgram,
            }).run(() => {
                ol.transformFeedback(updateVAOs[read], buffers[write], ol.POINTS, () => {
                    ol.uniform("uMouse", [mouseX, mouseY]);
                    ol.uniform("uSpeed", SPEED);
                    ol.uniform("uTime", ol.frame / 60);
                    ol.uniform("uScale", ol.width / ol.height);
                    ol.points(0, BORN_AMOUNT);
                });
            });

            ol.use({
                VAO: renderVAOs[read],
                program: renderProgram,
            }).run(() => {
                ol.uniform("uScale", ol.width / ol.height);
                ol.trianglesInstanced(0, 6, BORN_AMOUNT);
            });

            [read, write] = [write, read];
        });

        console.log("Firefly cursor initialized");

        // Set up resize event listener after initialization
        window.addEventListener('resize', handleResize);
        
        // Initial resize to ensure correct size
        handleResize();
    } catch (error) {
        console.error("Error in firefly cursor initialization:", error);
    }
}

function handleResize() {
    const canvas = document.getElementById('firefly-canvas');
    if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        if (ol && typeof ol.resize === 'function') {
            console.log("Resizing canvas using Olon's resize method");
            ol.resize(window.innerWidth, window.innerHeight);
        } else {
            console.log("Olon resize method not available, manually updating canvas size");
            if (ol && typeof ol.viewport === 'function') {
                ol.viewport(0, 0, canvas.width, canvas.height);
            }
        }
    } else {
        console.error("Canvas element not found");
    }
}

// Expose the function to the global scope
window.initFireflyCursor = initFireflyCursor;

// Use a more robust initialization process
function ensureScriptLoaded(callback) {
    if (document.readyState === 'complete') {
        callback();
    } else {
        window.addEventListener('load', callback);
    }
}

ensureScriptLoaded(() => {
    console.log("Document fully loaded, initializing firefly cursor");
    window.initFireflyCursor();
});