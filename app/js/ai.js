/* ANCHOR Mobile - drafting (port of the desktop app's ai.R).
   "prompt": copy-and-paste prompts for claude.ai (no key); "api": the Anthropic Messages API with the researcher's own key,
   called straight from this device; "manual": no AI. The key is kept on this device only and never written to files. */
(function (root) {
  'use strict';
  const AI = {};
  const C = root.ANCHOR_CONTENT;
  AI.MODES = ['prompt', 'api', 'manual'];
  AI.langLine = function () {
    const l = S.dev().draft_lang || I18N.lang; if (!l || l === 'en') return '';
    return `\n\nWrite the draft in ${I18N.ENGLISH_NAME[l]}. Keep the exact line 'QUESTIONS FOR THE RESEARCHER:' in English so the app can find your questions; write the questions themselves in ${I18N.ENGLISH_NAME[l]}.`;
  };
  AI.buildPrompt = function (phase, articleText, context, answers, includeText, maxChars) {
    maxChars = maxChars || 120000;
    const keys = Object.keys(answers || {});
    const ans = keys.length ? keys.map(k => '- ' + k + ': ' + (Array.isArray(answers[k]) ? answers[k].join('; ') : answers[k])).join('\n') : '- (none yet)';
    const art = includeText && articleText ? '\n\n=== ARTICLE TEXT (extracted from the uploaded PDF) ===\n' + articleText.slice(0, maxChars) + (articleText.length > maxChars ? '\n[... text truncated ...]' : '')
      : '\n\n(The article PDF is attached to this conversation; use it as the only source.)';
    return phase.prompt + '\n\n=== RESEARCHER\'S ANSWERS FOR THIS PHASE ===\n' + ans + '\n\n=== APPROVED EARLIER PHASES ===\n' + (context || '(none yet)') + art + C.question_tail + AI.langLine();
  };
  AI.draft = async function (mode, prompt) {
    if (mode !== 'api') throw new Error(t('This mode does not draft inside the app.'));
    const key = S.apiKey(); if (!key) throw new Error(t('No API key set. Add one in Settings, or switch to copy-and-paste prompts.'));
    if (typeof root.ANCHOR_MOCK_AI === 'function') return root.ANCHOR_MOCK_AI(prompt, S.dev().api_model);
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 300000);
    let r; try {
      r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal, headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: S.dev().api_model || 'claude-sonnet-5-5', max_tokens: 8000,
          system: 'You are a careful research assistant. Use only the supplied sources, never invent figures, and flag uncertainty.', messages: [{ role: 'user', content: prompt }] }) });
    } catch (e) { throw new Error(t('Could not reach the Claude API ({msg}). Check the connection.', { msg: e.name === 'AbortError' ? 'timeout' : e.message })); } finally { clearTimeout(tm); }
    let body = {}; try { body = await r.json(); } catch (e) { /* empty */ }
    if (r.status >= 400) throw new Error(t('Claude API error:') + ' ' + ((body.error && body.error.message) || r.status));
    return (body.content || []).map(b => b.text || '').join('\n');
  };
  AI.test = async function () { return AI.draft('api', 'Reply with the single word: ready'); };
  AI.extractQuestions = function (txt) {
    if (!txt) return []; const i = txt.indexOf('QUESTIONS FOR THE RESEARCHER:'); if (i < 0) return [];
    const tail = txt.slice(i + 'QUESTIONS FOR THE RESEARCHER:'.length); if (/^\s*none/i.test(tail)) return [];
    return tail.split('\n').map(s => s.trim()).filter(s => /^([0-9]+[.)]|[-*])\s+/.test(s)).map(s => s.replace(/^([0-9]+[.)]|[-*])\s+/, '')).filter(Boolean).slice(0, 5);
  };
  AI.stripQ = x => String(x || '').replace(/\s*QUESTIONS FOR THE RESEARCHER:[\s\S]*$/i, '');
  root.AI = AI;
})(window);
