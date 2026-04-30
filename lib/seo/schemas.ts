import { Type, type Schema } from "@google/genai";

export const issueSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    priority: { type: Type.STRING, enum: ["Critical", "High", "Medium", "Low"] },
    category: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    recommendation: { type: Type.STRING },
    effort: { type: Type.STRING, enum: ["low", "medium", "high"] },
  },
  required: ["priority", "category", "title", "description", "recommendation"],
  propertyOrdering: ["priority", "category", "title", "description", "recommendation", "effort"],
};

export const findingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    status: { type: Type.STRING, enum: ["pass", "warn", "fail"] },
    detail: { type: Type.STRING },
  },
  required: ["label", "status"],
  propertyOrdering: ["label", "status", "detail"],
};

export const categoryReportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    status: { type: Type.STRING, enum: ["pass", "warn", "fail"] },
    summary: { type: Type.STRING },
    findings: { type: Type.ARRAY, items: findingSchema },
    issues: { type: Type.ARRAY, items: issueSchema },
  },
  required: ["score", "status", "summary", "findings", "issues"],
  propertyOrdering: ["score", "status", "summary", "findings", "issues"],
};

export const eeatBreakdownSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    Experience: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        signals: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["score", "signals"],
      propertyOrdering: ["score", "signals"],
    },
    Expertise: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        signals: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["score", "signals"],
      propertyOrdering: ["score", "signals"],
    },
    Authoritativeness: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        signals: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["score", "signals"],
      propertyOrdering: ["score", "signals"],
    },
    Trustworthiness: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        signals: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["score", "signals"],
      propertyOrdering: ["score", "signals"],
    },
  },
  required: ["Experience", "Expertise", "Authoritativeness", "Trustworthiness"],
  propertyOrdering: ["Experience", "Expertise", "Authoritativeness", "Trustworthiness"],
};

export const contentReportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    status: { type: Type.STRING, enum: ["pass", "warn", "fail"] },
    summary: { type: Type.STRING },
    findings: { type: Type.ARRAY, items: findingSchema },
    issues: { type: Type.ARRAY, items: issueSchema },
    eeat: eeatBreakdownSchema,
    aiCitationReadiness: { type: Type.INTEGER },
  },
  required: ["score", "status", "summary", "findings", "issues", "eeat", "aiCitationReadiness"],
  propertyOrdering: ["score", "status", "summary", "findings", "issues", "eeat", "aiCitationReadiness"],
};

export const schemaReportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    status: { type: Type.STRING, enum: ["pass", "warn", "fail"] },
    summary: { type: Type.STRING },
    findings: { type: Type.ARRAY, items: findingSchema },
    issues: { type: Type.ARRAY, items: issueSchema },
    detected: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["score", "status", "summary", "findings", "issues", "detected", "suggestions"],
  propertyOrdering: ["score", "status", "summary", "findings", "issues", "detected", "suggestions"],
};

export const industryDetectionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    industry: {
      type: Type.STRING,
      enum: ["SaaS", "Local Service", "E-commerce", "Publisher", "Agency", "Other"],
    },
    confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
    signals: { type: Type.ARRAY, items: { type: Type.STRING } },
    pageType: { type: Type.STRING },
  },
  required: ["industry", "confidence", "signals", "pageType"],
  propertyOrdering: ["industry", "confidence", "signals", "pageType"],
};

// Architecture report schema (marketingskills/site-architecture)
const architectureNodeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    label: { type: Type.STRING },
    url: { type: Type.STRING },
    level: { type: Type.INTEGER },
    navZone: { type: Type.STRING, enum: ["header", "footer", "sidebar", "contextual", "orphan"] },
    children: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          url: { type: Type.STRING },
          level: { type: Type.INTEGER },
          navZone: { type: Type.STRING, enum: ["header", "footer", "sidebar", "contextual", "orphan"] },
        },
        required: ["label", "url", "level", "navZone"],
        propertyOrdering: ["label", "url", "level", "navZone"],
      },
    },
  },
  required: ["label", "url", "level", "navZone"],
  propertyOrdering: ["label", "url", "level", "navZone", "children"],
};

