import { useState } from 'react';

interface SampleQuery {
  text: string;
  complexity: 'low' | 'medium' | 'high';
  roles: string[];
}

const SAMPLES: SampleQuery[] = [
  // --- LOW COMPLEXITY (single domain, straightforward) ---
  {
    text: 'What are the key clauses in FAR Part 15 that govern competitive negotiation procedures?',
    complexity: 'low',
    roles: ['Contracts Manager', 'FAR/DFARS Specialist'],
  },
  {
    text: 'What is the medallion architecture in Databricks and how does it structure ELT pipelines?',
    complexity: 'low',
    roles: ['Data Engineer'],
  },
  {
    text: 'What are the AS9100 Rev D requirements for document control and records management?',
    complexity: 'low',
    roles: ['Quality Manager', 'AS9100 Rev D'],
  },
  {
    text: 'How does earned value management (EVM) track cost and schedule performance on a contract?',
    complexity: 'low',
    roles: ['Program Manager', 'Financial Analyst'],
  },
  {
    text: 'What personal protective equipment standards does OSHA 29 CFR 1910 require for manufacturing facilities?',
    complexity: 'low',
    roles: ['Safety Officer', 'OSHA 29 CFR 1910'],
  },
  {
    text: 'What is the Shipley BD lifecycle and what are its major gate reviews?',
    complexity: 'low',
    roles: ['BD Director', 'Capture Manager'],
  },
  {
    text: 'What are the NADCAP special process categories and how does accreditation work?',
    complexity: 'low',
    roles: ['Quality Manager', 'NADCAP'],
  },
  {
    text: 'What cost pools and allocation bases does CAS 418 require for independent R&D and B&P costs?',
    complexity: 'low',
    roles: ['Cost Accountant', 'Cost Estimator'],
  },

  // --- MEDIUM COMPLEXITY (cross-role, requires synthesis) ---
  {
    text: 'How should a program manager coordinate with contracts and finance when a customer requests an equitable adjustment on a cost-plus contract?',
    complexity: 'medium',
    roles: ['Program Manager', 'Contracts Manager', 'Financial Analyst'],
  },
  {
    text: 'What is the interaction between ITAR export controls and the NADCAP audit process when a foreign national auditor needs facility access?',
    complexity: 'medium',
    roles: ['Export Control Officer', 'Quality Manager', 'ITAR/EAR Export Controls', 'NADCAP'],
  },
  {
    text: 'How do manufacturing engineering and quality management jointly develop a process control plan that satisfies both AS9100 and customer-specific requirements?',
    complexity: 'medium',
    roles: ['Manufacturing Engineer', 'Quality Manager', 'AS9100 Rev D'],
  },
  {
    text: 'What steps should the capture manager and proposal manager take to transition a qualified opportunity into a compliant proposal response?',
    complexity: 'medium',
    roles: ['Capture Manager', 'Proposal Manager', 'BD Director'],
  },
  {
    text: 'How does the CFO work with program management to establish indirect rate structures that remain competitive while covering overhead?',
    complexity: 'medium',
    roles: ['Chief Financial Officer', 'Program Manager', 'Cost Estimator'],
  },
  {
    text: 'What are the implications of DFARS 252.204-7012 (NIST SP 800-171) for the IT infrastructure supporting a manufacturing execution system?',
    complexity: 'medium',
    roles: ['IT Support Specialist', 'NIST/CMMC', 'Production Manager'],
  },
  {
    text: 'How should industrial engineering and facilities management coordinate when designing a new production cell layout for a defense contract?',
    complexity: 'medium',
    roles: ['Industrial Engineer', 'Facilities Manager', 'Production Manager'],
  },
  {
    text: 'What data quality checks should a data engineer implement when ingesting EVM performance data from multiple program managers into a central lakehouse?',
    complexity: 'medium',
    roles: ['Data Engineer', 'Program Control Analyst', 'Financial Analyst'],
  },
  {
    text: 'How do GD&T callouts per ASME Y14.5 flow from the mechanical engineer\'s design intent through manufacturing process planning to final inspection?',
    complexity: 'medium',
    roles: ['Mechanical Engineer', 'Manufacturing Engineer', 'ASME Y14.5'],
  },
  {
    text: 'What should the contracts manager and export control officer verify before issuing a technical assistance agreement for an international teaming arrangement?',
    complexity: 'medium',
    roles: ['Contracts Manager', 'Export Control Officer', 'ITAR/EAR Export Controls'],
  },

  // --- HIGH COMPLEXITY (multi-department, strategic, requires deep synthesis) ---
  {
    text: 'A prime contractor is flowing down CMMC Level 2 requirements to our company as a sub-tier supplier. What changes are needed across IT infrastructure, contracts, manufacturing data handling, and employee training to achieve compliance?',
    complexity: 'high',
    roles: ['NIST/CMMC', 'IT Support Specialist', 'Contracts Manager', 'Production Manager', 'HR Generalist'],
  },
  {
    text: 'We won a new CPFF development contract requiring NADCAP-accredited special processes, ITAR-controlled technical data, and AS9100 compliance. Map out the cross-functional launch sequence from contract award through first article inspection.',
    complexity: 'high',
    roles: ['Program Manager', 'Quality Manager', 'Export Control Officer', 'Manufacturing Engineer', 'Contracts Manager', 'NADCAP', 'AS9100 Rev D', 'ITAR/EAR Export Controls'],
  },
  {
    text: 'The CEO wants a strategic assessment: if we acquire a small composites shop with NADCAP accreditation, what are the integration risks across quality systems, export controls, cost accounting, and facility operations?',
    complexity: 'high',
    roles: ['Chief Executive Officer', 'VP Strategy', 'Quality Manager', 'Export Control Officer', 'Cost Accountant', 'Facilities Manager', 'NADCAP'],
  },
  {
    text: 'How should the VP of Engineering, CTO, and VP of Operations evaluate whether to invest in an automated NDT inspection cell versus continuing manual NAS 410 qualified inspectors, considering throughput, compliance, and workforce impacts?',
    complexity: 'high',
    roles: ['VP Engineering', 'Chief Technology Officer', 'VP Operations', 'Industrial Engineer', 'NAS 410', 'Test Engineer'],
  },
  {
    text: 'A government audit has flagged potential CAS 401/402 noncompliance in how we allocate engineering labor between direct and indirect cost pools. What is the remediation path involving finance, contracts, program management, and executive leadership?',
    complexity: 'high',
    roles: ['Chief Financial Officer', 'Cost Accountant', 'Contracts Manager', 'FAR/DFARS Specialist', 'Program Manager', 'Chief Executive Officer'],
  },
  {
    text: 'Design a data pipeline architecture that ingests real-time production floor data (MES, quality inspection, material tracking) into a Databricks lakehouse and surfaces it as EVM-compatible cost/schedule metrics for program managers and financial analysts.',
    complexity: 'high',
    roles: ['Data Engineer', 'Production Manager', 'Quality Manager', 'Program Control Analyst', 'Financial Analyst'],
  },
  {
    text: 'We are bidding on a classified program requiring DO-178C Level A software, MIL-STD-810 environmental testing, and ITAR-restricted data handling. What proposal volume structure and compliance matrix should the proposal team build, and what organizational capabilities need to be demonstrated?',
    complexity: 'high',
    roles: ['Proposal Manager', 'Software Engineer', 'Test Engineer', 'Export Control Officer', 'DO-178C/DO-254/DO-160G', 'MIL-STD Series', 'ITAR/EAR Export Controls'],
  },
  {
    text: 'The supply chain manager reports a sole-source critical casting supplier is at risk of losing NADCAP accreditation. What is the cross-functional response plan across supply chain, quality, engineering, program management, and contracts to mitigate delivery risk on active programs?',
    complexity: 'high',
    roles: ['Supply Chain Manager', 'Quality Manager', 'Manufacturing Engineer', 'Program Manager', 'Contracts Manager', 'NADCAP'],
  },
];

