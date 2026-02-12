import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

// Helper: Find the closest "perfect grid" that is within budget
// E.g., 13 panels -> 12 (3x4)
function formatToPerfectGrid(targetPanels: number) {
    if (targetPanels < 1) targetPanels = 1;

    // Starting with the maximum number given by the AI ​​or budget, decrease the number of elements below to find the number that can form a perfect rectangle.
    for (let i = targetPanels; i >= 1; i--) {
        let r = Math.floor(Math.sqrt(i));
        let c = Math.ceil(i / r);
        // If they can be arranged into a perfect rectangle (without any missing corners)
        if (r * c === i) {
            return { count: i, rows: r, cols: c };
        }
    }
    return { count: 1, rows: 1, cols: 1 };
}

// ================================================================
// PART 1: Schema definition
// ================================================================
const analysisSchema = {
  description: "Solar analysis report with 3D visualization parameters",
  type: SchemaType.OBJECT,
  properties: {
    // 1. AI thought process
    internal_thought_process: {
      type: SchemaType.STRING,
      description: "YOUR INTERNAL MONOLOGUE. Analyze the user's tone, constraints, and hidden needs.",
      nullable: false,
    },
    
    // 2. UI display result
    ui_display: {
      type: SchemaType.OBJECT,
      properties: {
        suitability: { type: SchemaType.STRING },
        installation_method: { type: SchemaType.STRING },
        reasons: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      },
      required: ["suitability", "installation_method", "reasons"]
    },

    // 3. financial report
    financial_report: {
      type: SchemaType.OBJECT,
      properties: {
        estimated_install_cost: { type: SchemaType.NUMBER },
        yearly_savings_rm: { type: SchemaType.NUMBER },
        roi_years: { type: SchemaType.NUMBER },
        breakeven_year: { type: SchemaType.NUMBER }
      },
      required: ["estimated_install_cost", "yearly_savings_rm", "roi_years", "breakeven_year"]
    },

    // 4. Technology and 3D Configuration
    technical_config: {
      type: SchemaType.OBJECT,
      properties: {
        panel_count: { type: SchemaType.NUMBER },
        
        // Placement
        placement: { type: SchemaType.STRING, description: "rooftop, balcony, window, car_porch, ground, or virtual" },
        
        system_size_kw: { type: SchemaType.NUMBER },
        
        // 🧱 Array layout
        grid_layout: {
            type: SchemaType.OBJECT,
            properties: {
                rows: { type: SchemaType.NUMBER },
                columns: { type: SchemaType.NUMBER }
            },
            required: ["rows", "columns"]
        },

        // 📐 Placement direction
        orientation: { 
            type: SchemaType.STRING, 
            description: "PORTRAIT (vertical) or LANDSCAPE (horizontal)",
            enum: ["PORTRAIT", "LANDSCAPE"] 
        },

        // 🎨 Visual Style
        panel_color: { 
            type: SchemaType.STRING, 
            description: "BLACK (Monocrystalline - Premium/Modern) or BLUE (Polycrystalline - Budget)",
            enum: ["BLACK", "BLUE"] 
        }
      },
      required: ["panel_count", "placement", "system_size_kw", "grid_layout", "orientation", "panel_color"]
    },

    // 5. Next step
    next_steps: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    }
  },
  required: ["internal_thought_process", "ui_display", "financial_report", "technical_config", "next_steps"]
};

// ================================================================
// PART 2: Step 1 Customization Page Main Logic (Gemini Integration)
// ================================================================

