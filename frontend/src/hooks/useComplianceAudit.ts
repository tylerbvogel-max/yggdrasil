import { useEffect, useState } from 'react';
import { fetchComplianceAudit } from '../api';
import type { ComplianceAuditResponse } from '../api';

export function useComplianceAudit() {
  const [data, setData] = useState<ComplianceAuditResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplianceAudit()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, error, loading };
}
