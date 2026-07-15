import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini client on the server side with telemetry User-Agent
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

app.use(express.json());

// API route: Extract To-Dos from meeting notes
app.post("/api/extract", async (req, res) => {
  try {
    const { note } = req.body;
    if (!note || typeof note !== "string" || !note.trim()) {
      return res.status(400).json({ error: "메모 내용을 입력해주세요." });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Gemini API Key가 설정되지 않았습니다. Settings > Secrets에서 설정이 필요합니다.",
      });
    }

    const currentDateStr = "2026-07-14"; // Current date in workspace metadata (Tuesday)
    const prompt = `당신은 비정형화된 회의 메모, 낙서, 대화 기록 등에서 실제로 실행해야 하는 할 일(To-Do) 목록을 정확하게 추출하는 전문 AI 비서 'NoteToDone'입니다.

메모의 원래 맥락을 왜곡하거나 임의로 새로운 할 일을 마음대로 지어내지 마십시오(No Hallucination). 회의록이나 메모 내 언급된 할 일들에 대해서만 충실하게 가려내야 합니다.

**[분석 지침]**
1. **기준 날짜**: 오늘 날짜는 **2026-07-14 (화요일)** 입니다. 모든 상대적 날짜(예: "내일", "이번 주말", "다음 주 월요일", "오늘 중")는 이 기준 날짜를 근거로 날짜(YYYY-MM-DD)를 계산하십시오.
2. **마감일 추출 (Due Date)**:
   - 절대적 날짜: "7/20", "20일", "7월 20일" 등은 "2026-07-20"처럼 구체적인 일자로 매핑합니다.
   - 상대적 날짜:
     - "오늘 중", "오늘까지" -> 2026-07-14
     - "내일까지", "내일 중" -> 2026-07-15
     - "이번 주말" -> 2026-07-18
     - "다음 주 월요일" -> 2026-07-20
   - 대체값 (Fallback): 날짜가 언급되지 않았거나 시기가 불분명한 경우, 기본 마감일로 오늘로부터 3일 뒤인 **2026-07-17**을 지정하십시오. 이때 'isDueDateExtracted' 필드는 반드시 'false'로 지정해 줍니다. 날짜 정보가 감지되었다면 'isDueDateExtracted'는 'true'입니다.
3. **우선순위 추천 (Priority)**:
   - 'High' (상): "급함", "ASAP", "우선", "오늘까지", "중요", "즉시" 등 긴급하거나 중요한 키워드가 담긴 경우.
   - 'Low' (하): "나중에", "여유 있음", "검토만", "참고", "시간 날 때" 등 유연한 일정이 허용된 경우.
   - 'Medium' (중): 별도의 특별한 기한/중요도 텍스트가 없고 일반적 어조인 경우(기본값).
4. **할 일 텍스트 가공**:
   - 기호 규칙(예: - 로 시작하는 할 일 목록 등)이나 자연어 서술어(예: "~하기", "~확인 필요", "~전달")를 분석하여, 명사형/동사형 중심의 직관적이고 간결한 제목으로 추출하십시오.

**[분석 대상 메모]**
"""
${note}
"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            todos: {
              type: Type.ARRAY,
              description: "추출된 할 일 목록",
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: "명사/동사형 중심의 간결한 할 일 제목 (예: '디자인 시안 피드백 작성')",
                  },
                  dueDate: {
                    type: Type.STRING,
                    description: "YYYY-MM-DD 형식의 마감 날짜",
                  },
                  dueDateExplanation: {
                    type: Type.STRING,
                    description: "추천 마감일 설정 이유 설명 (예: '내일까지 기한 언급 반영' 또는 '기한 감지 불가로 기본값 3일 뒤 설정')",
                  },
                  isDueDateExtracted: {
                    type: Type.BOOLEAN,
                    description: "메모 내에 날짜/시기 표현이 명시적으로 있어 마감일을 추출해낸 경우 true, 날짜 정보가 없어 기본 3일 뒤로 지정한 경우 false",
                  },
                  priority: {
                    type: Type.STRING,
                    description: "우선순위 추천 단계: 'High', 'Medium', 'Low'",
                  },
                  priorityExplanation: {
                    type: Type.STRING,
                    description: "우선순위가 결정된 배경 설명 (예: '급함 키워드 검출로 상 선정')",
                  },
                },
                required: [
                  "title",
                  "dueDate",
                  "dueDateExplanation",
                  "isDueDateExtracted",
                  "priority",
                  "priorityExplanation",
                ],
              },
            },
          },
          required: ["todos"],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini에서 유효한 응답을 생성하지 못했습니다.");
    }

    const data = JSON.parse(text);
    return res.json(data);
  } catch (error: any) {
    console.error("AI Extraction Error:", error);
    return res.status(500).json({
      error: "메모에서 할 일을 추출하는 중 오류가 발생했습니다.",
      details: error.message,
    });
  }
});

// Configure Vite integration or Static delivery
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NoteToDone server is running on http://localhost:${PORT}`);
  });
}

startServer();
