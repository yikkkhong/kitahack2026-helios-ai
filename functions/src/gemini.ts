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

// =================================================================================
// PART 1: Schema Definition (Integrated Version: Physical + Financial + ERU Assets)
// =================================================================================
const analysisSchema = {
  description: "Solar analysis with traditional financials and ERU assetization",
  type: SchemaType.OBJECT,
  properties: {
    // 1. AI thought process (for internal use, not shown to users)
    internal_thought_process: { type: SchemaType.STRING, nullable: false },
    
    // 2. UI show data (suitability, installation method, reasons) - for user display
    ui_display: {
      type: SchemaType.OBJECT,
      properties: {
        suitability: { type: SchemaType.STRING },
        installation_method: { type: SchemaType.STRING },
        reasons: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      },
      required: ["suitability", "installation_method", "reasons"]
    },

    // 3. 🟢 Traditional financial statements (physical costs shown to the judges)
    financial_report: {
      type: SchemaType.OBJECT,
      properties: {
        estimated_install_cost: { type: SchemaType.NUMBER },
        yearly_savings_rm: { type: SchemaType.NUMBER },
        roi_years: { type: SchemaType.NUMBER }
      },
      required: ["estimated_install_cost", "yearly_savings_rm", "roi_years"]
    },

    // 4. 🟢 ERU Asset Potential Model (Your Core Innovation)
    asset_potential: {
      type: SchemaType.OBJECT,
      properties: {
        total_eru_10yr: { type: SchemaType.NUMBER, description: "Total 10-year ERU limit based on kWh" },
        initial_grant_eru: { type: SchemaType.NUMBER, description: "Initial ERU unlocked instantly" },
        eru_peg_rate_rm: { type: SchemaType.NUMBER, description: "Fixed RM value per ERU (e.g. 0.50)" },
        total_fiat_value_10yr: { type: SchemaType.NUMBER, description: "Total fiat value over 10 years" }
      },
      required: ["total_eru_10yr", "initial_grant_eru", "eru_peg_rate_rm", "total_fiat_value_10yr"]
    },

    // 5. Technical configuration
    technical_config: {
      type: SchemaType.OBJECT,
      properties: {
        panel_count: { type: SchemaType.NUMBER },
        placement: { type: SchemaType.STRING, enum: ["ROOFTOP", "BALCONY"] }, // Removed VIRTUAL
        system_size_kw: { type: SchemaType.NUMBER },
        grid_layout: {
            type: SchemaType.OBJECT,
            properties: { rows: { type: SchemaType.NUMBER }, columns: { type: SchemaType.NUMBER } },
            required: ["rows", "columns"]
        },
        orientation: { type: SchemaType.STRING, enum: ["PORTRAIT", "LANDSCAPE"] },
        panel_color: { type: SchemaType.STRING, enum: ["BLACK", "BLUE"] }
      },
      required: ["panel_count", "placement", "system_size_kw", "grid_layout", "orientation", "panel_color"]
    },
    next_steps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
  },
  required: ["internal_thought_process", "ui_display", "financial_report", "asset_potential", "technical_config", "next_steps"]
};

// ================================================================
// PART 2: Step 1 Logic (Asset Discovery)
// ================================================================

