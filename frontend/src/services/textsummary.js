import OpenAI from "openai";

class ChatService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: import.meta.env.VITE_OPENAI_GITHUB_KEY,
      baseURL: import.meta.env.VITE_OPENAI_BASE_URL,
      dangerouslyAllowBrowser: true 
    });
  }

  async sendMessage(messages) {
    try {
      const systemMessage = {
        role: "system",
        content: `You are an advanced medical AI assistant specializing in general healthcare and diagnostics. 
                  
                  Your capabilities include:
                  - Providing preventative health advice tailored to the user's profile
                  - Generating structured medical reports based on conversations
                  
                  When generating diagnosis reports:
                  - Structure them with clear sections (Summary, Observations, Recommendations)
                  - Include a disclaimer about seeking professional medical advice
                  - Base insights on the information provided in the conversation
                  
                  
                  
                  Important notes:
                  - Always emphasize the importance of consulting healthcare professionals
                  - Maintain patient privacy and confidentiality
                  - Use clear, accessible language while maintaining medical accuracy
                  - Never claim to provide definitive diagnoses`
      };

      // Format messages for the API
      const formattedMessages = [
        systemMessage,
        ...messages
      ];

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 4096,
        top_p: 1,
      });

      return response;
    } catch (error) {
      console.error('Error with OpenAI API:', error);
      throw new Error('Failed to communicate with the AI service');
    }
  }
}

export default new ChatService();