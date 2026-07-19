// JSON schemas for Nuclia answer_json_schema structured generation.
// NOTE: the underlying LLM's strict function-schema validator requires EVERY
// object to set `additionalProperties: false` and list ALL its properties in
// `required` (some KB generative models enforce this; others are lenient — the
// strict form is accepted by both, so we always use it).

export const comparisonSchema = {
  name: 'comparison_matrix',
  description: 'A structured comparison matrix of the leading options, approaches, or entities across dimensions, grounded in the knowledge base.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      dimensions: { type: 'array', items: { type: 'string' }, description: 'The comparison dimensions/criteria.' },
      vendors: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            ratings: {
              type: 'array',
              items: { type: 'object', additionalProperties: false, properties: { dimension: { type: 'string' }, assessment: { type: 'string' } }, required: ['dimension', 'assessment'] },
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
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      executive_summary: { type: 'string' },
      sections: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { heading: { type: 'string' }, content: { type: 'string' } }, required: ['heading', 'content'] } },
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
    additionalProperties: false,
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, description: 'Exactly four options.' },
            correct_index: { type: 'integer', description: '0-based index of the correct option.' },
            explanation: { type: 'string' },
            topic: { type: 'string' },
          },
          required: ['question', 'options', 'correct_index', 'explanation', 'topic'],
        },
      },
    },
    required: ['questions'],
  },
};

export const timelineSchema = {
  name: 'timeline',
  description: 'A chronological timeline of the key events, releases, or milestones found in the knowledge base.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      events: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            date: { type: 'string', description: 'Date or period, e.g. "2024" or "Q3 2025".' },
            title: { type: 'string' },
            detail: { type: 'string' },
          },
          required: ['date', 'title', 'detail'],
        },
      },
    },
    required: ['title', 'events'],
  },
};

export const prosConsSchema = {
  name: 'pros_and_cons',
  description: 'A balanced pro/con analysis of the subject, grounded in the knowledge base.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      subject: { type: 'string' },
      verdict: { type: 'string', description: 'A one-sentence balanced conclusion.' },
      pros: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { point: { type: 'string' }, evidence: { type: 'string' } }, required: ['point', 'evidence'] } },
      cons: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { point: { type: 'string' }, evidence: { type: 'string' } }, required: ['point', 'evidence'] } },
    },
    required: ['subject', 'verdict', 'pros', 'cons'],
  },
};

export const faqSchema = {
  name: 'faq',
  description: 'Frequently asked questions with grounded answers, derived from the knowledge base.',
  parameters: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { question: { type: 'string' }, answer: { type: 'string' } }, required: ['question', 'answer'] } },
    },
    required: ['title', 'items'],
  },
};

export interface TimelineOut { title: string; events: { date: string; title: string; detail: string }[] }
export interface ProsConsOut { subject: string; verdict: string; pros: { point: string; evidence: string }[]; cons: { point: string; evidence: string }[] }
export interface FaqOut { title: string; items: { question: string; answer: string }[] }

export interface ComparisonOut { dimensions: string[]; vendors: { name: string; ratings: { dimension: string; assessment: string }[] }[] }
export interface BriefingOut { title: string; executive_summary: string; sections: { heading: string; content: string }[]; key_takeaways: string[] }
export interface QuizOut { questions: { question: string; options: string[]; correct_index: number; explanation: string; topic?: string }[] }
