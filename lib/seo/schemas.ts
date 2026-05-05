import type { JsonSchema } from "./glm";

export const issueSchema: JsonSchema = {
  type: "object",
  properties: {
    priority: { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
    category: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    recommendation: { type: "string" },
    effort: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["priority", "category", "title", "description", "recommendation"],
};

export const findingSchema: JsonSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    status: { type: "string", enum: ["pass", "warn", "fail"] },
    detail: { type: "string" },
  },
  required: ["label", "status"],
};

export const categoryReportSchema: JsonSchema = {
  type: "object",
  properties: {
    score: { type: "integer" },
    status: { type: "string", enum: ["pass", "warn", "fail"] },
    summary: { type: "string" },
    findings: { type: "array", items: findingSchema },
    issues: { type: "array", items: issueSchema },
  },
  required: ["score", "status", "summary", "findings", "issues"],
};

export const eeatBreakdownSchema: JsonSchema = {
  type: "object",
  properties: {
    Experience: {
      type: "object",
      properties: {
        score: { type: "integer" },
        signals: { type: "array", items: { type: "string" } },
      },
      required: ["score", "signals"],
    },
    Expertise: {
      type: "object",
      properties: {
        score: { type: "integer" },
        signals: { type: "array", items: { type: "string" } },
      },
      required: ["score", "signals"],
    },
    Authoritativeness: {
      type: "object",
      properties: {
        score: { type: "integer" },
        signals: { type: "array", items: { type: "string" } },
      },
      required: ["score", "signals"],
    },
    Trustworthiness: {
      type: "object",
      properties: {
        score: { type: "integer" },
        signals: { type: "array", items: { type: "string" } },
      },
      required: ["score", "signals"],
    },
  },
  required: ["Experience", "Expertise", "Authoritativeness", "Trustworthiness"],
};

export const contentReportSchema: JsonSchema = {
  type: "object",
  properties: {
    score: { type: "integer" },
    status: { type: "string", enum: ["pass", "warn", "fail"] },
    summary: { type: "string" },
    findings: { type: "array", items: findingSchema },
    issues: { type: "array", items: issueSchema },
    eeat: eeatBreakdownSchema,
    aiCitationReadiness: { type: "integer" },
  },
  required: ["score", "status", "summary", "findings", "issues", "eeat", "aiCitationReadiness"],
};

export const schemaReportSchema: JsonSchema = {
  type: "object",
  properties: {
    score: { type: "integer" },
    status: { type: "string", enum: ["pass", "warn", "fail"] },
    summary: { type: "string" },
    findings: { type: "array", items: findingSchema },
    issues: { type: "array", items: issueSchema },
    detected: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["score", "status", "summary", "findings", "issues", "detected", "suggestions"],
};

export const industryDetectionSchema: JsonSchema = {
  type: "object",
  properties: {
    industry: {
      type: "string",
      enum: ["SaaS", "Local Service", "E-commerce", "Publisher", "Agency", "Other"],
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    signals: { type: "array", items: { type: "string" } },
    pageType: { type: "string" },
  },
  required: ["industry", "confidence", "signals", "pageType"],
};

const architectureNodeSchema: JsonSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    url: { type: "string" },
    level: { type: "integer" },
    navZone: { type: "string", enum: ["header", "footer", "sidebar", "contextual", "orphan"] },
    children: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          url: { type: "string" },
          level: { type: "integer" },
          navZone: { type: "string", enum: ["header", "footer", "sidebar", "contextual", "orphan"] },
        },
        required: ["label", "url", "level", "navZone"],
      },
    },
  },
  required: ["label", "url", "level", "navZone"],
};

