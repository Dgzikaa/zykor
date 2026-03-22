-- Triggers: sync_mesas_after_getin_insert e sync_mesas_after_getin_update
-- Sincroniza mesas do GetIn para eventos_base

CREATE TRIGGER sync_mesas_after_getin_insert
AFTER INSERT ON getin_reservations
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_mesas_after_getin_change();

CREATE TRIGGER sync_mesas_after_getin_update
AFTER UPDATE ON getin_reservations
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_mesas_after_getin_change();
