const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Punjab Politics API",
      version: "1.0.0",
    },

    servers: [
      {
        url: process.env.SWAGGER_SERVER_URL || "/",
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "John Doe" },
            email: { type: "string", example: "john@example.com" },
            role: {
              type: "string",
              enum: ["USER", "ADMIN", "EDITOR", "AUTHOR", "INVESTOR"],
              example: "USER",
            },
            status: { type: "string", example: "ACTIVE" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Something went wrong" },
          },
        },
        ScheduleItem: {
          type: "object",
          required: ["date", "title"],
          properties: {
            id: { oneOf: [{ type: "string" }, { type: "integer" }], example: "1" },
            date: { type: "string", example: "Sep 05" },
            title: { type: "string", example: "All-Party Meeting on Electoral Reforms" },
          },
        },
        Poll: {
          type: "object",
          properties: {
            question: { type: "string", example: "Should the Winter Session be extended?" },
            options: {
              type: "array",
              minItems: 2,
              maxItems: 2,
              items: {
                type: "object",
                properties: {
                  label: { type: "string", example: "Yes" },
                  votes: { type: "integer", example: 12 },
                  pct: { type: "integer", example: 60 },
                },
              },
            },
            totalVotes: { type: "integer", example: 20 },
          },
        },
        VidhanSabha: {
          type: "object",
          required: ["state", "name", "totalSeats"],
          properties: {
            id: { oneOf: [{ type: "string" }, { type: "integer" }], example: "1" },
            state: { type: "string", example: "Uttar Pradesh" },
            name: { type: "string", example: "Uttar Pradesh Legislative Assembly" },
            totalSeats: { type: "integer", example: 403 },
            chiefMinister: { type: "string", example: "Yogi Adityanath" },
            rulingParty: { type: "string", example: "BJP" },
            speaker: { type: "string", example: "Satish Mahana" },
            oppositionLeader: { type: "string", example: "Leader name" },
            oppositionParty: { type: "string", example: "SP" },
            currentTerm: { type: "string", example: "2022–2027" },
            nextElection: { type: "string", example: "2027" },
            imageUrl: { type: "string", example: "/uploads/vidhan-sabha.jpg" },
            content: { type: "string", description: "Full Vidhan Sabha content (rich text HTML)" },
          },
        },
        PoliticianInput: {
          type: "object",
          required: ["name", "category"],
          properties: {
            name: { type: "string", example: "Politician name" },
            category: { type: "string", enum: ["KEY_FIGURE", "FORMER_PM", "CHIEF_MINISTER", "PARTY_LEADER"] },
            photo_url: { type: "string", example: "https://example.com/photo.jpg" },
            party: { type: "string", example: "BJP" },
            state: { type: "string", example: "Uttar Pradesh" },
            current_position: { type: "string", example: "Chief Minister" },
            education: { type: "array", items: { type: "string" } },
            career_timeline: { type: "array", items: { type: "string" } },
            bio: { type: "array", items: { type: "string" } },
          },
        },
        PartyInput: {
          type: "object",
          required: ["name", "abbreviation"],
          properties: {
            name: { type: "string", example: "Bharatiya Janata Party" },
            abbreviation: { type: "string", example: "BJP" },
            photo_url: { type: "string", example: "https://example.com/logo.png" },
            founded_year: { type: "integer", example: 1980 },
            ideology: { type: "string" },
            history: { type: "string" },
          },
        },
        StateInput: {
          type: "object",
          required: ["name", "kind"],
          properties: {
            name: { type: "string", example: "Uttar Pradesh" },
            kind: { type: "string", enum: ["STATE", "UNION_TERRITORY"] },
            capital: { type: "string", example: "Lucknow" },
            formed: { type: "string", example: "24 January 1950" },
            history: { type: "string" },
            achievements: { type: "string" },
          },
        },
      },
    },
  },

  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
