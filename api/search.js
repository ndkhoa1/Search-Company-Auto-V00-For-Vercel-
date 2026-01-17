import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Chỉ chấp nhận method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { companyName } = req.body;

    // Lấy API Key từ biến môi trường Vercel
    if (!process.env.API_KEY) {
      return res.status(500).json({ error: 'Server configuration error: API_KEY is missing' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Prompt tối ưu (Giống logic cũ ở Client)
    const prompt = `
        Tìm kiếm thông tin doanh nghiệp: "${companyName}" tại Việt Nam.
        
        SỬ DỤNG GOOGLE SEARCH ĐỂ TÌM:
        1. Mã Số Thuế (MST) - Ưu tiên nguồn: Tổng cục thuế, Masothue, Hosocongty.
        2. Website (Domain) chính thức - Bỏ qua các trang danh bạ, tuyển dụng.

        TRẢ VỀ KẾT QUẢ ĐÚNG ĐỊNH DẠNG:
        MST: [Mã số hoặc "KTT"]
        DOMAIN: [Domain dạng @domain.com hoặc "KTT"]
        INFO: [Ngành nghề chính dưới 15 từ]
      `;

    // Sử dụng model gemini-3-flash-preview
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        maxOutputTokens: 1024, 
        temperature: 0.1, 
      },
    });

    const text = response.text || "KTT";
    
    // Trích xuất sources
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((chunk) => {
        if (chunk.web) {
          return { title: chunk.web.title || "Nguồn tham khảo", uri: chunk.web.uri };
        }
        return null;
      })
      .filter((item) => item !== null);

    return res.status(200).json({ text, sources });

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}