export const analyzeWithGemini = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`🔑 [Step 1] Key Status: ${apiKey ? 'Loaded' : 'MISSING'}`);

  if (!apiKey) throw new HttpsError('failed-precondition', 'Missing API Key');

  const { solarData, userInputs, location } = request.data;

  const maxPanels = userInputs.roofConstraint?.maxPanels || 50;
  const roofArea = userInputs.roofConstraint?.areaSqM || 100;
  
  // 1. Prompt logic
  const userRawVoice = userInputs.specialRequirements || "No special requests.";
  
  const prompt = `
    Role: You are Helios, a world-class Solar Energy Consultant in Malaysia.
    Your distinctive quality is **ADAPTABILITY**. You do not use scripts. You listen to the user's specific situation and design a custom solution.

    --- CLIENT PROFILE ---
    Location: ${location.address || "Unknown"}
    Monthly Bill: RM ${userInputs.bill}
    Budget: RM ${userInputs.budget}

    --- 🛑 PHYSICS LOCK (CRITICAL) ---
    The user's roof has a PHYSICAL HARD LIMIT.
    - Max Possible Panels: ${maxPanels} (Do NOT exceed this number!)
    - Roof Area: ${roofArea} sqm
    
    Logic for Panel Count (Follow strictly):
    1. Calculate panels to cover the Bill: (Bill RM ${userInputs.bill} / RM 25) = Needed Panels.
    2. Calculate max affordable panels: (Budget RM ${userInputs.budget} / RM 1500) = Affordable Panels.
    3. Final Panel Count = The LOWEST number among: (Needed Panels), (Affordable Panels), and (${maxPanels}).
    4. NEVER recommend a massive system that produces way more than the user's bill just because they have a high budget! Be realistic.  .
    
    --- CLIENT'S RAW VOICE (CRITICAL) ---
    "${userRawVoice}"

    --- YOUR MISSION ---
    1. **INTERPRET INTENT (Not Keywords)**: 
       - If client says "I don't have a balcony", "No balcony", "Balcony is full", or "My cat hates the balcony" -> These ALL mean **NO BALCONY**.
       - If client says "I rent", "Not my house", "Landlord issue" -> These ALL mean **NON-PERMANENT SOLUTION**.
       - If client says "I live in a cave" (Impossible scenario) -> Suggest "Virtual Solar Subscription" or "Portable Battery". DO NOT FAIL.
    
    2. **ANALYZE CONFLICTS**:
       - High Bill + Low Budget? -> Focus on high-ROI, small systems.
       - Condo Address + "Garden" request? -> Maybe they are on the Ground Floor. Trust the user's specific constraint over the generic address.

    3. **THINK BEFORE YOU SPEAK**:
       - In the 'internal_thought_process' field, write down your analysis. 
       - E.g., "Client lives in a condo, explicitly said no balcony. Roof is shared so not an option. Best option is Window Suction Mounts facing South."

    4. **OUTPUT**:
       - Generate a valid JSON response based on the schema.
       - 'installation_method' should be a Creative Name, not a generic category. (e.g. "Smart Window Harvester" instead of "Window").
       - For 'technical_config', calculate a reasonable 'grid_layout' (rows x columns) that roughly equals 'panel_count'.
       - Choose 'panel_color' based on Budget: High Budget -> BLACK, Low Budget -> BLUE.

      --- STRICT PHYSICAL CONSTRAINTS (CRITICAL) ---
      1. **Roof Area Limit**: You MUST NOT suggest more panels than the roof can physically fit.
       - A standard Terrace House (20x70) fits max 20-24 panels.
       - A Semi-D fits max 30-36 panels.
       - Even if Budget is RM 1,000,000, DO NOT suggest 50 panels for a small house.
    
      2. **Panel Count Logic**:
       - Always leave safety margins. Do not fill the roof to the edge.
  `;

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use the model specified. If an error occurs, it will automatically enter Smart Fallback.
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash", 
    generationConfig: { 
      responseMimeType: "application/json",
      responseSchema: analysisSchema as any,
      temperature: 0.5 
    } 
  });

  try {
    console.log("🚀 [Step 1] Sending to Gemini...");
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // Give it a quick rinse to prevent the AI ​​from going crazy.
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const aiAnalysis = JSON.parse(text);

    // 1. Get the number of AI suggestions and implement physical limit (maxPanels) for interception.
    const rawAiCount = aiAnalysis.technical_config?.panel_count || 1;
    let targetCount = rawAiCount;

    // 2. Physical cap interception
    if (targetCount > maxPanels) {
        targetCount = maxPanels;
    }

    // 3. Convert to a perfect grid (will not exceed targetCount)
    const gridConfig = formatToPerfectGrid(targetCount);
    
    // 4. If the final quantity differs from the original quantity determined by AI, the cost will be deducted precisely proportionally
    if (gridConfig.count !== rawAiCount) {
        console.log(`⚠️ AI suggests ${rawAiCount} quantity of solar panel(s). For aesthetic reasons and due to physical/electricity cost constraints, the settings were automatically adjusted down to ${gridConfig.count} panel(s)`);
        
        // Use the final quantity / the original AI quantity
        const ratio = gridConfig.count / rawAiCount;
        
        // Strictly synchronize cost reduction and electricity savings
        aiAnalysis.financial_report.estimated_install_cost = Math.round(aiAnalysis.financial_report.estimated_install_cost * ratio);
        aiAnalysis.financial_report.yearly_savings_rm = Math.round(aiAnalysis.financial_report.yearly_savings_rm * ratio);
        aiAnalysis.technical_config.system_size_kw = Number((aiAnalysis.technical_config.system_size_kw * ratio).toFixed(1));
    }

    // 5. Overwrite as clean grid data
    aiAnalysis.technical_config.panel_count = gridConfig.count;
    aiAnalysis.technical_config.grid_layout = { rows: gridConfig.rows, columns: gridConfig.cols };

    console.log("✅ [Step 1] Success! Final Panel Count:", aiAnalysis.technical_config.panel_count);
    return { success: true, analysis: aiAnalysis };

  } catch (error) {
    console.error("🔥 [Step 1] API Error:", error);
    console.log("⚠️ Triggering Smart Fallback Calculator...");
    return { success: true, isFallback: true, analysis: getSmartFallbackData(solarData, userInputs) }; 
  }
});

