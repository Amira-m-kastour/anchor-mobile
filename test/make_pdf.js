const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  await p.setContent(`<html><head><title>Rating disagreement and returns</title></head><body style="font-family:serif;font-size:12pt">
<h1>ESG Rating Disagreement and Stock Returns</h1>
<p>Jane Doe and John Roe</p>
<p>Journal of Test Finance, 2021. https://doi.org/10.1234/jtf.2021.001</p>
<h3>Abstract</h3>
<p>We study whether disagreement among environmental, social and governance (ESG) rating providers predicts stock returns. Using ratings from six providers for 3,000 US firms between 2010 and 2019 we find that firms with higher rating disagreement earn higher subsequent returns, consistent with an uncertainty premium. The effect is concentrated in firms with high analyst dispersion and survives controls for size, value and momentum. Our results suggest that investors demand compensation for ESG uncertainty, and that rating disagreement is priced in equity markets around the world.</p>
<p>Keywords: ESG; rating disagreement; returns</p>
<h3>1 Introduction</h3><p>${'Text of the introduction. '.repeat(80)}</p>
<h3>References</h3>
<p>Berg, F., Koelbel, J. F., &amp; Rigobon, R. (2022). Aggregate confusion: The divergence of ESG ratings. Review of Finance, 26(6), 1315-1344.</p>
<p>Gibson Brandon, R., Krueger, P., &amp; Schmidt, P. S. (2021). ESG rating disagreement and stock returns. Financial Analysts Journal, 77(4), 104-127.</p>
<p>Avramov, D., Cheng, S., Lioui, A., &amp; Tarelli, A. (2022). Sustainable investing with ESG rating uncertainty. Journal of Financial Economics, 145(2), 642-664.</p>
</body></html>`);
  await p.pdf({ path: 'fixtures/article.pdf', format: 'A4' }); await b.close(); console.log('ok'); })();
