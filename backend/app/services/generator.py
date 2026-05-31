import json
from itertools import cycle

from langchain_core.messages import BaseMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.config import Settings
from app.models.domain import GeneratedQuestion, GeneratedQuestionList, InterviewQuestion

CATEGORIES = ["technical", "project", "experience", "behavioral", "scenario"]
DIFFICULTIES = ["junior", "mid", "senior"]


class QuestionGenerationResult:
    def __init__(self, questions: list[InterviewQuestion], source: str) -> None:
        self.questions = questions
        self.source = source


def _extract_focus_terms(resume_text: str) -> list[str]:
    words = []
    seen = set()
    for raw_word in resume_text.replace("/", " ").replace(",", " ").split():
        word = raw_word.strip(".()[]{}:;|+-*_#`\"'")
        if len(word) < 4:
            continue
        key = word.lower()
        if key in seen:
            continue
        seen.add(key)
        words.append(word)
        if len(words) >= 24:
            break
    return words or ["项目经验", "技术能力", "沟通协作", "问题解决"]


def _mock_questions(resume_text: str, count: int) -> list[InterviewQuestion]:
    terms = _extract_focus_terms(resume_text)
    category_cycle = cycle(CATEGORIES)
    difficulty_cycle = cycle(DIFFICULTIES)
    templates = [
        "请结合你的简历，详细说明你在 {term} 方面最有代表性的实践经历。",
        "在与 {term} 相关的项目中，你遇到过哪些关键挑战？你是如何解决的？",
        "如果让你重新设计简历中提到的 {term} 方案，你会优先改进哪三点？",
        "请举例说明你如何衡量 {term} 相关工作的结果和业务价值。",
        "面试官追问 {term} 的底层原理时，你会如何解释给非技术同事？",
    ]
    answer_templates = [
        "参考回答：我会先说明自己在 {term} 相关工作中的具体职责，再补充使用的方法、遇到的挑战和最终结果。回答时应尽量引用简历中的项目背景和可量化成果，避免泛泛而谈。",
        "参考回答：可以按“背景、挑战、行动、结果”的结构回答。重点说明 {term} 相关问题为什么重要、自己如何拆解问题、采取了哪些取舍，以及最终对项目或团队产生了什么影响。",
        "参考回答：我会优先从可维护性、性能或协作效率三个角度复盘 {term} 方案。先指出原方案的优点，再说明如果重做会如何设计边界、验证效果并降低风险。",
        "参考回答：衡量 {term} 的价值时，可以结合交付效率、稳定性、用户体验或业务指标。回答时最好给出指标变化、反馈来源，以及自己在其中负责的具体动作。",
        "参考回答：向非技术同事解释 {term} 时，我会使用业务场景类比，先讲它解决了什么问题，再讲为什么这种方案更可靠或更高效，最后说明它对结果的影响。",
    ]
    questions: list[InterviewQuestion] = []
    for index in range(count):
        term = terms[index % len(terms)]
        template_index = index % len(templates)
        template = templates[template_index]
        questions.append(
            InterviewQuestion(
                question_text=f"{index + 1}. {template.format(term=term)}",
                category=next(category_cycle),
                difficulty=next(difficulty_cycle),
                focus_area=term,
                reference_answer=answer_templates[template_index].format(term=term),
            )
        )
    return questions


def _normalize_count(count: int) -> int:
    return min(100, max(50, count))


def _message_content_text(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts)
    return str(content)


def _strip_json_fence(content: str) -> str:
    text = content.strip()
    if text.startswith("```json"):
        text = text.removeprefix("```json").strip()
    elif text.startswith("```"):
        text = text.removeprefix("```").strip()
    if text.endswith("```"):
        text = text.removesuffix("```").strip()
    return text


def _parse_generated_questions(content: str) -> list[GeneratedQuestion]:
    payload = json.loads(_strip_json_fence(content))
    if isinstance(payload, list):
        payload = {"questions": payload}
    parsed = GeneratedQuestionList.model_validate(payload)
    return parsed.questions


async def generate_questions(resume_text: str, settings: Settings, count: int = 75) -> QuestionGenerationResult:
    target_count = _normalize_count(count)
    if not settings.deepseek_api_key:
        return QuestionGenerationResult(_mock_questions(resume_text, target_count), "mock")

    llm = ChatOpenAI(
        model=settings.deepseek_model,
        base_url=settings.deepseek_base_url,
        api_key=settings.deepseek_api_key,
        temperature=0.45,
        max_tokens=8192,
        extra_body={
            "thinking": {"type": "disabled"},
        },
    )
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                "你是一位资深技术面试官。请仅根据候选人的简历内容生成 {count} 个中文面试题。"
                "题目需要覆盖技术能力、项目经历、行为面试、场景题和经验深挖。"
                "每个问题必须同时给出 reference_answer 参考回答。参考回答要基于简历内容，使用 3 到 6 句中文说明可参考的回答思路，不要编造简历中不存在的经历。"
                "不要编造简历中不存在的经历。"
                "必须只返回合法 JSON，不要返回 Markdown，不要返回解释文字。"
                "JSON 格式必须是："
                '{{"questions":[{{"question_text":"问题文本","category":"technical|behavioral|project|experience|scenario","difficulty":"junior|mid|senior","focus_area":"考察点","reference_answer":"参考回答"}}]}}。',
            ),
            ("human", "--- 简历内容 ---\n{resume_text}"),
        ]
    )
    messages = await prompt.ainvoke({"resume_text": resume_text[:24000], "count": target_count})
    response = await llm.ainvoke(
        messages,
        response_format={"type": "json_object"},
    )
    generated = _parse_generated_questions(_message_content_text(response))[:100]

    if len(generated) < 50:
        fallback = _mock_questions(resume_text, 50 - len(generated))
        questions = [
            InterviewQuestion(
                question_text=item.question_text,
                category=item.category,
                difficulty=item.difficulty,
                focus_area=item.focus_area,
                reference_answer=item.reference_answer,
            )
            for item in generated
        ] + fallback
    else:
        questions = [
            InterviewQuestion(
                question_text=item.question_text,
                category=item.category,
                difficulty=item.difficulty,
                focus_area=item.focus_area,
                reference_answer=item.reference_answer,
            )
            for item in generated
        ]
    return QuestionGenerationResult(questions, "deepseek")
