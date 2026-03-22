-- Trigger: trg_sync_metadata_updated
-- Atualiza timestamp em sync_metadata

CREATE TRIGGER trg_sync_metadata_updated
BEFORE UPDATE ON sync_metadata
FOR EACH ROW
EXECUTE FUNCTION update_sync_metadata_timestamp();
