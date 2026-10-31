// Mock live services for tests (Crossref, doi.org, OpenAlex, ROR, ORCID, Claude API). Injected into the page.
window.ANCHOR_MOCK = function (url, q) {
  const u = new URL(url);
  if (u.hostname === 'api.crossref.org') {
    if (u.pathname === '/works' && q.rows === 0) return { message: { 'total-results': 1 } };
    if (u.pathname === '/works') return { message: { items: [] } };
    const doi = decodeURIComponent(u.pathname.replace('/works/', ''));
    if (doi === '10.9999/none') return { __404: true };
    return { message: { author: [{ family: 'Doe', given: 'Jane' }, { family: 'Roe', given: 'John Paul' }], issued: { 'date-parts': [[2021, 3]] }, title: ['ESG rating disagreement and stock returns'],
      'container-title': ['Journal of Test Finance'], volume: '12', issue: '3', page: '45-67', 'updated-by': doi === '10.1234/retracted' ? [{ type: 'retraction', label: 'Retraction', DOI: '10.1234/r1', source: 'publisher', updated: { 'date-parts': [[2023, 1, 1]] } }] : [] } };
  }
  if (u.hostname === 'doi.org') { const acc = (q['.headers'] || {}).Accept || ''; if (/style=nature/.test(acc)) return { __404: true };
    return '<div class="csl-entry">Doe, J., &amp; Roe, J. P. (2021). ESG rating disagreement and stock returns. <i>Journal of Test Finance</i>, 12(3), 45–67. [' + acc.replace(/.*style=([^;]+).*/, '$1') + ']</div>'; }
  if (u.hostname === 'api.openalex.org') {
    if (q.group_by) return { group_by: [{ key: '2019', count: 40 }, { key: '2020', count: 55 }, { key: '2021', count: 80 }] };
    const mk = i => ({ id: 'https://openalex.org/W' + (1000 + i), doi: 'https://doi.org/10.5555/test.' + i, display_name: 'Test work number ' + i + ' on ESG ratings', title: 'Test work ' + i, publication_year: 2015 + (i % 8),
      cited_by_count: 10 * i, fwci: i % 3 ? 1.2 : null, authorships: [{ author: { display_name: 'Anna Smith' }, institutions: [{ display_name: 'University of Hagen', country_code: 'DE' }], countries: ['DE'] }, { author: { display_name: 'Bo Li' }, countries: ['CN'], institutions: [{ display_name: 'Tsinghua University', country_code: 'CN' }] }],
      primary_location: { source: { id: 'https://openalex.org/S1', display_name: 'Journal of Test Finance' } }, open_access: { oa_status: i % 2 ? 'gold' : 'closed', oa_url: i % 2 ? 'https://example.org/oa/' + i : null },
      best_oa_location: i % 2 ? { pdf_url: 'https://example.org/pdf/' + i + '.pdf', landing_page_url: 'https://example.org/oa/' + i, version: 'publishedVersion', license: 'cc-by', source: { display_name: 'Repo' } } : null,
      is_retracted: i === 3, language: 'en', type: 'article', referenced_works_count: 30, referenced_works: ['https://openalex.org/W1001', 'https://openalex.org/W1002'].concat(i > 4 ? ['https://openalex.org/W1003'] : []),
      abstract_inverted_index: { This: [0], paper: [1], studies: [2], ESG: [3] }, keywords: [{ display_name: 'ESG' }, { display_name: i % 2 ? 'Ratings' : 'Returns' }], concepts: [{ display_name: 'Finance' }], cited_by_count_: 0 });
    if (/\/works\/doi:/.test(u.pathname)) return Object.assign(mk(0), { referenced_works: ['https://openalex.org/W1001'] });
    const n = Math.min(Number(q.per_page) || 25, 25); const results = Array.from({ length: n }, (_, i) => mk(i + 1));
    if (q.filter && /^doi:/.test(q.filter)) return { results: results.slice(0, 5), meta: { count: 5 } };
    return { results: results, meta: { count: 1234, next_cursor: null } };
  }
  if (u.hostname === 'api.ror.org') return { items: [{ id: 'https://ror.org/04tkkr536', names: [{ value: 'FernUniversität in Hagen', types: ['ror_display'] }], locations: [{ geonames_details: { name: 'Hagen', country_code: 'DE' } }], domains: ['fernuni-hagen.de'], types: ['education'] }] };
  if (u.hostname === 'pub.orcid.org') return { name: { 'given-names': { value: 'Amira' }, 'family-name': { value: 'Kastour' } } };
  if (u.hostname === 'example.org') { if (/\.pdf$/.test(u.pathname)) return '%PDF-1.4 fake'; return '<html>landing</html>'; }
  return { __404: true };
};
window.ANCHOR_MOCK_AI = function (prompt) { return Promise.resolve('# Article at a glance\n\n| Item | Value |\n|---|---|\n| Question | Does ESG disagreement predict returns? |\n| Sample | 3,000 US firms |\n\n## Summary\n\nThe article finds a **positive** premium.\n\n- point one\n- point two\n\nQUESTIONS FOR THE RESEARCHER:\n1. Which rating providers do you have?\n2. Should we include working papers?'); };
window.ANCHOR_NO_AUTO_ONLINE = true;
