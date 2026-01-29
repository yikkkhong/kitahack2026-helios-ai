import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config();

// 定义清晰的输出结构，让 AI 知道填什么
const analysisSchema = {
  description: "Solar analysis report",
  type: SchemaType.OBJECT,
  properties: {
    internal_thought_process: {
      type: SchemaType.STRING,
      description: "YOUR INTERNAL MONOLOGUE. Analyze the user's tone, constraints, and hidden needs here first.",
      nullable: false,
    },
    ui_display: {
      type: SchemaType.OBJECT,
      properties: {
        suitability: { type: SchemaType.STRING },
        installation_method: { type: SchemaType.STRING },
        reasons: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING }
        }
      },
      required: ["suitability", "installation_method", "reasons"]
    },
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
    technical_config: {
      type: SchemaType.OBJECT,
      properties: {
        panel_count: { type: SchemaType.NUMBER },
        placement: { type: SchemaType.STRING, description: "rooftop, balcony, window, car_porch, ground, or virtual" },
        system_size_kw: { type: SchemaType.NUMBER }
      },
      required: ["panel_count", "placement", "system_size_kw"]
    },
    next_steps: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING }
    }
  },
  required: ["internal_thought_process", "ui_display", "financial_report", "technical_config", "next_steps"]
};

export const analyzeWithGemini = onCall(async (request) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpsError('failed-precondition', 'Missing API Key');

  const { solarData, userInputs, location } = request.data;
  
  // 1. 我们不在这里做任何逻辑判断！全部交给 AI。
  // 我们只负责把原始数据整理好。
  const userRawVoice = userInputs.specialRequirements || "No special requests.";
  
  // 2. 构建 "Consultant Persona" (顾问人设) Prompt
  const prompt = `
    Role: You are Helios, a world-class Solar Energy Consultant in Malaysia.
    Your distinctive quality is **ADAPTABILITY**. You do not use scripts. You listen to the user's specific situation and design a custom solution.

    --- CLIENT PROFILE ---
    Location: ${location.address || "Unknown"}
    Monthly Bill: RM ${userInputs.bill}
    Budget: RM ${userInputs.budget}
    Roof Data: Area ${solarData.area || 0} sqm, Potential ${solarData.panels || 0} panels.
    
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
  `;

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // 使用 gemini-1.5-pro (比 Flash 更聪明，更能理解复杂的语义)
  // 如果为了速度必须用 Flash，请改回 gemini-1.5-flash，但 Pro 的推理能力强很多
  const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview", 
    generationConfig: { 
      responseMimeType: "application/json",
      responseSchema: analysisSchema as any, // 强类型约束
      temperature: 0.5 // 稍微有些创造力
    } 
  });

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const aiAnalysis = JSON.parse(text);

    return { success: true, analysis: aiAnalysis };

  } catch (error) {
    console.error("Gemini Error:", error);
    // 只有在 API 彻底崩坏时才使用 Fallback
    return { success: true, isFallback: true, analysis: getFallbackData() }; 
  }
});

// 简单的 Fallback 数据，仅作崩溃备用
function getFallbackData() {
    return {
        internal_thought_process: "API Failure. Using fallback.",
        ui_display: {
            suitability: "System Offline",
            installation_method: "Standard Analysis",
            reasons: ["AI is currently offline.", "Showing standard estimates."]
        },
        financial_report: { estimated_install_cost: 10000, yearly_savings_rm: 2000, roi_years: 5, breakeven_year: 5 },
        technical_config: { panel_count: 5, placement: "rooftop", system_size_kw: 2 },
        next_steps: ["Try again later"]
    };
}