export const architectureReportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.INTEGER },
    summary: { type: Type.STRING },
    detectedHierarchy: { type: Type.ARRAY, items: architectureNodeSchema },
    asciiTree: { type: Type.STRING },
    mermaid: { type: Type.STRING },
    urlMap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          page: { type: Type.STRING },
          url: { type: Type.STRING },
          parent: { type: Type.STRING },
          navLocation: { type: Type.STRING },
          priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
        },
        required: ["page", "url", "parent", "navLocation", "priority"],
        propertyOrdering: ["page", "url", "parent", "navLocation", "priority"],
      },
    },
    navigation: {
      type: Type.OBJECT,
      properties: {
        header: {
          type: Type.OBJECT,
          properties: {
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
            ctaLabel: { type: Type.STRING },
            itemCount: { type: Type.INTEGER },
            itemsWithinRule: { type: Type.BOOLEAN },
          },
          required: ["items", "itemCount", "itemsWithinRule"],
          propertyOrdering: ["items", "ctaLabel", "itemCount", "itemsWithinRule"],
        },
        footer: {
          type: Type.OBJECT,
          properties: {
            columns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  links: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["title", "links"],
                propertyOrdering: ["title", "links"],
              },
            },
          },
          required: ["columns"],
          propertyOrdering: ["columns"],
        },
        breadcrumbs: {
          type: Type.OBJECT,
          properties: {
            present: { type: Type.BOOLEAN },
            mirrorsUrl: { type: Type.BOOLEAN },
            notes: { type: Type.STRING },
          },
          required: ["present", "mirrorsUrl", "notes"],
          propertyOrdering: ["present", "mirrorsUrl", "notes"],
        },
      },
      required: ["header", "footer", "breadcrumbs"],
      propertyOrdering: ["header", "footer", "breadcrumbs"],
    },
    internalLinking: {
      type: Type.OBJECT,
      properties: {
        hubs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              hub: { type: Type.STRING },
              spokes: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["hub", "spokes"],
            propertyOrdering: ["hub", "spokes"],
          },
        },
        orphanRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
        crossSectionOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
        linksPer1000WordsObserved: { type: Type.STRING },
      },
      required: ["hubs", "orphanRisks", "crossSectionOpportunities", "linksPer1000WordsObserved"],
      propertyOrdering: ["hubs", "orphanRisks", "crossSectionOpportunities", "linksPer1000WordsObserved"],
    },
    urlAudit: {
      type: Type.OBJECT,
      properties: {
        findings: { type: Type.ARRAY, items: findingSchema },
        issues: { type: Type.ARRAY, items: issueSchema },
      },
      required: ["findings", "issues"],
      propertyOrdering: ["findings", "issues"],
    },
    issues: { type: Type.ARRAY, items: issueSchema },
  },
  required: [
    "overallScore",
    "summary",
    "detectedHierarchy",
    "asciiTree",
    "mermaid",
    "urlMap",
    "navigation",
    "internalLinking",
    "urlAudit",
    "issues",
  ],
  propertyOrdering: [
    "overallScore",
    "summary",
    "detectedHierarchy",
    "asciiTree",
    "mermaid",
    "urlMap",
    "navigation",
    "internalLinking",
    "urlAudit",
    "issues",
  ],
};

