import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
// direct from firestore import FieldValue， not via admin, more compatible
import { FieldValue } from "firebase-admin/firestore"; 

// initialize app if not already initialized
admin.initializeApp({
  projectId: "kitahack2026-helios-ai"
});

const db = admin.firestore();

interface SolarProjectData {
  location: { lat: number; lng: number };
  bill: number;
  budget: number;
  analysis: any;
}

export const createSolarProject = onCall(async (request) => {
  console.log("Request received from the frontend! Starting processing...."); 

  const data = request.data as SolarProjectData;
  console.log("front-end data:", JSON.stringify(data)); 

  // clear undefined data to avoid Firestore error
  const cleanAnalysis = JSON.parse(JSON.stringify(data.analysis || {}));

  try {
    const result = await db.collection("solar_estimates").add({
      location: data.location,
      userInputs: { 
        bill: data.bill || 0, 
        budget: data.budget || 0 
      },
      analysis: cleanAnalysis,
      status: 'pending_installer',
    // ⬇️ Modification: Directly use the imported FieldValue instead of admin.firestore.FieldValue
      createdAt: FieldValue.serverTimestamp(), 
      source: 'NodeJS_Backend_v2'
    });

    console.log("Written successfully:", result.id);
    return { success: true, id: result.id };

  } catch (error) {
    console.error("❌ Critical database write error:", error); 
    throw new HttpsError('internal', 'Failed to save project to database');
  }
});