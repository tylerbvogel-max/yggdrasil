export default function PerformanceExplanationPage() {
  return (
    <div className="about-page">
      <h2>Performance Analysis &mdash; Methodology</h2>

      <section className="about-section">
        <h3>Overview</h3>
        <p>
          The Performance page computes all analytics from the SQLite database using pure SQL and Python &mdash;
          no LLM is invoked. It answers one central question: <strong>does structured neuron context + a cheap model
          (Haiku) produce answers comparable to an expensive model (Opus) used raw?</strong>
        </p>
        <p>
          Every metric shown is derived from two data sources: the <code>queries</code> table (token counts, costs,
          neuron selections) and the <code>eval_scores</code> table (blind quality evaluations scored on a 1&ndash;5
          ordinal scale across accuracy, completeness, clarity, faithfulness, and overall quality).
        </p>
      </section>

      <section className="about-section">
        <h3>Blind A/B Evaluation Framework</h3>
        <p>
          Every query can be executed in multiple &ldquo;slots&rdquo; simultaneously &mdash; for example, Haiku with neuron
          context at 8K tokens alongside raw Opus with no context. The responses are then evaluated blindly:
        </p>
        <ul className="about-features">
          <li>
            <strong>Blinding</strong> &mdash; Answers are labeled A, B, C with no model identification. The evaluator
            LLM does not know which model or configuration produced which answer.
          </li>
          <li>
            <strong>Scoring rubric</strong> &mdash; Each answer is scored 1&ndash;5 on four dimensions (accuracy,
            completeness, clarity, faithfulness) plus an overall score. The evaluator receives structured scoring
            criteria to minimize subjective variance.
          </li>
          <li>
            <strong>Judge model</strong> &mdash; The evaluator model is configurable (Haiku, Sonnet, or Opus). Using
            a different-tier judge than the test subjects introduces documented cross-tier bias &mdash; Opus tends to
            rate Haiku answers ~0.2 points lower than a Haiku judge would, for example. This is a known limitation
            tracked but not corrected for.
          </li>
          <li>
            <strong>Answer modes</strong> &mdash; Each scored answer is tagged with its configuration:
            <code>haiku_neuron</code>, <code>opus_raw</code>, <code>sonnet_neuron</code>, <code>haiku_raw</code>, etc.
            All statistical tests compare scores between these modes.
          </li>
        </ul>
      </section>

      <section className="about-section">
        <h3>Cost Modeling</h3>
        <p>
          Cost is computed from actual token counts logged per query stage, multiplied by Anthropic&rsquo;s published
          per-million-token pricing:
        </p>
        <table className="about-table">
          <thead>
            <tr><th>Model</th><th>Input ($/MTok)</th><th>Output ($/MTok)</th></tr>
          </thead>
          <tbody>
            <tr><td>Claude Haiku 4.5</td><td>$1.00</td><td>$5.00</td></tr>
            <tr><td>Claude Sonnet 4.6</td><td>$3.00</td><td>$15.00</td></tr>
            <tr><td>Claude Opus 4.6</td><td>$5.00</td><td>$25.00</td></tr>
          </tbody>
        </table>
        <p>
          The Haiku+Neurons cost includes both pipeline stages: Stage 1 (classification) and Stage 2 (execution with
          assembled neuron context). The &ldquo;Raw&rdquo; alternatives model what it would cost to send the same query
          directly to Sonnet or Opus with no neuron enrichment. Savings percentages, monthly projections, and annual
          projections are all derived from these per-query averages.
        </p>
        <p>
          <strong>Important caveat:</strong> The &ldquo;raw&rdquo; cost models assume the same average input token count
          as the classification stage (since a raw query would just be the user&rsquo;s question). In practice, raw queries
          might have slightly different token counts depending on system prompt differences, but this is a reasonable
          approximation for cost comparison purposes.
        </p>
      </section>

      <section className="about-section">
        <h3>Statistical Tests</h3>
        <p>
          Six hypothesis tests are run, each answering a different question about system performance.
          All tests use &alpha;=0.05 as the significance threshold.
        </p>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 1: Haiku+Neurons vs Opus Raw (Overall Quality)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>Is the quality gap between cheap enriched queries and expensive raw queries statistically real, or could it be noise?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Welch&rsquo;s t-test (parametric, unequal variances) + Mann-Whitney U (non-parametric, rank-based)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sidedness</td><td>Two-sided &mdash; we want to detect any difference, not assume a direction</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Effect size</td><td>Cohen&rsquo;s d with pooled standard deviation (Bessel&rsquo;s correction, ddof=1)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Power</td><td>Required sample size per group for 80% power at &alpha;=0.05, calculated from observed effect size</td></tr>
            <tr><td style={{ fontWeight: 600 }}>CI</td><td>95% confidence interval on the mean difference using Wald method (z=1.96)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Why both tests</td><td>Welch&rsquo;s t assumes approximate normality; Mann-Whitney U makes no distributional assumption and is better suited for ordinal (1&ndash;5) data. Agreement between both strengthens confidence in the result.</td></tr>
          </tbody>
        </table>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 2: Haiku+Neurons vs Haiku Raw (Neuron Value-Add)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>Does adding neuron context measurably improve Haiku&rsquo;s answer quality?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Mann-Whitney U (one-sided, greater)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sidedness</td><td>One-sided &mdash; we specifically hypothesize that neurons improve quality, not just change it</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Warning</td><td>Flags &ldquo;critically small&rdquo; if Haiku Raw n &lt; 10, since small samples make rank-based tests unreliable</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Why one-sided</td><td>The investment thesis is that neurons add value. A one-sided test has more power to detect improvement but cannot detect degradation. This is the scientifically appropriate choice when the hypothesis is directional.</td></tr>
          </tbody>
        </table>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 3: All Enriched vs All Raw (Pooled)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>Across all model tiers, does neuron enrichment systematically outperform raw queries?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Welch&rsquo;s t-test + Mann-Whitney U (two-sided)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Pooling</td><td>Enriched = haiku_neuron + sonnet_neuron + opus_neuron; Raw = opus_raw + sonnet_raw + haiku_raw</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Caveat</td><td>Pooling across model tiers increases sample size but introduces heterogeneity &mdash; the effect of neurons may differ by model tier. This test answers &ldquo;on average, across all configurations&rdquo; rather than &ldquo;for a specific configuration.&rdquo;</td></tr>
          </tbody>
        </table>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 4: Quality Trend (Early vs Late)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>Does Haiku+Neuron quality improve as the neuron graph grows over time?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Welch&rsquo;s t-test + Mann-Whitney U (one-sided, greater)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Split</td><td>Queries divided at median ID &mdash; first half (&ldquo;early&rdquo;) vs second half (&ldquo;late&rdquo;)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sidedness</td><td>One-sided &mdash; tests specifically for improvement (late &gt; early), not just change</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Caveat</td><td>Median split is simple but creates a single cut point. A more granular analysis (rolling window, regression) could reveal non-linear trends, but the binary split provides a clean, interpretable test.</td></tr>
          </tbody>
        </table>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 5: Reliability (Score &ge; 4 Rate)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>What proportion of Haiku+Neuron answers score 4 or above, and can we statistically claim a reliability threshold?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Wilson score interval (95% CI on proportion) + Binomial tests at 75% and 70% thresholds</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Wilson CI</td><td>More accurate than the normal approximation for proportions, especially at small n or extreme proportions. Includes continuity correction.</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Binomial tests</td><td>One-sided (greater): H<sub>0</sub>: rate &le; 75% and H<sub>0</sub>: rate &le; 70%. If p &lt; 0.05, we reject the null and can claim the rate exceeds the threshold.</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Why two thresholds</td><td>75% is the aspirational target; 70% is a fallback. If we can&rsquo;t claim 75%, knowing whether 70% holds is still valuable for characterizing system reliability.</td></tr>
          </tbody>
        </table>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 6: Completeness (Haiku+Neurons vs Opus Raw)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>Does neuron context give Haiku better completeness than Opus achieves natively?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Mann-Whitney U (one-sided, greater)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Why completeness</td><td>Completeness is the dimension most directly influenced by context assembly &mdash; more relevant neurons in the prompt should produce more thorough answers. This tests the core value proposition of the neuron graph.</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Sidedness</td><td>One-sided &mdash; tests specifically for Haiku+Neurons superiority, not just difference</td></tr>
          </tbody>
        </table>
      </section>

      <section className="about-section">
        <h3>Multiple Comparisons Correction</h3>
        <p>
          Running 6+ statistical tests at &alpha;=0.05 inflates the probability of at least one false positive.
          With 6 independent tests, the family-wise error rate would be approximately 1 &minus; (0.95)<sup>6</sup> &asymp; 26%.
        </p>
        <p>
          To control this, all p-values are corrected using the <strong>Benjamini-Hochberg (BH)</strong> procedure,
          which controls the <em>false discovery rate</em> (FDR) &mdash; the expected proportion of false positives
          among all rejected hypotheses.
        </p>

        <h4 style={{ marginTop: 16, marginBottom: 8 }}>How BH-FDR Works</h4>
        <ol>
          <li>All p-values from all tests are collected and sorted ascending</li>
          <li>Each p-value is adjusted: p<sub>adj</sub> = p<sub>raw</sub> &times; m / rank, where m is total tests and rank is the position in sorted order</li>
          <li>Adjusted values are capped to be monotonically non-decreasing (each &le; the next largest)</li>
          <li>A result is significant if p<sub>adj</sub> &lt; 0.05</li>
        </ol>
        <p>
          BH is less conservative than Bonferroni (which simply multiplies all p-values by m) and is the standard
          choice when the tests are not perfectly independent and the goal is controlling the proportion of false
          discoveries rather than eliminating any possibility of a false positive.
        </p>
        <p>
          <strong>On the display:</strong> The Performance page shows both raw p-values (labeled <code>p=</code>) and
          adjusted p-values (labeled <code>p<sub>adj</sub>=</code>). The significance badge and card styling
          reflect the FDR-adjusted result. A test that is significant at raw &alpha;=0.05 but not after FDR correction
          will show as &ldquo;Not Significant (FDR).&rdquo;
        </p>
      </section>

      <section className="about-section">
        <h3>Effect Size Interpretation</h3>
        <p>
          P-values tell you whether a difference is <em>statistically</em> real; effect sizes tell you whether it&rsquo;s
          <em>practically</em> meaningful. Cohen&rsquo;s d is reported for all comparison tests.
        </p>
        <table className="about-table">
          <thead>
            <tr><th>Cohen&rsquo;s d</th><th>Label</th><th>Interpretation</th></tr>
          </thead>
          <tbody>
            <tr><td>&lt; 0.2</td><td>Negligible</td><td>Difference exists but is too small to matter in practice</td></tr>
            <tr><td>0.2 &ndash; 0.5</td><td>Small</td><td>Detectable with careful measurement, modest practical impact</td></tr>
            <tr><td>0.5 &ndash; 0.8</td><td>Medium</td><td>Noticeable difference, meaningful practical impact</td></tr>
            <tr><td>&gt; 0.8</td><td>Large</td><td>Substantial difference, obvious in practice</td></tr>
          </tbody>
        </table>
        <p>
          Cohen&rsquo;s d is calculated using pooled standard deviation with Bessel&rsquo;s correction (ddof=1):
        </p>
        <pre className="about-tree">{`d = (mean_A - mean_B) / s_pooled

s_pooled = sqrt(((n_A - 1) * s_A² + (n_B - 1) * s_B²) / (n_A + n_B - 2))`}</pre>
        <p style={{ marginTop: 8 }}>
          <strong>Limitation:</strong> Cohen&rsquo;s d assumes equal variances for the pooled estimate. Welch&rsquo;s
          t-test accounts for unequal variances in its significance calculation, but the effect size does not.
          For very unequal variances, Glass&rsquo;s delta (using only the control group&rsquo;s SD) would be more
          appropriate. This is a minor concern for the current dataset.
        </p>
      </section>

      <section className="about-section">
        <h3>Power Analysis</h3>
        <p>
          Statistical power is the probability of detecting a real effect if one exists. The standard target is 80%
          power at &alpha;=0.05. The Performance page calculates the minimum sample size per group needed to achieve
          this, given the observed effect size:
        </p>
        <pre className="about-tree">{`n = ((z_α/2 + z_β) / d)²

where z_α/2 = 1.96 (two-sided α=0.05)
      z_β   = 0.84 (80% power)
      d     = observed Cohen's d`}</pre>
        <p style={{ marginTop: 8 }}>
          If the actual sample size per group meets or exceeds this threshold, the test is labeled
          &ldquo;Adequately powered.&rdquo; An underpowered test means the sample is too small to reliably detect
          the observed effect &mdash; a non-significant result could be a true null or simply insufficient data.
        </p>
      </section>

      <section className="about-section">
        <h3>Why Both Parametric and Non-Parametric Tests</h3>
        <p>
          Quality scores are ordinal (1&ndash;5 integer scale), not continuous. This creates a methodological tension:
        </p>
        <ul className="about-features">
          <li>
            <strong>Welch&rsquo;s t-test</strong> assumes approximate normality and continuous data. It&rsquo;s robust
            to moderate violations with sufficient sample size, and gives interpretable statistics (mean difference, CI).
            However, it&rsquo;s technically inappropriate for ordinal data.
          </li>
          <li>
            <strong>Mann-Whitney U</strong> is rank-based and makes no distributional assumption. It tests whether one
            group tends to produce higher values than the other. This is the correct choice for ordinal data but doesn&rsquo;t
            directly estimate effect magnitude on the original scale.
          </li>
        </ul>
        <p>
          By running both, we get the best of each: if both agree, confidence is high. If they disagree, the
          Mann-Whitney result is preferred for ordinal data. The Performance page reports both with their respective
          p-values so the reader can assess agreement.
        </p>
      </section>

      <section className="about-section">
        <h3>Reliability Distribution</h3>
        <p>
          The reliability section shows the frequency distribution of Haiku+Neuron overall scores (1&ndash;5).
          The &ldquo;reliability percentage&rdquo; is the proportion scoring 4 or above, representing answers
          that are at least &ldquo;good.&rdquo; This is a simple, interpretable metric for system dependability.
        </p>
        <p>
          The Wilson confidence interval provides uncertainty bounds on this proportion. Unlike the naive
          p&#x302; &plusmn; z&radic;(p&#x302;(1-p&#x302;)/n) interval, Wilson&rsquo;s method performs well at small
          sample sizes and extreme proportions (near 0 or 1), avoiding impossible intervals below 0% or above 100%.
        </p>
      </section>

      <section className="about-section">
        <h3>Neuron Count vs Quality Correlation</h3>
        <p>
          This analysis groups queries by how many neurons were selected (1&ndash;5, 6&ndash;15, 16&ndash;30, 31+)
          and reports average quality per bucket. It answers: <em>does selecting more neurons improve answers?</em>
        </p>
        <p>
          <strong>Caution:</strong> This is observational, not causal. Queries that select more neurons may be
          inherently different (broader scope, more complex) from those selecting fewer. A positive correlation
          suggests neurons help, but confounding is possible.
        </p>
      </section>

      <section className="about-section">
        <h3>Known Limitations</h3>
        <ul className="about-features">
          <li>
            <strong>Sample size</strong> &mdash; The dataset is relatively small compared to production evaluation
            suites. Power analysis flags underpowered tests, but some genuine effects may not reach significance
            simply due to insufficient data.
          </li>
          <li>
            <strong>Judge bias</strong> &mdash; The evaluator model introduces systematic bias. An Opus judge tends
            to rate Haiku answers slightly lower than a Haiku judge would. This is documented but not corrected
            for in the current analysis.
          </li>
          <li>
            <strong>Ordinal scale</strong> &mdash; The 1&ndash;5 scoring scale is ordinal, not interval. The
            difference between 2 and 3 may not equal the difference between 4 and 5. Mean-based statistics
            (t-test, Cohen&rsquo;s d) treat the scale as interval. Mann-Whitney U respects the ordinal nature
            but is less interpretable.
          </li>
          <li>
            <strong>Query distribution</strong> &mdash; Evaluation queries may not be representative of production
            workload. If training queries are disproportionately about topics well-covered by the neuron graph,
            quality metrics may overstate real-world performance.
          </li>
          <li>
            <strong>Temporal confounds</strong> &mdash; The early-vs-late quality trend test attributes improvement
            to graph growth, but other factors changed over time (prompt engineering refinements, neuron content
            quality improvements, different query topics). The test shows correlation, not causation.
          </li>
          <li>
            <strong>Pricing volatility</strong> &mdash; Cost models use current Anthropic pricing. These rates
            change periodically. The architecture&rsquo;s value proposition (structured context + cheap model)
            is robust to price changes since relative tier pricing has been stable, but absolute dollar figures
            should be considered snapshots.
          </li>
        </ul>
      </section>

      <section className="about-section">
        <h3>Data Sources</h3>
        <table className="about-table">
          <thead>
            <tr><th>Table</th><th>What It Stores</th><th>Used By</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>queries</code></td>
              <td>Every query: user text, classification, selected neuron IDs, token counts per stage, cost, timestamps</td>
              <td>Cost summary, cost modeling, timeline, neuron count correlation</td>
            </tr>
            <tr>
              <td><code>eval_scores</code></td>
              <td>Blind evaluation scores: query ID, answer mode, accuracy, completeness, clarity, faithfulness, overall</td>
              <td>All statistical tests, quality by mode, reliability, quality trend</td>
            </tr>
            <tr>
              <td><code>neurons</code></td>
              <td>Neuron definitions: name, layer, department, role, invocation count, creation timestamp</td>
              <td>Neuron graph stats, utilization, layer/department distribution</td>
            </tr>
            <tr>
              <td><code>neuron_firings</code></td>
              <td>Per-query neuron firing records</td>
              <td>Distinct fired count</td>
            </tr>
            <tr>
              <td><code>neuron_refinements</code></td>
              <td>Refinement actions (create, update) with timestamps</td>
              <td>Refinement impact</td>
            </tr>
            <tr>
              <td><code>autopilot_runs</code></td>
              <td>Autonomous training loop runs: status, neurons created/updated, cost, eval score</td>
              <td>Autopilot stats, total investment</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