export const analyzeWithGemini = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpsError('failed-precondition', 'Missing API Key');

  const { solarData, userInputs, location } = request.data;
  
  const maxPanels = userInputs.roofConstraint?.maxPanels || 50;
  const userRawVoice = userInputs.specialRequirements || "No special requests.";
  
  // 🟢 A minimalist Prompt: Focused on hardware evaluation, no longer offering lifestyle advice.
  const prompt = `
    Role: You are Helios, a Solar Asset Evaluator.
    
    --- CLIENT DATA ---
    Location: ${location.address || "Unknown"}
    Monthly Bill: RM ${userInputs.bill}
    Physical Roof Limit: Max ${maxPanels} panels
    Context: "${userRawVoice}"

    --- HARDWARE LOGIC ---
    1. Determine Placement: If context says "Condo", "Apartment", "Balcony" -> **BALCONY**. Else -> **ROOFTOP**.
    2. Panel Calculation:
       - If ROOFTOP: Calculate panels based on Bill (RM ${userInputs.bill} / RM 25). Max limit is ${maxPanels}.
       - If BALCONY: Strictly **2 PANELS**.

    Output valid JSON matching the schema.
  `;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash", 
    generationConfig: { responseMimeType: "application/json", responseSchema: analysisSchema as any } 
  });

  try {
    console.log("🚀 [Step 1] Sending to Gemini...");
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const aiAnalysis = JSON.parse(text);

    // =================================================================
    // 🟢 Backend forced correction & ERU asset calculation
    // =================================================================
    const placement = aiAnalysis.technical_config.placement?.toUpperCase();

    // 1. Fixed physical limitations
    if (placement === 'BALCONY') {
        aiAnalysis.technical_config.panel_count = 2;
        aiAnalysis.technical_config.grid_layout = { rows: 1, columns: 2 };
        aiAnalysis.technical_config.system_size_kw = 0.9; 
    } else {
        let targetCount = aiAnalysis.technical_config.panel_count;
        if (targetCount > maxPanels) targetCount = maxPanels;
        const grid = formatToPerfectGrid(targetCount);
        aiAnalysis.technical_config.panel_count = grid.count;
        aiAnalysis.technical_config.grid_layout = { rows: grid.rows, columns: grid.cols };
        aiAnalysis.technical_config.system_size_kw = Number((grid.count * 0.45).toFixed(2));
    }

    const kwp = aiAnalysis.technical_config.system_size_kw;

    // 2. Traditional financial estimation (fixing the issue of AI miscalculating money)
    const installCost = placement === 'BALCONY' ? 2800 : Math.round(kwp * 3500);
    const yearlySavings = placement === 'BALCONY' ? 600 : Math.round(kwp * 1400 * 0.5);
    const roi = Number((installCost / yearlySavings).toFixed(1));

    aiAnalysis.financial_report = {
        estimated_install_cost: installCost,
        yearly_savings_rm: yearlySavings,
        roi_years: roi
    };

    // 3. 🟢 ERU Core Asset Calculation (Inflation Protection + The Ultimate Logic of Distribution According to Work)
    
    // Current electricity rate/ERU unit price (assuming it's currently RM 0.50. This value will increase as electricity rates rise in the future).
    const ERU_PEG_RATE = 0.50; 
    
    // Theoretical total output of one solar panel over 10 years (1 kWh = 1 ERU)
    const ERU_PER_PANEL_10YR = 5400; 
    
    // 💡 Your brilliant logic: For every board installed, the system provides a fixed initial credit of RM 300.
    const FIAT_GRANT_PER_PANEL = 300; 

    // Get the number of blocks calculated by the system
    const panelCount = aiAnalysis.technical_config.panel_count;

    // 1. Total Amount = Number of Plates × Output per Plate over 10 Years
    const total_eru = panelCount * ERU_PER_PANEL_10YR; 
    
    // 2. Initial unlocked ERU = (Number of boards × RM reward per board) ÷ Current RM unit price of ERU
    // This way, if ERU appreciates to RM 1.00, the amount of ERU you receive will automatically be halved! Perfectly fair!
    const initial_eru = Math.floor((panelCount * FIAT_GRANT_PER_PANEL) / ERU_PEG_RATE);

    aiAnalysis.asset_potential = {
        total_eru_10yr: total_eru,
        initial_grant_eru: initial_eru,
        eru_peg_rate_rm: ERU_PEG_RATE,
        total_fiat_value_10yr: total_eru * ERU_PEG_RATE
    };

    return { success: true, analysis: aiAnalysis };

} catch (error) {
    console.error("🔥 [Step 1] API Error:", error);
    console.log("⚠️ Triggering Smart Fallback Calculator...");
    // 🟢 Reuse getSmartFallbackData and solarData
    return { 
        success: true, 
        isFallback: true, 
        analysis: getSmartFallbackData(solarData, userInputs) 
    }; 
  }
});

