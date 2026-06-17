// JSON schemas for Nuclia answer_json_schema structured generation.

export const comparisonSchema = {
  name: 'comparison_matrix',
  description: 'A structured comparison matrix of the leading options, approaches, or entities across dimensions, grounded in the knowledge base.',
  parameters: {
    type: 'object',
    properties: {
      dimensions: { type: 'array', items: { type: 'string' }, description: 'The comparison dimensions/criteria.' },
      vendors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            ratings: {
              type: 'array',
              items: { type: 'object', properties: { dimension: { type: 'string' }, assessment: { type: 'string' } }, required: ['dimension', 'assessment'] },
            },
          },
          required: ['name', 'ratings'],
        },
      },
    },
    required: ['dimensions', 'vendors'],
  },
};

export const briefingSchema = {
  name: 'research_briefing',
  description: 'An executive research briefing grounded in the knowledge base.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      executive_summary: { type: 'string' },
      sections: { type: 'array', items: { type: 'object', properties: { heading: { type: 'string' }, content: { type: 'string' } }, required: ['heading', 'content'] } },
      key_takeaways: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'executive_summary', 'sections', 'key_takeaways'],
  },
};

export const quizSchema = {
  name: 'assessment_quiz',
  description: 'A multiple-choice assessment generated from the knowledge base.',
  parameters: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, description: 'Exactly four options.' },
            correct_index: { type: 'integer', description: '0-based index of the correct option.' },
            explanation: { type: 'string' },
            topic: { type: 'string' },
          },
          required: ['question', 'options', 'correct_index', 'explanation'],
        },
      },
    },
    required: ['questions'],
  },
};

export interface ComparisonOut { dimensions: string[]; vendors: { name: string; ratings: { dimension: string; assessment: string }[] }[] }
export interface BriefingOut { title: string; executive_summary: string; sections: { heading: string; content: string }[]; key_takeaways: string[] }
export interface QuizOut { questions: { question: string; options: string[]; correct_index: number; explanation: string; topic?: string }[] }