const COMPLEXITY_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#fb923c',
  high: '#ef4444',
};

export default function SampleQueries() {
  const [filter, setFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [copied, setCopied] = useState<number | null>(null);

  const filtered = filter === 'all' ? SAMPLES : SAMPLES.filter(s => s.complexity === filter);

  const copy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  const counts = {
    low: SAMPLES.filter(s => s.complexity === 'low').length,
    medium: SAMPLES.filter(s => s.complexity === 'medium').length,
    high: SAMPLES.filter(s => s.complexity === 'high').length,
  };

  return (
    <div className="sample-queries">
      <h2>Sample Queries</h2>
      <p className="sample-queries-intro">
        Pre-built queries for testing the neuron scoring pipeline. Each query is tagged by complexity
        and the roles it should activate. Click any query to copy it to clipboard, then paste into the Query Lab.
      </p>

      <div className="sample-filter-bar">
        {(['all', 'low', 'medium', 'high'] as const).map(level => (
          <button
            key={level}
            className={`sample-filter-btn${filter === level ? ' active' : ''}`}
            style={level !== 'all' ? { '--filter-color': COMPLEXITY_COLORS[level] } as React.CSSProperties : undefined}
            onClick={() => setFilter(level)}
          >
            {level === 'all' ? `All (${SAMPLES.length})` : `${level.charAt(0).toUpperCase() + level.slice(1)} (${counts[level]})`}
          </button>
        ))}
      </div>

      <div className="sample-list">
        {filtered.map((q) => {
          const globalIdx = SAMPLES.indexOf(q);
          return (
            <div
              key={globalIdx}
              className={`sample-card${copied === globalIdx ? ' copied' : ''}`}
              onClick={() => copy(q.text, globalIdx)}
            >
              <div className="sample-card-header">
                <span
                  className="sample-complexity-badge"
                  style={{ background: COMPLEXITY_COLORS[q.complexity] }}
                >
                  {q.complexity}
                </span>
                <span className="sample-copy-hint">
                  {copied === globalIdx ? 'Copied!' : 'Click to copy'}
                </span>
              </div>
              <p className="sample-text">{q.text}</p>
              <div className="sample-roles">
                {q.roles.map(r => (
                  <span key={r} className="sample-role-tag">{r}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
