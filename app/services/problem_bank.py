"""Curated coding problem bank for deterministic LeetCode-style questions."""

from __future__ import annotations

import random
import re
from typing import Any

PROBLEM_BANK: list[dict[str, Any]] = [
    {
        "title": "Two Sum",
        "difficulty": "easy",
        "topics": ["array", "hashmap", "two sum"],
        "statement": (
            "Given an integer array nums and an integer target, return indices of the two numbers "
            "such that they add up to target. You may assume exactly one valid answer exists, "
            "and you may not use the same element twice."
        ),
        "constraints": [
            "2 <= nums.length <= 10^4",
            "-10^9 <= nums[i] <= 10^9",
            "-10^9 <= target <= 10^9",
            "Exactly one valid answer exists.",
        ],
        "examples": [
            {
                "input": "nums = [2, 7, 11, 15], target = 9",
                "output": "[0, 1]",
                "explanation": "nums[0] + nums[1] == 9",
            },
            {
                "input": "nums = [3, 2, 4], target = 6",
                "output": "[1, 2]",
            },
        ],
        "public_test_cases": [
            {"input": "[2,7,11,15], 9", "expected_output": "[0,1]"},
            {"input": "[3,2,4], 6", "expected_output": "[1,2]"},
            {"input": "[3,3], 6", "expected_output": "[0,1]"},
        ],
        "expected_time_complexity": "O(n)",
        "expected_space_complexity": "O(n)",
        "tags": ["array", "hash table"],
        "function_name": "two_sum",
        "params": ["nums", "target"],
    },
    {
        "title": "Valid Parentheses",
        "difficulty": "easy",
        "topics": ["stack", "string", "parentheses"],
        "statement": (
            "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', "
            "determine if the input string is valid. A string is valid if open brackets are closed "
            "by the same type of brackets and in the correct order."
        ),
        "constraints": [
            "1 <= s.length <= 10^4",
            "s consists of parentheses only: ()[]{}",
        ],
        "examples": [
            {"input": "s = \"()[]{}\"", "output": "true"},
            {"input": "s = \"(]\"", "output": "false"},
        ],
        "public_test_cases": [
            {"input": "\"()\"", "expected_output": "true"},
            {"input": "\"()[]{}\"", "expected_output": "true"},
            {"input": "\"(]\"", "expected_output": "false"},
        ],
        "expected_time_complexity": "O(n)",
        "expected_space_complexity": "O(n)",
        "tags": ["stack", "string"],
        "function_name": "is_valid",
        "params": ["s"],
    },
    {
        "title": "Longest Substring Without Repeating Characters",
        "difficulty": "medium",
        "topics": ["sliding window", "string", "hashmap"],
        "statement": (
            "Given a string s, find the length of the longest substring without repeating characters."
        ),
        "constraints": [
            "0 <= s.length <= 5 * 10^4",
            "s consists of English letters, digits, symbols and spaces.",
        ],
        "examples": [
            {"input": "s = \"abcabcbb\"", "output": "3", "explanation": "\"abc\""},
            {"input": "s = \"bbbbb\"", "output": "1"},
        ],
        "public_test_cases": [
            {"input": "\"abcabcbb\"", "expected_output": "3"},
            {"input": "\"bbbbb\"", "expected_output": "1"},
            {"input": "\"pwwkew\"", "expected_output": "3"},
        ],
        "expected_time_complexity": "O(n)",
        "expected_space_complexity": "O(min(n, alphabet))",
        "tags": ["string", "sliding window"],
        "function_name": "length_of_longest_substring",
        "params": ["s"],
    },
    {
        "title": "Group Anagrams",
        "difficulty": "medium",
        "topics": ["hashmap", "string", "sorting"],
        "statement": (
            "Given an array of strings strs, group the anagrams together. "
            "You can return the answer in any order."
        ),
        "constraints": [
            "1 <= strs.length <= 10^4",
            "0 <= strs[i].length <= 100",
            "strs[i] consists of lowercase English letters.",
        ],
        "examples": [
            {
                "input": "strs = [\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]",
                "output": "[[\"bat\"],[\"nat\",\"tan\"],[\"ate\",\"eat\",\"tea\"]]",
            }
        ],
        "public_test_cases": [
            {
                "input": "[\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]",
                "expected_output": "[[\"bat\"],[\"nat\",\"tan\"],[\"ate\",\"eat\",\"tea\"]]",
            },
            {"input": "[\"\"]", "expected_output": "[[\"\"]]"},
        ],
        "expected_time_complexity": "O(n * k log k)",
        "expected_space_complexity": "O(n * k)",
        "tags": ["hash table", "string", "sorting"],
        "function_name": "group_anagrams",
        "params": ["strs"],
    },
    {
        "title": "Merge Intervals",
        "difficulty": "medium",
        "topics": ["intervals", "sorting"],
        "statement": (
            "Given an array of intervals where intervals[i] = [start_i, end_i], merge all overlapping "
            "intervals and return an array of non-overlapping intervals that cover all the intervals."
        ),
        "constraints": [
            "1 <= intervals.length <= 10^4",
            "intervals[i].length == 2",
            "0 <= start_i <= end_i <= 10^4",
        ],
        "examples": [
            {"input": "[[1,3],[2,6],[8,10],[15,18]]", "output": "[[1,6],[8,10],[15,18]]"},
            {"input": "[[1,4],[4,5]]", "output": "[[1,5]]"},
        ],
        "public_test_cases": [
            {"input": "[[1,3],[2,6],[8,10],[15,18]]", "expected_output": "[[1,6],[8,10],[15,18]]"},
            {"input": "[[1,4],[4,5]]", "expected_output": "[[1,5]]"},
        ],
        "expected_time_complexity": "O(n log n)",
        "expected_space_complexity": "O(n)",
        "tags": ["array", "sorting"],
        "function_name": "merge",
        "params": ["intervals"],
    },
    {
        "title": "LRU Cache",
        "difficulty": "hard",
        "topics": ["design", "hashmap", "linked list"],
        "statement": (
            "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. "
            "Implement the LRUCache class with get(key) and put(key, value), both in O(1) average time."
        ),
        "constraints": [
            "1 <= capacity <= 3000",
            "0 <= key <= 10^4",
            "0 <= value <= 10^5",
            "At most 2 * 10^5 calls to get and put.",
        ],
        "examples": [
            {
                "input": "LRUCache(2), put(1,1), put(2,2), get(1), put(3,3), get(2)",
                "output": "[null,null,null,1,null,-1]",
            }
        ],
        "public_test_cases": [
            {
                "input": "capacity=2; operations=put(1,1), put(2,2), get(1), put(3,3), get(2)",
                "expected_output": "[1,-1]",
            }
        ],
        "expected_time_complexity": "O(1) average per operation",
        "expected_space_complexity": "O(capacity)",
        "tags": ["design", "hash table", "linked list"],
        "function_name": "lru_cache",
        "params": ["operations"],
    },
]

