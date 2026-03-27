/* AI Technical Interviewer – Frontend Application */

const API = "/api/v1";

// State
let token = localStorage.getItem("token") || null;
let currentUser = null;

// Interview state
let currentSessionId = null;
let currentQuestionId = null;
let nextQuestion = null;      // buffered next question from answer response
let questionsAnswered = 0;
let totalQuestions = 5;
let isComplete = false;

// Helpers
function $(id) { return document.getElementById(id); }

async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, { ...options, headers });
    const data = res.headers.get("content-type")?.includes("json")
        ? await res.json()
        : await res.text();
    return { ok: res.ok, status: res.status, data };
}

function showLoading(text = "Processing...") {
    $("loading-text").textContent = text;
    $("loading-overlay").classList.remove("hidden");
}
function hideLoading() {
    $("loading-overlay").classList.add("hidden");
}

function formatDate(dateStr) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status) {
    const map = {
        in_progress: ["In Progress", "badge-warning"],
        completed: ["Completed", "badge-success"],
        cancelled: ["Cancelled", "badge-danger"],
    };
    const [label, cls] = map[status] || [status, ""];
    return `<span class="badge ${cls}">${label}</span>`;
}

function scoreColor(score) {
    if (score >= 7) return "var(--success)";
    if (score >= 5) return "var(--warning)";
    return "var(--danger)";
}

// Navigation
function navigateTo(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    $(`page-${page}`).classList.add("active");

    document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
    const link = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (link) link.classList.add("active");

    // Load page data
    if (page === "dashboard") loadDashboard();
    if (page === "history") loadHistory();
    if (page === "analytics") loadAnalytics();
}

// Bind nav links
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", e => {
        e.preventDefault();
        navigateTo(link.dataset.page);
    });
});

// Auth
function switchAuthTab(tab) {
    document.querySelectorAll(".tab-group .tab").forEach(t => t.classList.remove("active"));
    if (tab === "login") {
        $("form-login").classList.remove("hidden");
        $("form-register").classList.add("hidden");
        document.querySelectorAll(".tab-group .tab")[0].classList.add("active");
    } else {
        $("form-login").classList.add("hidden");
        $("form-register").classList.remove("hidden");
        document.querySelectorAll(".tab-group .tab")[1].classList.add("active");
    }
    $("login-error").textContent = "";
    $("register-error").textContent = "";
    $("register-success").textContent = "";
}

async function handleLogin(e) {
    e.preventDefault();
    $("login-error").textContent = "";
    const username = $("login-username").value.trim();
    const password = $("login-password").value;
    $("btn-login").disabled = true;

    const { ok, data } = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
    });
    $("btn-login").disabled = false;

    if (ok) {
        token = data.access_token;
        localStorage.setItem("token", token);
        await enterApp();
    } else {
        $("login-error").textContent = data.detail || "Login failed";
    }
}

async function handleRegister(e) {
    e.preventDefault();
    $("register-error").textContent = "";
    $("register-success").textContent = "";
    const email = $("reg-email").value.trim();
    const username = $("reg-username").value.trim();
    const password = $("reg-password").value;
    $("btn-register").disabled = true;

    const { ok, data } = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, username, password }),
    });
    $("btn-register").disabled = false;

    if (ok) {
        $("register-success").textContent = "Account created! You can now login.";
        setTimeout(() => switchAuthTab("login"), 1500);
    } else {
        const msg = data.detail || (data.errors ? data.errors.map(e => e.msg).join(", ") : "Registration failed");
        $("register-error").textContent = msg;
    }
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem("token");
    $("navbar").classList.remove("visible");
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    $("page-auth").classList.add("active");
    // Clear forms
    $("login-username").value = "";
    $("login-password").value = "";
}

async function enterApp() {
    // Fetch user profile
    const { ok, data } = await api("/auth/me");
    if (!ok) {
        logout();
        return;
    }
    currentUser = data;
    $("nav-user").textContent = currentUser.username;
    $("navbar").classList.add("visible");
    $("page-auth").classList.remove("active");
    navigateTo("dashboard");
}

