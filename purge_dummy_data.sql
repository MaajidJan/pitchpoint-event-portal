-- Purge dummy test data while preserving settings and staff credentials
DELETE FROM ideacrux_teams;
DELETE FROM desk_shifts;
DELETE FROM incoming_payments;
DELETE FROM registrations;
DELETE FROM audit_logs;

-- Re-insert a system initial log
INSERT INTO audit_logs (id, event_type, reference_id, details, created_at)
VALUES ('log-init-clean', 'SYSTEM_RESET_CLEAN', 'DATABASE', 'Dummy test data purged. System live and ready for real operations.', CURRENT_TIMESTAMP);