// ================================================================
// PART 3: AI Chart Explainer (Simulate Mode)
// ================================================================
export const explainSimulation = onCall({ cors: true, timeoutSeconds: 60 }, async (request) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpsError('failed-precondition', 'Missing API Key');

  const { year, traditionalValue, heliosValue, eruBalance, hasCrisis, concern, crisisYear } = request.data;
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    Role: You are Helios AI, a financial data analyst.
    Task: Explain the current state of the user's solar investment simulation in simple, engaging terms.
    
    Current Data:
    - Year: ${year}
    - Traditional Solar Value: RM ${traditionalValue}
    - Helios ERU Asset Value: RM ${heliosValue}
    - ERU Balance: ${eruBalance} ERU
    - Did a crisis happen?: ${hasCrisis ? `Yes, "${concern}" at Year ${crisisYear}` : "No, normal operation."}

    Rules:
    1. Output exactly 2 or 3 short sentences.
    2. Explain WHAT the numbers mean right now. (e.g., "You are currently losing money on traditional solar because...")
    3. Highlight WHY Helios is performing better (mention the ERU balance liquid value).
    4. Tone: Professional, clear, and reassuring. No markdown, just plain text.
  `;

  try {
    const result = await model.generateContent(prompt);
    return { success: true, message: result.response.text().trim() };
  } catch (error) {
    console.error("🔥 [Explainer] Error:", error);
    return { success: true, message: `At Year ${year}, traditional solar is valued at RM ${traditionalValue}, while your Helios ERU assets provide a secure value of RM ${heliosValue}.` };
  }
});


// ================================================================
// PART 4: Smart Fallback
// ================================================================
// This function will automatically calculate data when the AI ​​crashes, instead of displaying Offline.

function getSmartFallbackData(solarData: any, userInputs: any) {
    const panelsForBill = Math.ceil(userInputs.bill / 25);
    const panelsForBudget = Math.floor(userInputs.budget / 1500);
    const hardMaxPanels = solarData?.panels || userInputs.roofConstraint?.maxPanels || 20;

    let targetPanels = Math.min(panelsForBill, panelsForBudget, hardMaxPanels);
    if (targetPanels < 4) targetPanels = 4;

    const gridConfig = formatToPerfectGrid(targetPanels);
    const finalPanels = gridConfig.count;

    const systemSizeKw = finalPanels * 0.45; 
    const installCost = Math.round(systemSizeKw * 4000); 
    const yearlySavings = Math.round(systemSizeKw * 1400 * 0.5); 
    const roi = (installCost / yearlySavings).toFixed(1);

    // 🟢 Fallback should also be counted towards ERU
    const ERU_PEG_RATE = 0.50; // Anchored to actual electricity cost RM 0.50 / ERU
    const ERU_PER_PANEL_10YR = 5400; // Total production of 1 solar panel over 10 years (1 kWh = 1 ERU)
    const FIAT_GRANT_PER_PANEL = 300; // For each board installed, you will receive a reward of RM 300 worth of ERU.

    // Total Amount = Final Panel Quantity × 10-Year Production Per Panel
    const total_eru = finalPanels * ERU_PER_PANEL_10YR; 
    
    // Initial unlock = (Number of panels × RM reward per panel) ÷ Current RM unit price of ERU
    const initial_eru = Math.floor((finalPanels * FIAT_GRANT_PER_PANEL) / ERU_PEG_RATE);

    return {
        internal_thought_process: "Fallback mode active.",
        ui_display: {
            suitability: "High Potential",
            installation_method: "Optimized Rooftop Array",
            reasons: ["Based on local irradiance data."]
        },
        financial_report: { 
            estimated_install_cost: installCost, 
            yearly_savings_rm: yearlySavings, 
            roi_years: Number(roi)
        },
        // 🟢 Add Fallback Asset Data
        asset_potential: {
            total_eru_10yr: total_eru,
            initial_grant_eru: initial_eru,
            eru_peg_rate_rm: 0.50,
            total_fiat_value_10yr: total_eru * ERU_PEG_RATE
        },
        technical_config: { 
            panel_count: finalPanels, 
            placement: "ROOFTOP", 
            system_size_kw: Number(systemSizeKw.toFixed(1)), 
            grid_layout: { rows: gridConfig.rows, columns: gridConfig.cols }, 
            orientation: "PORTRAIT", 
            panel_color: "BLACK" 
        },
        next_steps: ["Activate Asset"]
    };
}