// Dashboard
async function loadDashboard() {
    $("dash-username").textContent = currentUser?.username || "User";

    // Fetch analytics overview
    const { ok, data } = await api("/analytics/overview");
    if (ok) {
        $("stat-total").textContent = data.sessions_count;
        $("stat-completed").textContent = data.completed_sessions;
        $("stat-in-progress").textContent = data.in_progress_sessions;
        $("stat-avg-score").textContent = data.average_score > 0 ? data.average_score.toFixed(1) : "—";

        const trend = data.improvement_trend || "insufficient_data";
        const trendMap = {
            improving: ["Improving ↑", "badge-success"],
            stable: ["Stable →", "badge"],
            declining: ["Declining ↓", "badge-danger"],
            insufficient_data: ["Not enough data", "badge"],
        };
        const [tLabel, tClass] = trendMap[trend] || [trend, "badge"];
        $("trend-badge").className = `badge ${tClass}`;
        $("trend-badge").textContent = tLabel;
    }

    // Fetch recent activity
    const res2 = await api("/analytics/recent-activity");
    const list = $("recent-activity-list");
    if (res2.ok && res2.data.length > 0) {
        list.innerHTML = res2.data.map(s => `
            <div class="session-item" onclick="viewSession('${s.id}', '${s.status}')">
                <div class="session-info">
                    <span class="session-type">${s.interview_type}</span>
                    <span class="session-detail">${s.difficulty} · ${formatDate(s.started_at)}</span>
                </div>
                <div class="session-status">${statusBadge(s.status)}</div>
            </div>
        `).join("");
    } else {
        list.innerHTML = '<p class="muted">No sessions yet. Start your first interview!</p>';
    }
}

// History
async function loadHistory() {
    const { ok, data } = await api("/interviews/");
    const list = $("history-list");
    if (ok && data.length > 0) {
        list.innerHTML = data.map(s => `
            <div class="session-item" onclick="viewSession('${s.id}', '${s.status}')">
                <div class="session-info">
                    <span class="session-type">${s.interview_type} – ${s.topic || 'General'}</span>
                    <span class="session-detail">${s.difficulty_level} · ${s.questions_count} questions · ${formatDate(s.started_at)}</span>
                </div>
                <div class="session-status">${statusBadge(s.status)}</div>
            </div>
        `).join("");
    } else {
        list.innerHTML = '<p class="muted">No interview sessions yet.</p>';
    }
}

async function viewSession(sessionId, status) {
    if (status === "in_progress") {
        // Resume — load session detail and continue
        showLoading("Resuming interview...");
        const { ok, data } = await api(`/interviews/${sessionId}`);
        hideLoading();
        if (!ok) return alert("Could not load session");
        resumeSession(data);
    } else {
        // View results
        showLoading("Loading results...");
        await showSessionResults(sessionId);
        hideLoading();
    }
}

function resumeSession(session) {
    currentSessionId = session.id;
    questionsAnswered = session.questions?.length || 0;
    // Find last unanswered question (question with no response)
    const questions = session.questions || [];
    const lastQ = questions[questions.length - 1];
    if (lastQ) {
        currentQuestionId = lastQ.id;
        displayQuestion(lastQ);
    }
    $("interview-title").textContent = `${session.interview_type} Interview`;
    $("interview-meta").textContent = `${session.difficulty_level} · ${session.topic || "General"}`;
    $("interview-progress").textContent = `Q${questionsAnswered}`;
    navigateToInterview();
}

// Start Interview
async function handleStartInterview(e) {
    e.preventDefault();
    $("start-interview-error").textContent = "";
    const body = {
        interview_type: $("interview-type").value,
        difficulty_level: $("interview-difficulty").value,
        topic: $("interview-topic").value.trim(),
        num_questions: parseInt($("interview-num-questions").value) || 5,
    };
    $("btn-start-interview").disabled = true;
    showLoading("Starting interview... AI is generating your first question.");

    const { ok, data } = await api("/interviews/start", {
        method: "POST",
        body: JSON.stringify(body),
    });
    hideLoading();
    $("btn-start-interview").disabled = false;

    if (!ok) {
        const msg = data.detail || "Failed to start interview";
        $("start-interview-error").textContent = msg;
        return;
    }

    // Initialize interview state
    currentSessionId = data.session_id;
    questionsAnswered = 0;
    totalQuestions = body.num_questions;
    isComplete = false;
    nextQuestion = null;

    const firstQ = data.first_question;
    currentQuestionId = firstQ.id;

    $("interview-title").textContent = `${data.interview_type} Interview`;
    $("interview-meta").textContent = `${data.difficulty_level} · ${data.topic}`;
    $("interview-progress").textContent = "Q1";

    displayQuestion(firstQ);
    navigateToInterview();
}

function navigateToInterview() {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    $("page-interview").classList.add("active");
    $("feedback-panel").classList.add("hidden");
    $("form-answer").classList.remove("hidden");
    $("answer-text").value = "";
    $("answer-code").value = "";
}

