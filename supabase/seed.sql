INSERT INTO domains(id,name,owner,purpose,retention_review,policy,policy_observed_at,policy_evidence) VALUES
 ('10000000-0000-4000-8000-000000000001','harbour.example','Morgan','Owned email authentication monitoring',current_date+90,'none',now()-interval '1 day','Synthetic DNS observation'),
 ('10000000-0000-4000-8000-000000000002','harbour-archive.example','Morgan','',current_date-4,'unknown',NULL,''),
 ('10000000-0000-4000-8000-000000000003','ridge.example','Ari','Owned email authentication monitoring',current_date+90,'reject',now()-interval '20 days','Synthetic old DNS observation') ON CONFLICT DO NOTHING;
INSERT INTO sources(id,domain_id,ip,service,decision,evidence,reviewer,review_by) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','192.0.2.10','Order mail','approved','Synthetic owner review','Morgan',current_date+30),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','198.51.100.20','Unidentified','unknown','','',NULL),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','203.0.113.30','Old campaign service','approved','Synthetic old review','Ari',current_date-5) ON CONFLICT DO NOTHING;
INSERT INTO investigations(id,code,domain_id,title,owner,due,evidence) VALUES
 ('40000000-0000-4000-8000-000000000001','CASE-001','10000000-0000-4000-8000-000000000001','Confirm the unidentified sending service','Morgan',current_date-2,'Synthetic report shows both checks failing'),
 ('40000000-0000-4000-8000-000000000002','CASE-002','10000000-0000-4000-8000-000000000003','Review old sender authorisation','Ari',current_date+2,'Synthetic source review expired') ON CONFLICT DO NOTHING;
