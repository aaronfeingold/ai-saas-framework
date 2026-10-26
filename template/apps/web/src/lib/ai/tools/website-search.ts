// Website Search Tool using Perplexity API
import { tool } from 'ai';
import { z } from 'zod';

export const websiteSearchTool = tool({
  description:
    'Search the web for current information and real-time data. Use this tool when you need up-to-date information that might not be in your training data.',
  parameters: z.object({
    query: z
      .string()
      .describe('The search query to find current information on the web'),
  }),
  execute: async ({ query }) => {
    try {
      // Use Perplexity API for web search if available
      if (process.env.PERPLEXITY_API_KEY) {
        const response = await fetch(
          'https://api.perplexity.ai/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'llama-3.1-sonar-small-128k-online',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a helpful assistant that searches the web for current information. Provide concise, accurate information with sources when possible.',
                },
                {
                  role: 'user',
                  content: `Search for current information about: ${query}`,
                },
              ],
              max_tokens: 1000,
              temperature: 0.2,
              return_citations: true,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Perplexity API error: ${response.statusText}`);
        }

        const data = await response.json();
        const searchResult =
          data.choices[0]?.message?.content || 'No results found';
        const citations = data.citations || [];

        return {
          query,
          result: searchResult,
          citations,
          source: 'Perplexity AI',
          timestamp: new Date().toISOString(),
        };
      }

      // Fallback: Use a simple search API or return a message
      return {
        query,
        result: `I don't have access to real-time web search capabilities at the moment. For the most current information about "${query}", I recommend checking recent news sources, official websites, or search engines directly.`,
        citations: [],
        source: 'Assistant Knowledge',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Website search error:', error);

      return {
        query,
        result: `I encountered an error while searching for "${query}". Please try rephrasing your query or search for this information directly using a search engine.`,
        citations: [],
        source: 'Error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