// Programmatic SEO report schema (marketingskills/programmatic-seo)
export const programmaticReportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recommendedPlaybook: { type: Type.STRING },
    alternativePlaybooks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, rationale: { type: Type.STRING } },
        required: ["name", "rationale"],
        propertyOrdering: ["name", "rationale"],
      },
    },
    patternAnalysis: {
      type: Type.OBJECT,
      properties: {
        keywordPattern: { type: Type.STRING },
        variables: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              example: { type: Type.STRING },
              sourceTier: { type: Type.INTEGER },
            },
            required: ["name", "example", "sourceTier"],
            propertyOrdering: ["name", "example", "sourceTier"],
          },
        },
        estimatedUniqueCombinations: { type: Type.STRING },
        searchIntentSummary: { type: Type.STRING },
      },
      required: ["keywordPattern", "variables", "estimatedUniqueCombinations", "searchIntentSummary"],
      propertyOrdering: ["keywordPattern", "variables", "estimatedUniqueCombinations", "searchIntentSummary"],
    },
    pageTemplate: {
      type: Type.OBJECT,
      properties: {
        urlPattern: { type: Type.STRING },
        titleTemplate: { type: Type.STRING },
        metaDescriptionTemplate: { type: Type.STRING },
        h1Template: { type: Type.STRING },
        sections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              heading: { type: Type.STRING },
              purpose: { type: Type.STRING },
              uniquenessSource: { type: Type.STRING },
            },
            required: ["heading", "purpose", "uniquenessSource"],
            propertyOrdering: ["heading", "purpose", "uniquenessSource"],
          },
        },
        schemaJsonLd: { type: Type.STRING },
        sampleRenderedPage: {
          type: Type.OBJECT,
          properties: {
            url: { type: Type.STRING },
            title: { type: Type.STRING },
            metaDescription: { type: Type.STRING },
            h1: { type: Type.STRING },
          },
          required: ["url", "title", "metaDescription", "h1"],
          propertyOrdering: ["url", "title", "metaDescription", "h1"],
        },
      },
      required: ["urlPattern", "titleTemplate", "metaDescriptionTemplate", "h1Template", "sections", "schemaJsonLd", "sampleRenderedPage"],
      propertyOrdering: ["urlPattern", "titleTemplate", "metaDescriptionTemplate", "h1Template", "sections", "schemaJsonLd", "sampleRenderedPage"],
    },
    internalLinkingPlan: {
      type: Type.OBJECT,
      properties: {
        hubPage: { type: Type.STRING },
        spokePattern: { type: Type.STRING },
        crossLinkRules: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["hubPage", "spokePattern", "crossLinkRules"],
      propertyOrdering: ["hubPage", "spokePattern", "crossLinkRules"],
    },
    indexationStrategy: {
      type: Type.OBJECT,
      properties: {
        sitemapStrategy: { type: Type.STRING },
        noindexCriteria: { type: Type.STRING },
        crawlBudgetNotes: { type: Type.STRING },
      },
      required: ["sitemapStrategy", "noindexCriteria", "crawlBudgetNotes"],
      propertyOrdering: ["sitemapStrategy", "noindexCriteria", "crawlBudgetNotes"],
    },
    dataRequirements: {
      type: Type.OBJECT,
      properties: {
        proprietaryDataNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
        publicDataAcceptable: { type: Type.ARRAY, items: { type: Type.STRING } },
        refreshCadence: { type: Type.STRING },
      },
      required: ["proprietaryDataNeeded", "publicDataAcceptable", "refreshCadence"],
      propertyOrdering: ["proprietaryDataNeeded", "publicDataAcceptable", "refreshCadence"],
    },
    thinContentRiskScore: { type: Type.INTEGER },
    qualityChecklist: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          check: { type: Type.STRING },
          status: { type: Type.STRING, enum: ["pass", "warn", "fail"] },
          detail: { type: Type.STRING },
        },
        required: ["check", "status"],
        propertyOrdering: ["check", "status", "detail"],
      },
    },
    estimatedPageCount: {
      type: Type.OBJECT,
      properties: {
        realistic: { type: Type.INTEGER },
        aspirational: { type: Type.INTEGER },
        rationale: { type: Type.STRING },
      },
      required: ["realistic", "aspirational", "rationale"],
      propertyOrdering: ["realistic", "aspirational", "rationale"],
    },
    issues: { type: Type.ARRAY, items: issueSchema },
    summary: { type: Type.STRING },
  },
  required: [
    "recommendedPlaybook",
    "alternativePlaybooks",
    "patternAnalysis",
    "pageTemplate",
    "internalLinkingPlan",
    "indexationStrategy",
    "dataRequirements",
    "thinContentRiskScore",
    "qualityChecklist",
    "estimatedPageCount",
    "issues",
    "summary",
  ],
  propertyOrdering: [
    "recommendedPlaybook",
    "alternativePlaybooks",
    "patternAnalysis",
    "pageTemplate",
    "internalLinkingPlan",
    "indexationStrategy",
    "dataRequirements",
    "thinContentRiskScore",
    "qualityChecklist",
    "estimatedPageCount",
    "issues",
    "summary",
  ],
};

export const pageReportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    scores: {
      type: Type.OBJECT,
      properties: {
        onPage: { type: Type.INTEGER },
        content: { type: Type.INTEGER },
        technical: { type: Type.INTEGER },
        schema: { type: Type.INTEGER },
        images: { type: Type.INTEGER },
      },
      required: ["onPage", "content", "technical", "schema", "images"],
      propertyOrdering: ["onPage", "content", "technical", "schema", "images"],
    },
    issues: { type: Type.ARRAY, items: issueSchema },
    schemaSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["summary", "scores", "issues", "schemaSuggestions"],
  propertyOrdering: ["summary", "scores", "issues", "schemaSuggestions"],
};
