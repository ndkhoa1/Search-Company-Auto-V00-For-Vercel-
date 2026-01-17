import { CompanyData, Source } from "../types";

// Helper function for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const searchCompanyInfo = async (companyName: string): Promise<CompanyData> => {
  let retries = 0;
  const maxRetries = 3;

  while (true) {
    try {
      // GỌI API VERCEL THAY VÌ GỌI TRỰC TIẾP SDK
      // Việc này giúp bảo mật API Key (Key nằm trên server, không lộ ở browser)
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companyName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const text = data.text || "KTT";
      const sources: Source[] = data.sources || [];

      // --- Logic xử lý kết quả (Giữ nguyên Regex parsing ở Client) ---
      
      // Regex linh hoạt bắt MST
      const mstMatch = text.match(/(?:MST|Mã số thuế|Tax Code)(?:\*\*|):?\s*([0-9-]+)/i);
      
      // Regex linh hoạt bắt Domain
      const domainMatch = text.match(/(?:DOMAIN|Website|Trang web)(?:\*\*|):?\s*(@?[\w.-]+\.[\w]+|https?:\/\/[^\s]+)/i);
      
      let cleanDomain = domainMatch ? domainMatch[1].trim() : "Không tìm thấy";
      
      // Xử lý chuẩn hóa Domain
      if (cleanDomain !== "Không tìm thấy" && cleanDomain !== "KTT") {
          cleanDomain = cleanDomain.replace(/^(https?:\/\/)?(www\.)?/, '');
          cleanDomain = cleanDomain.replace(/\/$/, '');
          if (!cleanDomain.startsWith('@') && cleanDomain.includes('.')) {
              cleanDomain = `@${cleanDomain}`;
          }
          if (!cleanDomain.includes('.')) cleanDomain = "Không tìm thấy";
      } else {
        cleanDomain = "Không tìm thấy";
      }

      let cleanTaxCode = mstMatch ? mstMatch[1].trim() : "Đang cập nhật";
      if (cleanTaxCode === "KTT") cleanTaxCode = "Đang cập nhật";
      
      return {
        companyName: companyName, 
        taxCode: cleanTaxCode,
        domain: cleanDomain,
        summary: text, 
        sources: sources,
      };

    } catch (error: any) {
      const msg = error.message?.toLowerCase() || "";
      // Xử lý retry khi server quá tải hoặc lỗi mạng
      const isQuotaError = msg.includes("500") || msg.includes("503") || msg.includes("429") || msg.includes("overloaded") || msg.includes("quota");

      if (isQuotaError && retries < maxRetries) {
        retries++;
        // Giữ nguyên logic delay cũ
        const delay = 2000 * Math.pow(2, retries - 1);
        console.warn(`API Busy. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
        await wait(delay);
        continue;
      }
      
      console.error("Search Service Error:", error);
      throw new Error(error.message || "Lỗi tìm kiếm.");
    }
  }
};