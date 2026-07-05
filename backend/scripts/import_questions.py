"""
Import interview questions from markdown files into MongoDB.

Usage:
    .venv/Scripts/python -m scripts.import_questions --dir D:/xiao/projects/dailly-prompt/面试
    .venv/Scripts/python -m scripts.import_questions --dir ./面试 --ai-enrich
"""

import argparse
import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from motor.motor_asyncio import AsyncIOMotorClient
from app.models.domain import QuestionBankItem, QuestionBankTopic

# ── config ──────────────────────────────────────────────────
MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = "echomind"
DIR_HELP = "Path to directory containing .md question bank files"


# ── parsers ─────────────────────────────────────────────────

def parse_format_a(text: str, source_file: str) -> list[tuple[str, str]]:
    """Format A: numbered list with sub-bullet answers.

    ## 主题名
    1. 问题？
       - 答案
    2. 问题？
       - 答案
    """
    results: list[tuple[str, str]] = []
    # Match: optional "N." or "N、" or "N." at start of line
    pattern = re.compile(r"^(?:\d+)[.、．]\s*(.+?)$", re.MULTILINE)
    lines = text.split("\n")
    current_question = None
    current_answer_parts: list[str] = []

    for line in lines:
        stripped = line.strip()
        m = pattern.match(stripped)
        if m:
            # Save previous
            if current_question:
                answer = " ".join(current_answer_parts).strip()
                results.append((current_question, answer))
            current_question = m.group(1)
            current_answer_parts = []
        elif stripped.startswith("-") or stripped.startswith("—"):
            # Answer bullet lines
            current_answer_parts.append(stripped.lstrip("-— ").strip())
        elif current_question and stripped and not stripped.startswith("```"):
            # Continuation of answer (non-code, non-empty)
            if not stripped.startswith("##") and not stripped.startswith("```"):
                current_answer_parts.append(stripped)

    # Last question
    if current_question:
        answer = " ".join(current_answer_parts).strip()
        results.append((current_question, answer))

    return results


def parse_format_b(text: str, source_file: str) -> list[tuple[str, str]]:
    """Format B: ## Problem N: or ### N. heading style.

    ### N. 问题标题？
    ✅ 答案内容

    or:

    ## 问题 N：标题
    ### 答案
    内容
    """
    results: list[tuple[str, str]] = []

    blocks = re.split(r"(?=^#{2,3}\s+)", text, flags=re.MULTILINE)

    i = 0
    while i < len(blocks):
        block = blocks[i].strip()
        if not block:
            i += 1
            continue

        # Try to extract question from heading
        q_match = re.match(r"^#{2,3}\s+(?:\d+[.、．]\s*)?(.+)$", block, re.MULTILINE)
        if not q_match:
            i += 1
            continue

        question = q_match.group(1).strip()
        if not question:
            i += 1
            continue

        # Skip non-question headings (答案, answer, etc.)
        if re.match(r"^(答案|answer|回答|解答|答|Answer)$", question, re.IGNORECASE):
            i += 1
            continue

        # 1) Try to extract answer from the current block (after heading line(s))
        answer = re.sub(r"^#{2,3}\s+.*$", "", block, flags=re.MULTILINE).strip()

        i += 1

        # 2) If empty, look at subsequent blocks until the next question heading
        if not answer:
            while i < len(blocks):
                next_block = blocks[i].strip()
                if not next_block:
                    i += 1
                    continue
                next_q = re.match(
                    r"^#{2,3}\s+(?:\d+[.、．]\s*)?(.+)$", next_block, re.MULTILINE
                )
                if next_q:
                    next_q_text = next_q.group(1).strip()
                    # "### 答案" marker — take its body as the answer and continue
                    if re.match(r"^(答案|answer|回答|解答|答|Answer)$", next_q_text, re.IGNORECASE):
                        body = re.sub(r"^#{2,3}\s+.*$", "", next_block, flags=re.MULTILINE).strip()
                        if body:
                            answer = body
                        i += 1
                        continue
                    # Real question heading — stop
                    break
                if answer:
                    answer = "\n".join([answer, next_block]).strip()
                else:
                    answer = next_block
                i += 1

        # Clean up
        answer = re.sub(r"^[✅✔]\s*", "", answer.strip())
        answer = re.sub(r"```[\s\S]*?```", "", answer).strip()

        if answer:
            results.append((question, answer))

    return results


def parse_file(filepath: str) -> list[tuple[str, str]]:
    """Parse a single .md file, returning list of (question, answer)."""
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    # Remove front matter if any
    text = re.sub(r"^---[\s\S]*?---\n*", "", text).strip()

    results = parse_format_a(text, filepath)
    results_b = parse_format_b(text, filepath)

    # Prefer the format that yields more results — format A can falsely
    # match numbered items inside answer text (e.g. "1. 技术要点" in
    # 微前端.md), short-circuiting format B which would extract correctly.
    if results_b and len(results_b) > len(results):
        results = results_b

    return results


# ── import ──────────────────────────────────────────────────

async def import_questions(dir_path: str, ai_enrich: bool = False):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Remove old data for a fresh import
    await db.question_bank_topics.delete_many({})
    await db.question_bank_items.delete_many({})

    if not os.path.isdir(dir_path):
        print(f"Error: directory not found: {dir_path}")
        client.close()
        return

    md_files = sorted([f for f in os.listdir(dir_path) if f.endswith(".md") and f != "README.md"])
    all_items: list[QuestionBankItem] = []
    seen_topics: set[str] = set()

    print(f"Found {len(md_files)} markdown files\n")

    for filename in md_files:
        filepath = os.path.join(dir_path, filename)
        topic = filename.replace(".md", "")

        pairs = parse_file(filepath)
        print(f"  {topic}: {len(pairs)} questions")

        if not pairs:
            continue

        seen_topics.add(topic)
        for i, (question_text, ref_answer) in enumerate(pairs):
            all_items.append(
                QuestionBankItem(
                    topic=topic,
                    question_text=question_text,
                    reference_answer=ref_answer,
                    source_file=filename,
                )
            )

    # Save topics
    topics = [QuestionBankTopic(name=t, question_count=sum(1 for i in all_items if i.topic == t)) for t in seen_topics]
    if topics:
        # Upsert each
        for topic in topics:
            await db.question_bank_topics.update_one(
                {"name": topic.name}, {"$set": topic.model_dump(mode="json")}, upsert=True
            )

    # Save items in batches of 100
    batch_size = 100
    for i in range(0, len(all_items), batch_size):
        batch = all_items[i : i + batch_size]
        dicts = [item.model_dump(mode="json") for item in batch]
        await db.question_bank_items.insert_many(dicts)

    print(f"\nTotal: {len(all_items)} questions across {len(seen_topics)} topics")
    client.close()


def main():
    parser = argparse.ArgumentParser(description="Import interview questions from markdown files")
    parser.add_argument("--dir", required=True, help=DIR_HELP)
    parser.add_argument("--ai-enrich", action="store_true", help="Use AI to fill difficulty/tags")
    args = parser.parse_args()

    asyncio.run(import_questions(args.dir, ai_enrich=args.ai_enrich))


if __name__ == "__main__":
    main()
