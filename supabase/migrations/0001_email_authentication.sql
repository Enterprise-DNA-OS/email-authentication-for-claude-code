CREATE FUNCTION touch_updated() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TABLE domains (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE CHECK(name=lower(name)), owner text NOT NULL,
 purpose text NOT NULL DEFAULT '', retention_review date, policy text NOT NULL DEFAULT 'unknown' CHECK(policy IN ('unknown','none','quarantine','reject')),
 policy_observed_at timestamptz, policy_evidence text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), domain_id uuid NOT NULL REFERENCES domains(id), ip inet NOT NULL,
 service text NOT NULL DEFAULT 'Unidentified', decision text NOT NULL DEFAULT 'unknown' CHECK(decision IN ('unknown','approved','blocked')),
 evidence text NOT NULL DEFAULT '', reviewer text NOT NULL DEFAULT '', review_by date,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(domain_id,ip)
);
CREATE TABLE reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), domain_id uuid NOT NULL REFERENCES domains(id), reporter text NOT NULL, reporter_email text NOT NULL,
 report_key text NOT NULL, period_start timestamptz NOT NULL, period_end timestamptz NOT NULL CHECK(period_end>period_start),
 policy text NOT NULL CHECK(policy IN ('none','quarantine','reject')), sha256 text NOT NULL UNIQUE, original_xml text NOT NULL,
 metadata jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(domain_id,reporter,report_key)
);
CREATE TABLE observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid NOT NULL REFERENCES reports(id), source_id uuid NOT NULL REFERENCES sources(id),
 ordinal integer NOT NULL CHECK(ordinal>0), messages integer NOT NULL CHECK(messages>0),
 header_from text NOT NULL, spf text NOT NULL CHECK(spf IN ('pass','fail')), dkim text NOT NULL CHECK(dkim IN ('pass','fail')),
 disposition text NOT NULL CHECK(disposition IN ('none','pass','quarantine','reject')), raw_record jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(report_id,ordinal)
);
CREATE TABLE investigations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, domain_id uuid NOT NULL REFERENCES domains(id),
 title text NOT NULL, owner text NOT NULL, due date NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
 evidence text NOT NULL, outcome text NOT NULL DEFAULT '', closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='closed' AND outcome<>'' AND closed_at IS NOT NULL) OR (status='open' AND closed_at IS NULL))
);
CREATE TABLE policy_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), domain_id uuid NOT NULL REFERENCES domains(id), proposed_policy text NOT NULL CHECK(proposed_policy IN ('none','quarantine','reject')),
 actor text NOT NULL, rationale text NOT NULL, snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor text NOT NULL, action text NOT NULL, subject text NOT NULL, detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX observations_source ON observations(source_id);
CREATE INDEX reports_period ON reports(domain_id,period_end);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['domains','sources','reports','observations','investigations','policy_reviews','activity'] LOOP
 EXECUTE format('CREATE TRIGGER updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated()',t);
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM public',t);
END LOOP; END $$;
CREATE VIEW source_health AS
 SELECT s.id,d.name AS domain,host(s.ip) AS ip,s.service,s.decision,s.review_by,s.evidence,s.reviewer,
 max(r.period_end) AS last_seen,
 coalesce(sum(o.messages) FILTER(WHERE r.period_end>=now()-interval '30 days'),0)::bigint AS messages_30d,
 coalesce(sum(o.messages) FILTER(WHERE r.period_end>=now()-interval '30 days' AND o.spf='fail' AND o.dkim='fail'),0)::bigint AS failures_30d
 FROM sources s JOIN domains d ON d.id=s.domain_id LEFT JOIN observations o ON o.source_id=s.id LEFT JOIN reports r ON r.id=o.report_id
 GROUP BY s.id,d.name;
CREATE VIEW report_coverage AS
 SELECT d.id,d.name AS domain,d.owner,count(r.id)::integer AS reports,max(r.period_end) AS last_report,
 CASE WHEN max(r.period_end) IS NULL THEN 'no reports' WHEN max(r.period_end)<now()-interval '3 days' THEN 'stale' ELSE 'recent' END AS coverage
 FROM domains d LEFT JOIN reports r ON r.domain_id=d.id GROUP BY d.id;
CREATE VIEW investigation_queue AS
 SELECT i.id,i.code,d.name AS domain,i.title,i.owner,i.due,i.status,i.outcome,
 CASE WHEN i.status='closed' THEN 'closed' WHEN i.due<current_date THEN 'overdue' ELSE 'open' END AS attention
 FROM investigations i JOIN domains d ON d.id=i.domain_id;
CREATE VIEW domain_summary AS
 SELECT d.name AS domain,d.owner,d.policy,c.coverage,c.last_report,
 coalesce((SELECT sum(s.messages_30d) FROM source_health s WHERE s.domain=d.name),0)::bigint AS messages_30d,
 coalesce((SELECT sum(s.failures_30d) FROM source_health s WHERE s.domain=d.name),0)::bigint AS failures_30d,
 (SELECT count(*)::integer FROM sources s WHERE s.domain_id=d.id AND (s.decision='unknown' OR s.review_by IS NULL OR s.review_by<current_date)) AS reviews_due,
 (SELECT count(*)::integer FROM investigations i WHERE i.domain_id=d.id AND i.status='open') AS open_cases
 FROM domains d JOIN report_coverage c ON c.id=d.id;