function displayQuestion(q) {
    $("question-text").textContent = q.question_text;
    $("answer-text").value = "";
    $("answer-code").value = "";
    $("answer-error").textContent = "";
    $("form-answer").classList.remove("hidden");
    $("feedback-panel").classList.add("hidden");
    $("btn-submit-answer").disabled = false;
}

// Submit Answer
async function handleSubmitAnswer(e) {
    e.preventDefault();
    $("answer-error").textContent = "";
    const answerText = $("answer-text").value.trim();
    const answerCode = $("answer-code").value.trim() || null;

    if (!answerText) {
        $("answer-error").textContent = "Please enter your answer";
        return;
    }

    $("btn-submit-answer").disabled = true;
    showLoading("AI is evaluating your answer...");

    const body = {
        question_id: currentQuestionId,
        response_text: answerText,
    };
    if (answerCode) body.response_code = answerCode;

    const { ok, data } = await api(`/interviews/${currentSessionId}/answer`, {
        method: "POST",
        body: JSON.stringify(body),
    });
    hideLoading();
    $("btn-submit-answer").disabled = false;

    if (!ok) {
        $("answer-error").textContent = data.detail || "Failed to submit answer";
        return;
    }

    questionsAnswered++;
    isComplete = data.is_complete;
    nextQuestion = data.next_question;

    // Show feedback
    showFeedback(data.response.feedback, data.is_complete, data.questions_remaining);
}

function showFeedback(feedback, complete, remaining) {
    $("form-answer").classList.add("hidden");
    $("feedback-panel").classList.remove("hidden");

    if (feedback) {
        $("fb-score").textContent = feedback.score;
        $("fb-score").style.color = scoreColor(feedback.score);
        $("fb-text").textContent = feedback.ai_feedback_text;

        if (feedback.strengths && feedback.strengths.length > 0) {
            $("fb-strengths").innerHTML = `
                <h4>✓ Strengths</h4>
                <ul class="fb-strengths">${feedback.strengths.map(s => `<li>${s}</li>`).join("")}</ul>
            `;
        } else {
            $("fb-strengths").innerHTML = "";
        }

        if (feedback.improvements && feedback.improvements.length > 0) {
            $("fb-improvements").innerHTML = `
                <h4>△ Areas for Improvement</h4>
                <ul class="fb-improvements">${feedback.improvements.map(s => `<li>${s}</li>`).join("")}</ul>
            `;
        } else {
            $("fb-improvements").innerHTML = "";
        }
    } else {
        $("fb-score").textContent = "—";
        $("fb-text").textContent = "No feedback available.";
        $("fb-strengths").innerHTML = "";
        $("fb-improvements").innerHTML = "";
    }

    if (complete) {
        $("btn-next-question").classList.add("hidden");
        $("btn-finish").classList.remove("hidden");
    } else {
        $("btn-next-question").classList.remove("hidden");
        $("btn-finish").classList.add("hidden");
        const remText = remaining != null ? ` (${remaining} remaining)` : "";
        $("btn-next-question").textContent = `Next Question →${remText}`;
    }

    $("interview-progress").textContent = `Q${questionsAnswered}`;
}

function showNextQuestion() {
    if (nextQuestion) {
        currentQuestionId = nextQuestion.id;
        displayQuestion(nextQuestion);
        nextQuestion = null;
        $("interview-progress").textContent = `Q${questionsAnswered + 1}`;
    }
}

// Session Feedback (end of interview)
async function handleGetSessionFeedback() {
    showLoading("AI is generating your session summary...");
    const { ok, data } = await api(`/interviews/${currentSessionId}/feedback`, {
        method: "POST",
    });
    hideLoading();

    if (!ok) {
        // Even if feedback generation fails, show basic results
        await showSessionResults(currentSessionId);
        navigateTo("results");
        return;
    }

    renderResults(data);
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    $("page-results").classList.add("active");
}

async function showSessionResults(sessionId) {
    // Try to get session feedback
    const { ok, data } = await api(`/interviews/${sessionId}`);
    if (!ok) {
        $("results-content").innerHTML = '<p class="muted">Could not load session.</p>';
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        $("page-results").classList.add("active");
        return;
    }

    // Display basic session info
    const session = data;
    const questions = session.questions || [];
    $("results-content").innerHTML = `
        <div class="results-summary">
            <h3>${session.interview_type} Interview – ${session.topic || "General"}</h3>
            <p class="muted mb-16">${session.difficulty_level} · ${questions.length} questions · ${statusBadge(session.status)}</p>
            <p class="muted">Started: ${formatDate(session.started_at)}</p>
            ${session.completed_at ? `<p class="muted">Completed: ${formatDate(session.completed_at)}</p>` : ""}
        </div>
        <h3 class="mb-16">Questions & Answers</h3>
        ${questions.map((q, i) => `
            <div class="question-card" style="margin-bottom: 16px;">
                <div class="question-label">Question ${i + 1}</div>
                <div class="question-text">${q.question_text}</div>
            </div>
        `).join("")}
    `;

    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    $("page-results").classList.add("active");
}