_HIDDEN_TESTS_BY_PROBLEM_ID: dict[str, list[dict[str, str]]] = {
    "two-sum": [
        {"input": "[1,5,3,7], 8", "expected_output": "[0,3]"},
        {"input": "[-3,4,3,90], 0", "expected_output": "[0,2]"},
    ],
    "valid-parentheses": [
        {"input": "\"([{}])\"", "expected_output": "true"},
        {"input": "\"([)]\"", "expected_output": "false"},
    ],
    "longest-substring-without-repeating-characters": [
        {"input": "\"\"", "expected_output": "0"},
        {"input": "\"dvdf\"", "expected_output": "3"},
    ],
    "group-anagrams": [
        {
            "input": "[\"abc\",\"bca\",\"cab\",\"foo\",\"ofo\"]",
            "expected_output": "[[\"abc\",\"bca\",\"cab\"],[\"foo\",\"ofo\"]]",
        },
        {"input": "[\"a\"]", "expected_output": "[[\"a\"]]"},
    ],
    "merge-intervals": [
        {"input": "[[1,4],[0,2],[3,5]]", "expected_output": "[[0,5]]"},
        {"input": "[[1,4],[5,6]]", "expected_output": "[[1,4],[5,6]]"},
    ],
    "lru-cache": [
        {
            "input": "capacity=2; operations=put(2,1), put(2,2), get(2), put(1,1), put(4,1), get(2)",
            "expected_output": "[2,-1]",
        }
    ],
}