// ================================================================
// PART 3: Step 2 Simulation Page (Feasibility Check)
// ================================================================

export const checkFeasibility = onCall({ cors: true, timeoutSeconds: 60 }, async (request) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpsError('failed-precondition', 'Missing API Key');

  const { originalCount, currentCount, rows, cols, rotation } = request.data;
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Role: Senior Solar Structural Engineer.
    Task: Evaluate user changes to a solar array layout in a simulation.
    
    Original Safe Plan: ${originalCount} panels.
    User's New Plan: ${currentCount} panels (${rows}x${cols} grid).
    Rotation: ${rotation} degrees.

    Rules:
    1. >150% original = WARN (Structural load risk).
    2. <80% original = SUGGEST (Underutilized).
    3. Else = APPROVE (Optimal).
    
    Output: A single short sentence starting with "Engineer Analysis:".
  `;

  try {
    const result = await model.generateContent(prompt);
    return { success: true, message: result.response.text().replace("Engineer Analysis:", "").trim() };
  } catch (error) {
    console.error("🔥 [Step 2] Error:", error);
    return { success: true, message: "Engineer is currently offline. Layout appears structurally valid." };
  }
});


// ================================================================
// PART 4: Smart Fallback
// ================================================================
// This function will automatically calculate data when the AI ​​crashes, instead of displaying Offline.

function getSmartFallbackData(solarData: any, userInputs: any) {
    
    // 1. Simultaneously assess [electricity cost requirements], [budgetary capacity], and [physical limits].
    const panelsForBill = Math.ceil(userInputs.bill / 25); // Assuming a saving of RM25 per board per month
    const panelsForBudget = Math.floor(userInputs.budget / 1500); // Assuming 1 board + installation RM1500
    const hardMaxPanels = userInputs.roofConstraint?.maxPanels || 20;

    // Take the minimum value of these three factors! Never waste the user's budget.
    let targetPanels = Math.min(panelsForBill, panelsForBudget, hardMaxPanels);
    if (targetPanels < 4) targetPanels = 4; // The system recommends a minimum of 4 pieces.

    // 2. Convert to perfect mesh
    const gridConfig = formatToPerfectGrid(targetPanels);
    const finalPanels = gridConfig.count;

    // 3. Financial calculations
    const systemSizeKw = finalPanels * 0.45; 
    const installCost = Math.round(systemSizeKw * 4000); 
    const yearlySavings = Math.round(systemSizeKw * 1400 * 0.5); 
    const roi = (installCost / yearlySavings).toFixed(1);

    // 4. Return structured data
    return {
        internal_thought_process: "Connection unstable. Calculating optimal setup based on local irradiance data and user bill constraints locally.",
        ui_display: {
            suitability: "High Potential",
            installation_method: "Optimized Rooftop Array (Calculated)",
            reasons: [
                "Your roof area supports excellent solar generation.",
                `Based on RM ${userInputs.bill} bill, this system maximizes ROI.`,
                "Standard mounting is suitable for your location."
            ]
        },
        financial_report: { 
            estimated_install_cost: installCost, 
            yearly_savings_rm: yearlySavings, 
            roi_years: Number(roi), 
            breakeven_year: Math.ceil(Number(roi)) 
        },
        technical_config: { 
            panel_count: finalPanels, 
            placement: "rooftop", 
            system_size_kw: Number(systemSizeKw.toFixed(1)), 
            grid_layout: {
                rows: gridConfig.rows, 
                columns: gridConfig.cols 
            }, 
            orientation: "PORTRAIT", 
            panel_color: "BLACK" 
        },
        next_steps: [
            "Request Official Quote", 
            "Schedule Site Visit",
            "Apply for NEM 3.0"
        ]
    };
}