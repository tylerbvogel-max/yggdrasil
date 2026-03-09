export default function PerformanceExplanationPage() {
  return (
    <div className="about-page">
      <h2>Evaluation Methodology</h2>

      <section className="about-section">
        <h3>Overview</h3>
        <p>
          The Evaluate pages compute all analytics from the PostgreSQL database using pure SQL and Python &mdash;
          no LLM is invoked for analysis. They answer a set of interconnected questions:
        </p>
        <ul className="about-features">
          <li><strong>Performance</strong> &mdash; How is the system running? (cost, tokens, operational metrics)</li>
          <li><strong>Quality</strong> &mdash; How good are the answers? (confidence intervals, cross-validation, signal robustness)</li>
          <li><strong>Fairness</strong> &mdash; Is it balanced? (department coverage, eval quality parity, remediation)</li>
          <li><strong>Compliance</strong> &mdash; Is it clean and traceable? (PII scan, provenance, scoring baselines)</li>
        </ul>
        <p>
          Every metric is derived from three data sources: the <code>queries</code> table (token counts, costs,
          neuron selections), the <code>eval_scores</code> table (blind quality evaluations scored on a 1&ndash;5
          ordinal scale), and the <code>neurons</code> table (content, department, invocations, metadata).
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
            rate Haiku answers ~0.2 points lower than a Haiku judge would. This is a known limitation tracked but
            not corrected for.
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

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Run Cost vs Training Cost</h4>
        <p>
          Cost is measured two ways to distinguish operational expense from investment:
        </p>
        <ul className="about-features">
          <li>
            <strong>Run Cost ($/1M tokens)</strong> &mdash; Production cost using only Haiku and Sonnet tier
            queries, plus classify overhead (always Haiku). This is what it costs to operate the system day-to-day
            without Opus benchmarking. Includes all non-opus slots plus the classification stage cost estimated
            at Haiku API rates.
          </li>
          <li>
            <strong>Training Cost ($/1M tokens)</strong> &mdash; Total cost across all model tiers, including
            Opus queries used for A/B benchmarking. This represents the full investment cost of building,
            evaluating, and refining the knowledge graph. Higher than run cost because Opus slots are
            5&times; more expensive per token.
          </li>
        </ul>
        <p>
          The Haiku+Neurons pipeline cost includes both stages: Stage 1 (Haiku classification) and Stage 2 (execution
          with assembled neuron context). The &ldquo;Raw&rdquo; alternatives model what it would cost to send the same
          query directly to Sonnet or Opus with no neuron enrichment.
        </p>
        <p>
          <strong>Important caveat:</strong> The &ldquo;raw&rdquo; cost models assume the same average input token count
          as the classification stage (since a raw query would just be the user&rsquo;s question). In practice, raw queries
          might have slightly different token counts depending on system prompt differences.
        </p>
      </section>

      <section className="about-section">
        <h3>Synthesized KPIs</h3>
        <p>
          Two composite metrics capture the system&rsquo;s core value proposition: &ldquo;comparable quality for
          a fraction of the price.&rdquo;
        </p>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Parity Index</h4>
        <pre className="about-tree">{`Parity Index = avg_neuron_eval / avg_opus_eval`}</pre>
        <p>
          Measures quality parity with Opus. 100% means neuron-assisted Haiku answers score identically to raw Opus.
          The target is &ge; 85% &mdash; answers don&rsquo;t need to match Opus perfectly, just be &ldquo;close enough&rdquo;
          for the price difference to be justified. Computed from the <code>eval_scores</code> table, comparing
          <code>*_neuron</code> modes against <code>opus_*</code> modes.
        </p>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Value Score</h4>
        <pre className="about-tree">{`Value Score = (avg_neuron_eval / 5) ÷ (run_cost_per_1M / opus_cost_per_1M)`}</pre>
        <p>
          Quality-adjusted cost ratio. Divides normalized quality (neuron eval as fraction of perfect 5.0 score)
          by relative cost (run cost as fraction of opus cost). Opus baseline is ~0.87 (since Opus scores ~4.36/5
          at 100% of its own cost). A Value Score of 3.0 means you get 3&times; the quality-per-dollar compared to
          raw Opus. Uses run cost (not training cost) because this measures production economics.
        </p>
      </section>

      <section className="about-section">
        <h3>Confidence Intervals &amp; Cross-Validation</h3>
        <p>
          The Quality page provides statistical validation of evaluation results:
        </p>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>95% Confidence Intervals</h4>
        <p>
          For each answer mode and eval dimension, a 95% CI is computed using the t-distribution approximation:
        </p>
        <pre className="about-tree">{`CI = mean ± t * (stddev / √n)

where t = 2.0 for n < 30, 1.96 for n ≥ 30`}</pre>
        <p>
          Narrow CIs indicate reliable measurement; wide CIs indicate insufficient sample size or high variance.
          The CI width column on the Quality page highlights intervals wider than 1.0 point in amber.
        </p>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>5-Fold Cross-Validation</h4>
        <p>
          Overall eval scores per mode are split into 5 equal folds (deterministic shuffle per mode for
          reproducibility). The mean is computed per fold, and the coefficient of variation (CV) across fold means
          is reported. CV &lt; 0.10 (10%) indicates stable results not driven by a lucky subset. This catches
          modes where a few outlier evaluations skew the average.
        </p>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Scoring Signal Robustness</h4>
        <p>
          Each of the 6 neuron scoring signals (Burst, Impact, Precision, Novelty, Recency, Relevance) is assessed
          for distributional consistency via coefficient of variation. CV &lt; 1.5 indicates the signal produces
          consistent distributions across queries. Signals with high CV (e.g., Burst, Precision) are inherently
          more variable due to their sparse nature &mdash; this is expected and documented, not necessarily a defect.
        </p>
      </section>

      <section className="about-section">
        <h3>Fairness Analysis</h3>
        <p>
          The Fairness page detects and quantifies bias across departments:
        </p>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Coverage CV</h4>
        <pre className="about-tree">{`CV = stddev(neurons_per_dept) / mean(neurons_per_dept)

Threshold: CV > 0.50 = imbalanced`}</pre>
        <p>
          Measures how evenly neurons are distributed across departments. A CV of 0 means perfectly equal;
          higher values indicate concentration. Tracked as a governance KPI because coverage imbalance directly
          affects which queries get good answers.
        </p>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Per-Department Eval Quality</h4>
        <p>
          Eval scores are joined to the departments of neurons activated for each query (via a lateral join on
          <code>selected_neuron_ids</code>). This reveals whether some departments consistently receive
          lower-quality answers. Departments scoring &gt; 0.5 below the mode average are flagged.
        </p>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Automated Remediation</h4>
        <p>
          Three types of gaps are detected with severity-ranked remediation recommendations:
        </p>
        <ul className="about-features">
          <li><strong>Coverage gap</strong> &mdash; Department has &lt; 50% of fair-share neuron count. Action: use autopilot gap-driven queries to grow coverage.</li>
          <li><strong>Quality gap</strong> &mdash; Department eval scores &gt; 0.5 below system average with &ge; 3 evals. Action: review and refine neuron content.</li>
          <li><strong>Utilization gap</strong> &mdash; Department has &gt; 10 neurons but &lt; 10% of median invocations. Action: review neuron labels/summaries for relevance.</li>
        </ul>
      </section>

      <section className="about-section">
        <h3>Statistical Tests (Performance Page)</h3>
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
            <tr><td style={{ fontWeight: 600 }}>Why one-sided</td><td>The investment thesis is that neurons add value. A one-sided test has more power to detect improvement but cannot detect degradation.</td></tr>
          </tbody>
        </table>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 3: All Enriched vs All Raw (Pooled)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>Across all model tiers, does neuron enrichment systematically outperform raw queries?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Welch&rsquo;s t-test + Mann-Whitney U (two-sided)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Pooling</td><td>Enriched = haiku_neuron + sonnet_neuron + opus_neuron; Raw = opus_raw + sonnet_raw + haiku_raw</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Caveat</td><td>Pooling across model tiers increases sample size but introduces heterogeneity &mdash; the effect of neurons may differ by model tier.</td></tr>
          </tbody>
        </table>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 4: Quality Trend (Early vs Late)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>Does Haiku+Neuron quality improve as the neuron graph grows over time?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Welch&rsquo;s t-test + Mann-Whitney U (one-sided, greater)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Split</td><td>Queries divided at median ID &mdash; first half (&ldquo;early&rdquo;) vs second half (&ldquo;late&rdquo;)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Caveat</td><td>Other factors changed over time (prompt refinements, neuron quality). The test shows correlation, not causation.</td></tr>
          </tbody>
        </table>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 5: Reliability (Score &ge; 4 Rate)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>What proportion of Haiku+Neuron answers score 4 or above?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Wilson score interval (95% CI on proportion) + Binomial tests at 75% and 70% thresholds</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Wilson CI</td><td>More accurate than the normal approximation for proportions, especially at small n or extreme proportions.</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Why two thresholds</td><td>75% is the aspirational target; 70% is a fallback. If we can&rsquo;t claim 75%, knowing whether 70% holds characterizes system reliability.</td></tr>
          </tbody>
        </table>

        <h4 style={{ color: '#38bdf8', marginTop: 16, marginBottom: 8 }}>Test 6: Completeness (Haiku+Neurons vs Opus Raw)</h4>
        <table className="about-table">
          <tbody>
            <tr><td style={{ width: 140, fontWeight: 600 }}>Question</td><td>Does neuron context give Haiku better completeness than Opus achieves natively?</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Tests used</td><td>Mann-Whitney U (one-sided, greater)</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Why completeness</td><td>Completeness is the dimension most directly influenced by context assembly &mdash; more relevant neurons should produce more thorough answers. This tests the core value proposition.</td></tr>
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
          BH is less conservative than Bonferroni and is the standard choice when the goal is controlling the
          proportion of false discoveries rather than eliminating any possibility of a false positive.
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
        <pre className="about-tree">{`d = (mean_A - mean_B) / s_pooled

s_pooled = sqrt(((n_A - 1) * s_A² + (n_B - 1) * s_B²) / (n_A + n_B - 2))`}</pre>
        <p style={{ marginTop: 8 }}>
          <strong>Limitation:</strong> Cohen&rsquo;s d assumes equal variances for the pooled estimate. For very
          unequal variances, Glass&rsquo;s delta would be more appropriate. This is a minor concern for the
          current dataset.
        </p>
      </section>

      <section className="about-section">
        <h3>Power Analysis</h3>
        <p>
          Statistical power is the probability of detecting a real effect if one exists. The standard target is 80%
          power at &alpha;=0.05. The Performance page calculates the minimum sample size per group needed:
        </p>
        <pre className="about-tree">{`n = ((z_α/2 + z_β) / d)²

where z_α/2 = 1.96 (two-sided α=0.05)
      z_β   = 0.84 (80% power)
      d     = observed Cohen's d`}</pre>
        <p style={{ marginTop: 8 }}>
          If the actual sample size per group meets or exceeds this threshold, the test is labeled
          &ldquo;Adequately powered.&rdquo; An underpowered test means a non-significant result could be
          a true null or simply insufficient data.
        </p>
      </section>

      <section className="about-section">
        <h3>Known Limitations</h3>
        <ul className="about-features">
          <li>
            <strong>Sample size</strong> &mdash; The dataset is relatively small compared to production evaluation
            suites. Power analysis flags underpowered tests, but some genuine effects may not reach significance.
          </li>
          <li>
            <strong>Judge bias</strong> &mdash; The evaluator model introduces systematic bias. An Opus judge tends
            to rate Haiku answers slightly lower than a Haiku judge would. This is documented but not corrected for.
          </li>
          <li>
            <strong>Ordinal scale</strong> &mdash; The 1&ndash;5 scoring scale is ordinal, not interval. Mean-based
            statistics (t-test, Cohen&rsquo;s d) treat the scale as interval. Mann-Whitney U respects the ordinal
            nature but is less interpretable.
          </li>
          <li>
            <strong>Query distribution</strong> &mdash; Evaluation queries may not be representative of production
            workload. If queries disproportionately cover well-represented topics, quality metrics may overstate
            real-world performance.
          </li>
          <li>
            <strong>Temporal confounds</strong> &mdash; The early-vs-late quality trend test attributes improvement
            to graph growth, but other factors changed over time (prompt refinements, content quality improvements).
          </li>
          <li>
            <strong>Pricing volatility</strong> &mdash; Cost models use current Anthropic pricing. Relative tier
            pricing has been stable, but absolute dollar figures should be considered snapshots.
          </li>
          <li>
            <strong>Fairness scope</strong> &mdash; Fairness analysis is limited to department-level coverage
            balance and eval quality parity. As a single-author system, demographic fairness analysis of user
            populations is not applicable but would be required in a multi-tenant deployment.
          </li>
          <li>
            <strong>Cross-validation determinism</strong> &mdash; Fold assignment uses a deterministic hash-based
            shuffle per mode. Results are reproducible but may be sensitive to the specific partition. Repeated
            random splits (Monte Carlo cross-validation) would be more robust but slower.
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
              <td>Every query: user text, classification, selected neuron IDs, token counts per stage, cost, model version, timestamps</td>
              <td>Performance (cost, timeline), Quality (eval joins), Fairness (dept eval quality)</td>
            </tr>
            <tr>
              <td><code>eval_scores</code></td>
              <td>Blind evaluation scores: query ID, answer mode, accuracy, completeness, clarity, faithfulness, overall, verdict</td>
              <td>Performance (statistical tests), Quality (CIs, cross-validation), Fairness (dept quality)</td>
            </tr>
            <tr>
              <td><code>neurons</code></td>
              <td>Neuron definitions: label, content, layer, department, role, invocations, avg_utility, source_type, citation, last_verified</td>
              <td>Compliance (PII scan, provenance), Fairness (coverage), Governance (KPIs)</td>
            </tr>
            <tr>
              <td><code>neuron_refinements</code></td>
              <td>Refinement actions (create, update, deactivate) with old/new values, reason, timestamp</td>
              <td>Governance (change management), Performance (refinement impact)</td>
            </tr>
            <tr>
              <td><code>autopilot_runs</code></td>
              <td>Autonomous training loop runs: status, neurons created/updated, cost, eval score</td>
              <td>Performance (autopilot ROI), Governance (change activity)</td>
            </tr>
            <tr>
              <td><code>system_alerts</code></td>
              <td>Automated alerts: type, severity, signal, message, acknowledged status</td>
              <td>Governance (active alerts KPI), Dashboard (health check)</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