function renderResults(feedback) {
    const scores = feedback.individual_scores || [];
    const scorePips = scores.map(s => {
        const color = s != null ? scoreColor(s) : "var(--text-muted)";
        return `<div class="score-pip" style="border-color: ${color}; color: ${color}">${s ?? "—"}</div>`;
    }).join("");

    $("results-content").innerHTML = `
        <div class="results-summary">
            <div class="results-score">${feedback.overall_score != null ? feedback.overall_score.toFixed(1) : "—"}</div>
            <div class="results-score-label">Overall Score out of 10</div>
            ${scorePips ? `<div class="score-bar">${scorePips}</div><p class="muted text-center mt-8">Individual question scores</p>` : ""}
            <div class="results-text mt-16">${feedback.summary}</div>

            <div class="results-columns">
                <div class="results-col">
                    <h4>✓ Key Strengths</h4>
                    <ul>${(feedback.key_strengths || []).map(s => `<li>${s}</li>`).join("") || "<li>—</li>"}</ul>
                </div>
                <div class="results-col">
                    <h4>△ Areas for Improvement</h4>
                    <ul>${(feedback.areas_for_improvement || []).map(s => `<li>${s}</li>`).join("") || "<li>—</li>"}</ul>
                </div>
            </div>

            ${feedback.recommendations && feedback.recommendations.length > 0 ? `
                <div class="results-recommendations">
                    <h4>💡 Recommendations</h4>
                    <ul>${feedback.recommendations.map(r => `<li>${r}</li>`).join("")}</ul>
                </div>
            ` : ""}

            <p class="muted mt-16">Questions answered: ${feedback.questions_answered}</p>
        </div>
    `;
}

// Cancel Interview
async function handleCancelInterview() {
    if (!confirm("Are you sure you want to cancel this interview?")) return;
    showLoading("Cancelling...");
    await api(`/interviews/${currentSessionId}`, { method: "DELETE" });
    hideLoading();
    navigateTo("dashboard");
}

// Analytics
async function loadAnalytics() {
    const { ok, data } = await api("/analytics/overview");
    if (!ok) {
        $("analytics-content").innerHTML = '<p class="muted">Could not load analytics.</p>';
        return;
    }

    const byType = (data.by_type || []).map(t => `
        <div class="type-row">
            <span class="type-name">${t.interview_type}</span>
            <span>
                <span class="type-score">${t.average_score.toFixed(1)}</span>
                <span class="type-count"> (${t.total_feedbacks} reviews)</span>
            </span>
        </div>
    `).join("") || '<p class="muted">No data yet</p>';

    const trend = data.improvement_trend || "insufficient_data";
    const trendMap = {
        improving: ["📈 Improving", "badge-success"],
        stable: ["📊 Stable", "badge"],
        declining: ["📉 Declining", "badge-danger"],
        insufficient_data: ["📊 Not enough data", "badge"],
    };
    const [tLabel, tClass] = trendMap[trend] || [trend, "badge"];

    $("analytics-content").innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${data.sessions_count}</div>
                <div class="stat-label">Total Sessions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.completed_sessions}</div>
                <div class="stat-label">Completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.total_questions_asked}</div>
                <div class="stat-label">Questions Asked</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.average_score > 0 ? data.average_score.toFixed(1) : "—"}</div>
                <div class="stat-label">Average Score</div>
            </div>
        </div>

        <div class="analytics-grid">
            <div class="analytics-card">
                <h4>Performance by Type</h4>
                ${byType}
            </div>
            <div class="analytics-card">
                <h4>Trend</h4>
                <div class="text-center mt-16">
                    <span class="badge badge-lg ${tClass}">${tLabel}</span>
                </div>
                <p class="muted text-center mt-16">Based on your recent vs. earlier scores</p>
            </div>
        </div>
    `;
}

// Init
(async function init() {
    if (token) {
        await enterApp();
    } else {
        $("page-auth").classList.add("active");
    }
})();
