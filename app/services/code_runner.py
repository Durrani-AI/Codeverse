"""Sandboxed-ish Python code runner for public/hidden coding test cases.

This runner executes user functions in a short-lived subprocess per test case
with a strict timeout and a restricted builtins set.
"""

from __future__ import annotations

import ast
import builtins
import json
import multiprocessing as mp
import re
import time
from typing import Any

SAFE_BUILTINS = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "float": float,
    "int": int,
    "len": len,
    "list": list,
    "max": max,
    "min": min,
    "pow": pow,
    "range": range,
    "reversed": reversed,
    "round": round,
    "set": set,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
    "map": map,
    "filter": filter,
    "Exception": Exception,
    "ValueError": ValueError,
    "TypeError": TypeError,
    "__build_class__": builtins.__build_class__,
    "object": object,
}

FORBIDDEN_CALLS = {
    "eval",
    "exec",
    "compile",
    "open",
    "input",
    "__import__",
    "globals",
    "locals",
    "vars",
    "dir",
    "getattr",
    "setattr",
    "delattr",
    "help",
    "breakpoint",
    "exit",
    "quit",
}

FORBIDDEN_NAMES = {
    "os",
    "sys",
    "subprocess",
    "socket",
    "pathlib",
    "shutil",
    "__builtins__",
}


def _coerce_literal_tokens(value: str) -> str:
    out = value.strip()
    out = re.sub(r"\btrue\b", "True", out, flags=re.IGNORECASE)
    out = re.sub(r"\bfalse\b", "False", out, flags=re.IGNORECASE)
    out = re.sub(r"\bnull\b", "None", out, flags=re.IGNORECASE)
    return out


def _parse_args_from_text(value: str) -> list[Any]:
    expr = _coerce_literal_tokens(value)
    if not expr:
        return []

    try:
        wrapped = ast.literal_eval(f"({expr})")
    except Exception:
        wrapped = ast.literal_eval(expr)

    if isinstance(wrapped, tuple):
        return list(wrapped)
    return [wrapped]


def _parse_value(value: str) -> Any:
    expr = _coerce_literal_tokens(value)
    try:
        return ast.literal_eval(expr)
    except Exception:
        return expr


def _canonical_group_anagrams(value: Any) -> Any:
    if not isinstance(value, list):
        return value
    normalized: list[list[str]] = []
    for group in value:
        if not isinstance(group, (list, tuple)):
            return value
        normalized.append(sorted(str(item) for item in group))
    return sorted(normalized)


def _canonical(value: Any) -> Any:
    if isinstance(value, tuple):
        return [_canonical(v) for v in value]
    if isinstance(value, list):
        return [_canonical(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _canonical(v) for k, v in sorted(value.items(), key=lambda kv: str(kv[0]))}
    return value


def _compare_outputs(actual: Any, expected: Any, *, function_name: str) -> bool:
    if function_name == "two_sum":
        if isinstance(actual, (list, tuple)) and isinstance(expected, (list, tuple)):
            try:
                return sorted(int(x) for x in actual) == sorted(int(x) for x in expected)
            except Exception:
                pass

    if function_name == "group_anagrams":
        return _canonical_group_anagrams(actual) == _canonical_group_anagrams(expected)

    return _canonical(actual) == _canonical(expected)


def _display(value: Any) -> str:
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=True)
    except Exception:
        return repr(value)


def _validate_user_code(user_code: str) -> None:
    if not user_code.strip():
        raise ValueError("No code provided.")

    if len(user_code) > 60_000:
        raise ValueError("Code is too large.")

    tree = ast.parse(user_code)

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            raise ValueError("Imports are not allowed in the runner.")

        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in FORBIDDEN_CALLS:
                raise ValueError(f"Forbidden function call: {node.func.id}")

        if isinstance(node, ast.Name) and node.id in FORBIDDEN_NAMES:
            raise ValueError(f"Forbidden name usage: {node.id}")

        if isinstance(node, ast.Attribute) and str(node.attr).startswith("__"):
            raise ValueError("Dunder attribute access is not allowed.")


def _worker(conn: Any, user_code: str, function_name: str, args: list[Any]) -> None:
    try:
        _validate_user_code(user_code)

        namespace: dict[str, Any] = {
            "__builtins__": SAFE_BUILTINS,
            "__name__": "__main__",
        }

        compiled = compile(user_code, "<candidate>", "exec")
        exec(compiled, namespace, namespace)

        fn = namespace.get(function_name)
        if not callable(fn):
            conn.send(
                {
                    "ok": False,
                    "error": f"Function '{function_name}' was not found.",
                }
            )
            return

        start = time.perf_counter()
        result = fn(*args)
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        conn.send(
            {
                "ok": True,
                "result": result,
                "runtime_ms": round(elapsed_ms, 3),
            }
        )
    except Exception as exc:
        conn.send(
            {
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
            }
        )
    finally:
        try:
            conn.close()
        except Exception:
            pass


def _run_one_case(
    *,
    user_code: str,
    function_name: str,
    args: list[Any],
    timeout_sec: float,
) -> dict[str, Any]:
    ctx = mp.get_context("spawn")
    parent_conn, child_conn = ctx.Pipe(duplex=False)
    proc = ctx.Process(target=_worker, args=(child_conn, user_code, function_name, args))
    proc.start()
    proc.join(timeout_sec)

    if proc.is_alive():
        proc.terminate()
        proc.join()
        return {
            "ok": False,
            "error": f"Execution timed out after {timeout_sec:.1f}s",
        }

    if parent_conn.poll(0.1):
        try:
            return parent_conn.recv()
        except Exception:
            return {"ok": False, "error": "Runner returned an invalid response."}

    return {"ok": False, "error": "Runner produced no output."}


def run_python_tests(
    *,
    user_code: str,
    function_name: str,
    test_cases: list[dict[str, str]],
    timeout_sec: float = 2.0,
) -> dict[str, Any]:
    """Execute user code against a list of test cases.

    Each test case expects: {"input": "...", "expected_output": "..."}
    """
    results: list[dict[str, Any]] = []

    for test in test_cases:
        raw_input = str(test.get("input", "")).strip()
        raw_expected = str(test.get("expected_output", "")).strip()

        try:
            args = _parse_args_from_text(raw_input)
            expected = _parse_value(raw_expected)
        except Exception as exc:
            results.append(
                {
                    "input": raw_input,
                    "expected_output": raw_expected,
                    "actual_output": None,
                    "passed": False,
                    "error": f"Invalid test case format: {exc}",
                    "runtime_ms": None,
                }
            )
            continue

        one = _run_one_case(
            user_code=user_code,
            function_name=function_name,
            args=args,
            timeout_sec=timeout_sec,
        )

        if not one.get("ok"):
            results.append(
                {
                    "input": raw_input,
                    "expected_output": raw_expected,
                    "actual_output": None,
                    "passed": False,
                    "error": one.get("error", "Execution failed."),
                    "runtime_ms": None,
                }
            )
            continue

        actual = one.get("result")
        runtime_ms = one.get("runtime_ms")
        passed = _compare_outputs(actual, expected, function_name=function_name)

        results.append(
            {
                "input": raw_input,
                "expected_output": raw_expected,
                "actual_output": _display(actual),
                "passed": passed,
                "error": None if passed else "Output did not match expected result.",
                "runtime_ms": runtime_ms,
            }
        )

    passed_tests = sum(1 for r in results if r["passed"])
    total_tests = len(results)

    return {
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": total_tests - passed_tests,
        "all_passed": total_tests > 0 and passed_tests == total_tests,
        "test_results": results,
    }