export const architectureReportSchema: JsonSchema = {
  type: "object",
  properties: {
    overallScore: { type: "integer" },
    summary: { type: "string" },
    detectedHierarchy: { type: "array", items: architectureNodeSchema },
    asciiTree: { type: "string" },
    mermaid: { type: "string" },
    urlMap: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page: { type: "string" },
          url: { type: "string" },
          parent: { type: "string" },
          navLocation: { type: "string" },
          priority: { type: "string", enum: ["High", "Medium", "Low"] },
        },
        required: ["page", "url", "parent", "navLocation", "priority"],
      },
    },
    navigation: {
      type: "object",
      properties: {
        header: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "string" } },
            ctaLabel: { type: "string" },
            itemCount: { type: "integer" },
            itemsWithinRule: { type: "boolean" },
          },
          required: ["items", "itemCount", "itemsWithinRule"],
        },
        footer: {
          type: "object",
          properties: {
            columns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  links: { type: "array", items: { type: "string" } },
                },
                required: ["title", "links"],
              },
            },
          },
          required: ["columns"],
        },
        breadcrumbs: {
          type: "object",
          properties: {
            present: { type: "boolean" },
            mirrorsUrl: { type: "boolean" },
            notes: { type: "string" },
          },
          required: ["present", "mirrorsUrl", "notes"],
        },
      },
      required: ["header", "footer", "breadcrumbs"],
    },
    internalLinking: {
      type: "object",
      properties: {
        hubs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              hub: { type: "string" },
              spokes: { type: "array", items: { type: "string" } },
            },
            required: ["hub", "spokes"],
          },
        },
        orphanRisks: { type: "array", items: { type: "string" } },
        crossSectionOpportunities: { type: "array", items: { type: "string" } },
        linksPer1000WordsObserved: { type: "string" },
      },
      required: ["hubs", "orphanRisks", "crossSectionOpportunities", "linksPer1000WordsObserved"],
    },
    urlAudit: {
      type: "object",
      properties: {
        findings: { type: "array", items: findingSchema },
        issues: { type: "array", items: issueSchema },
      },
      required: ["findings", "issues"],
    },
    issues: { type: "array", items: issueSchema },
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
};

export const programmaticReportSchema: JsonSchema = {
  type: "object",
  properties: {
    recommendedPlaybook: { type: "string" },
    alternativePlaybooks: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, rationale: { type: "string" } },
        required: ["name", "rationale"],
      },
    },
    patternAnalysis: {
      type: "object",
      properties: {
        keywordPattern: { type: "string" },
        variables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              example: { type: "string" },
              sourceTier: { type: "integer" },
            },
            required: ["name", "example", "sourceTier"],
          },
        },
        estimatedUniqueCombinations: { type: "string" },
        searchIntentSummary: { type: "string" },
      },
      required: ["keywordPattern", "variables", "estimatedUniqueCombinations", "searchIntentSummary"],
    },
    pageTemplate: {
      type: "object",
      properties: {
        urlPattern: { type: "string" },
        titleTemplate: { type: "string" },
        metaDescriptionTemplate: { type: "string" },
        h1Template: { type: "string" },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              heading: { type: "string" },
              purpose: { type: "string" },
              uniquenessSource: { type: "string" },
            },
            required: ["heading", "purpose", "uniquenessSource"],
          },
        },
        schemaJsonLd: { type: "string" },
        sampleRenderedPage: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            metaDescription: { type: "string" },
            h1: { type: "string" },
          },
          required: ["url", "title", "metaDescription", "h1"],
        },
      },
      required: ["urlPattern", "titleTemplate", "metaDescriptionTemplate", "h1Template", "sections", "schemaJsonLd", "sampleRenderedPage"],
    },
    internalLinkingPlan: {
      type: "object",
      properties: {
        hubPage: { type: "string" },
        spokePattern: { type: "string" },
        crossLinkRules: { type: "array", items: { type: "string" } },
      },
      required: ["hubPage", "spokePattern", "crossLinkRules"],
    },
    indexationStrategy: {
      type: "object",
      properties: {
        sitemapStrategy: { type: "string" },
        noindexCriteria: { type: "string" },
        crawlBudgetNotes: { type: "string" },
      },
      required: ["sitemapStrategy", "noindexCriteria", "crawlBudgetNotes"],
    },
    dataRequirements: {
      type: "object",
      properties: {
        proprietaryDataNeeded: { type: "array", items: { type: "string" } },
        publicDataAcceptable: { type: "array", items: { type: "string" } },
        refreshCadence: { type: "string" },
      },
      required: ["proprietaryDataNeeded", "publicDataAcceptable", "refreshCadence"],
    },
    thinContentRiskScore: { type: "integer" },
    qualityChecklist: {
      type: "array",
      items: {
        type: "object",
        properties: {
          check: { type: "string" },
          status: { type: "string", enum: ["pass", "warn", "fail"] },
          detail: { type: "string" },
        },
        required: ["check", "status"],
      },
    },
    estimatedPageCount: {
      type: "object",
      properties: {
        realistic: { type: "integer" },
        aspirational: { type: "integer" },
        rationale: { type: "string" },
      },
      required: ["realistic", "aspirational", "rationale"],
    },
    issues: { type: "array", items: issueSchema },
    summary: { type: "string" },
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
};

export const pageReportSchema: JsonSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    scores: {
      type: "object",
      properties: {
        onPage: { type: "integer" },
        content: { type: "integer" },
        technical: { type: "integer" },
        schema: { type: "integer" },
        images: { type: "integer" },
      },
      required: ["onPage", "content", "technical", "schema", "images"],
    },
    issues: { type: "array", items: issueSchema },
    schemaSuggestions: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "scores", "issues", "schemaSuggestions"],
};