def _problem_id_from_title(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.strip().lower()).strip("-")
    return slug or "coding-problem"


def get_problem_hidden_tests(problem_id: str | None) -> list[dict[str, str]]:
    if not problem_id:
        return []
    return list(_HIDDEN_TESTS_BY_PROBLEM_ID.get(problem_id, []))


def _language_starter_code(function_name: str, params: list[str], language: str) -> tuple[str, str]:
    joined = ", ".join(params)

    if language in {"python", "py"}:
        signature = f"def {function_name}({joined}):"
        starter = f"{signature}\n    # Write your solution\n    pass\n"
        return signature, starter

    if language in {"javascript", "js"}:
        signature = f"function {function_name}({joined}) {{"
        starter = f"{signature}\n  // Write your solution\n}}\n"
        return signature, starter

    if language in {"typescript", "ts"}:
        signature = f"function {function_name}({joined}: any): any {{"
        starter = f"{signature}\n  // Write your solution\n}}\n"
        return signature, starter

    if language == "java":
        signature = f"public static Object {function_name}({', '.join('Object ' + p for p in params)})"
        starter = (
            "class Solution {\n"
            f"    {signature} {{\n"
            "        // Write your solution\n"
            "        return null;\n"
            "    }\n"
            "}\n"
        )
        return signature, starter

    signature = f"{function_name}({joined})"
    starter = f"// Implement {signature}\n"
    return signature, starter


def _normalize_language(language: str | None) -> str:
    value = (language or "python").strip().lower()
    if value in {"py"}:
        return "python"
    if value in {"js"}:
        return "javascript"
    if value in {"ts"}:
        return "typescript"
    if value in {"golang"}:
        return "go"
    if value in {"c#"}:
        return "csharp"
    if value in {"c++"}:
        return "cpp"
    return value


def _topic_matches(problem: dict[str, Any], topic: str) -> bool:
    topic_l = topic.strip().lower()
    if not topic_l:
        return True
    haystack = " ".join(
        [problem["title"], problem["statement"], *(problem.get("topics") or [])]
    ).lower()
    return topic_l in haystack


def pick_coding_problem(
    *,
    difficulty: str,
    topic: str,
    programming_language: str | None,
    previous_questions: list[str] | None = None,
) -> dict[str, Any] | None:
    """Pick a curated coding problem close to requested topic and difficulty."""

    previous_l = "\n".join(previous_questions or []).lower()
    difficulty_l = difficulty.strip().lower()
    language = _normalize_language(programming_language)

    pool = [
        p
        for p in PROBLEM_BANK
        if p["difficulty"] == difficulty_l
        and _topic_matches(p, topic)
        and p["title"].lower() not in previous_l
    ]

    if not pool:
        pool = [
            p
            for p in PROBLEM_BANK
            if p["difficulty"] == difficulty_l and p["title"].lower() not in previous_l
        ]

    if not pool:
        pool = [p for p in PROBLEM_BANK if p["title"].lower() not in previous_l]

    if not pool:
        return None

    problem = random.choice(pool).copy()
    problem_id = _problem_id_from_title(problem["title"])
    signature, starter = _language_starter_code(
        problem["function_name"],
        problem["params"],
        language,
    )

    return {
        "title": problem["title"],
        "problem_id": problem_id,
        "statement": problem["statement"],
        "difficulty": problem["difficulty"],
        "constraints": list(problem["constraints"]),
        "examples": list(problem["examples"]),
        "function_name": problem["function_name"],
        "params": list(problem["params"]),
        "function_signature": signature,
        "starter_code": starter,
        "public_test_cases": list(problem["public_test_cases"]),
        "tags": list(problem["tags"]),
        "expected_time_complexity": problem["expected_time_complexity"],
        "expected_space_complexity": problem["expected_space_complexity"],
        "programming_language": language,
        "source": "curated",
    }
